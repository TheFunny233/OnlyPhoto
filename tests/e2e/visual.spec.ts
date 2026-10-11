import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

let tileStub: Buffer | null = null;

async function getTileStub(): Promise<Buffer> {
  if (!tileStub) {
    tileStub = await sharp({
      create: { width: 256, height: 256, channels: 3, background: { r: 235, g: 235, b: 238 } },
    })
      .png()
      .toBuffer();
  }
  return tileStub;
}

async function installStableTiles(page: Page) {
  const body = await getTileStub();
  await page.route('**/tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body }),
  );
}

async function makeJpeg(file: string) {
  const width = 640;
  const height = 480;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    raw[i * 3] = (i % width) % 200;
    raw[i * 3 + 1] = 120;
    raw[i * 3 + 2] = (i % height) % 180;
  }
  const buf = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
  fs.writeFileSync(file, buf);
}

test.describe('visual @visual', () => {
  test('@visual home desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot('home-desktop.png', { fullPage: true });
  });

  test('@visual home mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot('home-mobile.png', { fullPage: true });
  });

  test('@visual login desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveScreenshot('login-desktop.png');
  });

  test('@visual explore desktop with stable tiles', async ({ page }) => {
    await installStableTiles(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/explore', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('explore-desktop.png', {
      mask: [page.locator('.leaflet-control-attribution')],
    });
  });

  test('@visual workbench after mock analysis', async ({ page }) => {
    const email = `visual.${Date.now()}@example.com`;
    await page.goto('/register');
    await page.getByLabel('昵称').fill('视觉用户');
    await page.getByLabel('邮箱').fill(email);
    await page.getByLabel('密码').fill('visualpass123');
    await page.getByTestId('register-submit').click();
    await page.waitForURL('**/studio');

    const dir = path.join(process.cwd(), 'artifacts', 'test-results', 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `visual-${Date.now()}.jpg`);
    await makeJpeg(file);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择图片' }).click(),
    ]);
    await chooser.setFiles(file);
    await page.getByTestId('consent-checkbox').check();
    await page.getByTestId('confirm-upload').click();
    await page.waitForURL(/\/studio\/[0-9a-f-]+/);
    await page.getByTestId('start-analysis').click();
    await expect(page.getByText('先做这一件事')).toBeVisible({ timeout: 30000 });

    await page.setViewportSize({ width: 1440, height: 1200 });
    await expect(page).toHaveScreenshot('workbench-desktop.png', {
      mask: [page.locator('details'), page.locator('.tabular-nums')],
      fullPage: true,
    });
  });
});