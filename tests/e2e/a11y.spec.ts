import { test, expect } from '@playwright/test';

test.describe('accessibility @a11y', () => {
  test('@a11y keyboard: skip link and nav are reachable', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: '跳到主要内容' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeVisible();
  });

  test('@a11y every image has a non-empty alt', async ({ page }) => {
    for (const path of ['/', '/explore', '/login']) {
      await page.goto(path);
      const missing = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter((img) => !img.getAttribute('alt'))
          .map((img) => img.getAttribute('src')),
      );
      expect(missing, `images without alt on ${path}`).toEqual([]);
    }
  });

  test('@a11y interactive controls have accessible names', async ({ page }) => {
    await page.goto('/');
    const unnamed = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('button, a'));
      return nodes
        .filter((el) => {
          const text = (el.textContent ?? '').trim();
          const aria = el.getAttribute('aria-label');
          const title = el.getAttribute('title');
          return !text && !aria && !title;
        })
        .map((el) => el.outerHTML.slice(0, 80));
    });
    expect(unnamed).toEqual([]);
  });

  test('@a11y body text meets WCAG AA contrast', async ({ page }) => {
    await page.goto('/about');
    const ratio = await page.evaluate(() => {
      const toLin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (rgb: number[]) => 0.2126 * toLin(rgb[0]!) + 0.7152 * toLin(rgb[1]!) + 0.0722 * toLin(rgb[2]!);
      const parse = (v: string) => (v.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
      const el = document.querySelector('p');
      if (!el) return 21;
      const fg = parse(getComputedStyle(el).color);
      const bg = [245, 245, 247];
      const l1 = lum(fg);
      const l2 = lum(bg);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('@a11y reduced motion disables long transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const duration = await page.evaluate(() => {
      const el = document.querySelector('a[href="/studio"]');
      if (!el) return 0;
      const raw = getComputedStyle(el).transitionDuration;
      const first = raw.split(',')[0]!.trim();
      return parseFloat(first) || 0;
    });
    expect(duration).toBeLessThan(0.05);
  });

  test('@a11y focus-visible outline is present on primary button', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByTestId('home-upload-cta');
    await cta.focus();
    const hasOutline = await cta.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    });
    expect(hasOutline).toBe(true);
  });
});