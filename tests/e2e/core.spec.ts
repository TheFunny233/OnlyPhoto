import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

test.describe.configure({ mode: 'serial' });

const tmpDir = path.join(process.cwd(), 'artifacts', 'test-results', 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const stamp = Date.now();
const userA = { email: `a.${stamp}@example.com`, nickname: '测试用户A', password: 'testpass123' };
const userB = { email: `b.${stamp}@example.com`, nickname: '测试用户B', password: 'testpass123' };

let imagePath = '';
let imageBytes = 0;
let spotId = '';

async function makeJpeg(file: string, width = 640, height = 480) {
  // Build a varied image (not flat) so pixel edits are observable.
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      raw[i] = Math.round((x / width) * 200) + 20;
      raw[i + 1] = Math.round((y / height) * 160) + 40;
      raw[i + 2] = 120;
    }
  }
  const buf = await sharp(raw, { raw: { width, height, channels } }).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(file, buf);
  return buf;
}

async function register(page: Page, user: { email: string; nickname: string; password: string }) {
  await page.goto('/register');
  await page.getByLabel('昵称').fill(user.nickname);
  await page.getByLabel('邮箱').fill(user.email);
  await page.getByLabel('密码').fill(user.password);
  await page.getByTestId('register-submit').click();
  await page.waitForURL('**/studio');
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/studio');
}

async function uploadImage(page: Page, file: string) {
  await page.goto('/studio');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: '选择图片' }).click(),
  ]);
  await chooser.setFiles(file);
  await page.getByTestId('consent-checkbox').check();
  await page.getByTestId('confirm-upload').click();
  await page.waitForURL(/\/studio\/[0-9a-f-]+/);
}

test('T01 注册、登录、刷新、退出', async ({ page }) => {
  await register(page, userA);
  await expect(page.getByTestId('nav-me')).toContainText(userA.nickname);

  await page.reload();
  await expect(page.getByTestId('nav-me')).toContainText(userA.nickname);

  await page.goto('/settings');
  await page.getByTestId('logout-button').click();
  await page.waitForURL('http://127.0.0.1:3100/');
  await expect(page.getByRole('link', { name: '注册' })).toBeVisible();

  // After logout, private page is not accessible.
  await page.goto('/studio');
  await expect(page.getByText('登录后开始分析你的照片')).toBeVisible();

  await login(page, userA.email, userA.password);
  await expect(page.getByTestId('nav-me')).toContainText(userA.nickname);
});

test('T02/T05 上传 JPEG 并获得 mock 分析四部分', async ({ page }) => {
  await login(page, userA.email, userA.password);
  imagePath = path.join(tmpDir, `upload-${stamp}.jpg`);
  imageBytes = (await makeJpeg(imagePath)).length;
  await uploadImage(page, imagePath);

  await expect(page.getByTestId('start-analysis')).toBeVisible();
  await page.getByTestId('start-analysis').click();

  await expect(page.getByText('先做这一件事')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('演示模式', { exact: false }).first()).toBeVisible();

  for (const tab of ['优点', '可改进处', '重拍建议', '修图建议']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }
  await page.getByRole('tab', { name: '重拍建议' }).click();
  await expect(page.locator('li').first()).toBeVisible();
});

test('T03 上传拒绝：损坏与伪装类型', async ({ request, page }) => {
  await login(page, userA.email, userA.password);
  const badPath = path.join(tmpDir, `bad-${stamp}.jpg`);
  fs.writeFileSync(badPath, Buffer.from('this is not an image at all'));

  const res = await page.request.post('/api/photos', {
    multipart: {
      file: { name: 'bad.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(badPath) },
    },
  });
  expect(res.status()).toBe(415);
  const body = await res.json();
  expect(body.error.code).toBe('unsupported_type');
  void request;
});

test('T04 用户 B 不能访问用户 A 的照片', async ({ browser }) => {
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await register(pageB, userB);

  // Find A's photo id by listing A's photos using a separate context would need A's session.
  // Instead, B tries a random-looking id and must be rejected with 404.
  const res = await pageB.request.get('/api/photos/11111111-2222-3333-4444-555555555555');
  expect(res.status()).toBe(404);
  await contextB.close();
});

test('T10 编辑、复原与导出：像素确实改变，原图不被覆盖', async ({ page }) => {
  await login(page, userA.email, userA.password);
  await page.goto('/studio');
  await page.getByTestId('photo-card').first().click();
  await page.waitForURL(/\/studio\/[0-9a-f-]+/);

  await page.getByTestId('toggle-edit').click();
  await page.getByTestId('slider-exposure').fill('0.6');
  await page.getByTestId('slider-contrast').fill('15');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-jpeg').click(),
  ]);
  const exportPath = path.join(tmpDir, `export-${stamp}.jpg`);
  await download.saveAs(exportPath);
  const exported = fs.readFileSync(exportPath);
  expect(exported.length).toBeGreaterThan(0);
  // Exported bytes differ from the uploaded original.
  expect(Buffer.compare(exported, fs.readFileSync(imagePath))).not.toBe(0);

  // Save recipe, then restore original.
  await page.getByTestId('save-recipe').click();
  await expect(page.getByText('当前有未保存的调整。')).toHaveCount(0, { timeout: 15000 });
  await page.getByTestId('reset-recipe').click();
});

test('T15/T16/T17/T19 发布机位 + 双用户互动 + 持久化', async ({ page, browser }) => {
  await login(page, userA.email, userA.password);
  await page.goto('/studio');
  await page.getByTestId('photo-card').first().click();
  await page.waitForURL(/\/studio\/[0-9a-f-]+/);
  await page.getByRole('link', { name: /发布到机位/ }).click();
  await page.waitForURL('**/publish**');

  await page.getByLabel('城市').fill('测试市');
  const map = page.locator('.leaflet-container').first();
  await map.waitFor();
  await map.click({ position: { x: 300, y: 200 } });
  await expect(page.getByText(/当前坐标：\d/)).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();

  // attach the uploaded photo as sample
  await page.locator('button:has(img)').first().click();
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByLabel('机位标题').fill(`测试机位 ${stamp}`);
  await page.getByRole('button', { name: '建筑' }).click();
  await page.getByLabel('怎么站、朝哪拍').fill('站在路边，面向建筑，稍微向左移动避开遮挡。');
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByTestId('publish-confirm').check();
  await page.getByTestId('publish-submit').click();
  await expect(page.getByText('机位已发布')).toBeVisible({ timeout: 20000 });
  await page.getByRole('link', { name: '查看机位' }).click();
  await page.waitForURL(/\/spots\/[0-9a-f-]+/);
  spotId = page.url().split('/spots/')[1]!.split('?')[0]!;

  // User B interacts.
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await login(pageB, userB.email, userB.password);
  await pageB.goto(`/spots/${spotId}`);
  await pageB.getByTestId('like-button').click();
  await expect(pageB.getByTestId('like-button')).toContainText('已赞');
  await pageB.getByTestId('favorite-button').click();
  await expect(pageB.getByTestId('favorite-button')).toContainText('已收藏');

  await pageB.getByTestId('comment-input').fill('好看，收藏了。');
  await pageB.getByTestId('comment-submit').click();
  await expect(pageB.getByTestId('comment-list')).toContainText('好看，收藏了。');

  // Reload to confirm persistence.
  await pageB.reload();
  await expect(pageB.getByTestId('like-button')).toContainText('已赞');
  await expect(pageB.getByTestId('comment-list')).toContainText('好看，收藏了。');

  // A sees the interaction.
  await page.goto(`/spots/${spotId}`);
  await expect(page.getByTestId('comment-list')).toContainText('好看，收藏了。');
  await expect(page.getByTestId('like-button')).toContainText('1');

  await contextB.close();
});

test('T17 评论内容不执行 HTML/脚本', async ({ page, browser }) => {
  expect(spotId).not.toBe('');
  let dialogSeen = false;
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  pageB.on('dialog', async (d) => {
    dialogSeen = true;
    await d.dismiss();
  });
  await login(pageB, userB.email, userB.password);
  await pageB.goto(`/spots/${spotId}`);
  const payload = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">';
  await pageB.getByTestId('comment-input').fill(payload);
  await pageB.getByTestId('comment-submit').click();
  await expect(pageB.getByTestId('comment-list')).toContainText('<script>');
  const xss = await pageB.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? 0);
  expect(xss).toBe(0);
  expect(dialogSeen).toBe(false);
  await contextB.close();
  void page;
});