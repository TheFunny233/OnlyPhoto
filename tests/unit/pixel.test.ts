import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RECIPE,
  cropRect,
  isIdentity,
  normalizeCrop,
  normalizeRecipe,
  transformPixels,
} from '@/lib/edit/pixel';
import type { EditRecipe } from '@/lib/ai/types';

function rgba(colors: number[][]): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((c, i) => {
    arr[i * 4] = c[0]!;
    arr[i * 4 + 1] = c[1]!;
    arr[i * 4 + 2] = c[2]!;
    arr[i * 4 + 3] = 255;
  });
  return arr;
}

describe('edit pixel maths', () => {
  it('identity recipe leaves pixels unchanged', () => {
    const data = rgba([[10, 20, 30], [200, 100, 50]]);
    const out = transformPixels(data, DEFAULT_RECIPE);
    expect(Array.from(out)).toEqual(Array.from(data));
  });

  it('exposure brightens pixels', () => {
    const data = rgba([[100, 100, 100]]);
    const out = transformPixels(data, { ...DEFAULT_RECIPE, exposureEv: 0.5 });
    expect(out[0]!).toBeGreaterThan(100);
  });

  it('negative exposure darkens pixels', () => {
    const data = rgba([[100, 100, 100]]);
    const out = transformPixels(data, { ...DEFAULT_RECIPE, exposureEv: -0.5 });
    expect(out[0]!).toBeLessThan(100);
  });

  it('saturation change alters a coloured pixel', () => {
    const data = rgba([[200, 50, 50]]);
    const out = transformPixels(data, { ...DEFAULT_RECIPE, saturation: 20 });
    expect(out[1]!).not.toBe(50);
  });

  it('warmth shifts red up and blue down', () => {
    const data = rgba([[120, 120, 120]]);
    const out = transformPixels(data, { ...DEFAULT_RECIPE, warmth: 20 });
    expect(out[0]!).toBeGreaterThan(120);
    expect(out[2]!).toBeLessThan(120);
  });

  it('clamps to 0..255', () => {
    const data = rgba([[250, 250, 250]]);
    const out = transformPixels(data, { ...DEFAULT_RECIPE, exposureEv: 1, contrast: 20 });
    expect(out[0]!).toBeLessThanOrEqual(255);
    expect(out[0]!).toBeGreaterThanOrEqual(0);
  });

  it('preserves alpha', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 77]);
    const out = transformPixels(data, { ...DEFAULT_RECIPE, exposureEv: 0.5 });
    expect(out[3]).toBe(77);
  });
});

describe('recipe normalization', () => {
  it('clamps values into documented ranges', () => {
    const r = normalizeRecipe({ exposureEv: 5, contrast: -100, saturation: 999, warmth: 50 });
    expect(r.exposureEv).toBe(1);
    expect(r.contrast).toBe(-20);
    expect(r.saturation).toBe(20);
    expect(r.warmth).toBe(20);
  });

  it('drops invalid crops and keeps valid ones', () => {
    expect(normalizeCrop({ x: 0.1, y: 0.1, width: 0, height: 0.5 })).toBeNull();
    expect(normalizeCrop({ x: 0, y: 0, width: 1, height: 1 })).toBeNull();
    expect(normalizeCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 })).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.5,
    });
  });

  it('computeCropRect maps normalized crop to pixel box', () => {
    const rect = cropRect({ x: 0.25, y: 0.5, width: 0.5, height: 0.5 }, 400, 200);
    expect(rect).toEqual({ left: 100, top: 100, width: 200, height: 100 });
  });

  it('detects identity', () => {
    expect(isIdentity(DEFAULT_RECIPE)).toBe(true);
    const edited: EditRecipe = { ...DEFAULT_RECIPE, contrast: 5 };
    expect(isIdentity(edited)).toBe(false);
  });
});