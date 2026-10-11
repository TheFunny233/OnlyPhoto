import type { EditRecipe, EvidenceRegion } from '../ai/types';

/**
 * Deterministic pixel maths shared by the in-browser preview/export and by server-side tests.
 * Fixed order: crop -> exposure -> contrast -> saturation -> warmth -> encode.
 */

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

export const DEFAULT_RECIPE: EditRecipe = {
  crop: null,
  exposureEv: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
};

export function normalizeRecipe(input: Partial<EditRecipe> | null | undefined): EditRecipe {
  const r = input ?? {};
  return {
    crop: normalizeCrop(r.crop ?? null),
    exposureEv: clampRange(Number(r.exposureEv) || 0, -1, 1),
    contrast: clampRange(Number(r.contrast) || 0, -20, 20),
    saturation: clampRange(Number(r.saturation) || 0, -20, 20),
    warmth: clampRange(Number(r.warmth) || 0, -20, 20),
  };
}

function clampRange(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeCrop(crop: EvidenceRegion | null): EvidenceRegion | null {
  if (!crop) return null;
  const x = clampRange(Number(crop.x) || 0, 0, 1);
  const y = clampRange(Number(crop.y) || 0, 0, 1);
  const width = clampRange(Number(crop.width) || 0, 0, 1 - x);
  const height = clampRange(Number(crop.height) || 0, 0, 1 - y);
  if (width < 0.05 || height < 0.05) return null;
  if (width > 0.999 && height > 0.999) return null;
  return { x, y, width, height };
}

export function cropRect(crop: EvidenceRegion | null, width: number, height: number) {
  const c = normalizeCrop(crop);
  if (!c) return { left: 0, top: 0, width, height };
  const left = Math.round(c.x * width);
  const top = Math.round(c.y * height);
  const w = Math.max(1, Math.round(c.width * width));
  const h = Math.max(1, Math.round(c.height * height));
  return { left, top, width: Math.min(w, width - left), height: Math.min(h, height - top) };
}

/** exposure: multiply by 2^ev */
export function exposureFactor(ev: number): number {
  return Math.pow(2, ev);
}

/**
 * Apply exposure/contrast/saturation/warmth to an RGBA buffer in place and return it.
 * Values operate in 0..255 sRGB space. Alpha is preserved.
 */
export function transformPixels(data: Uint8ClampedArray, recipe: EditRecipe): Uint8ClampedArray {
  const ev = clampRange(recipe.exposureEv, -1, 1);
  const contrast = clampRange(recipe.contrast, -20, 20);
  const saturation = clampRange(recipe.saturation, -20, 20);
  const warmth = clampRange(recipe.warmth, -20, 20);

  const expMul = Math.pow(2, ev);
  const cFactor = 1 + contrast / 100;
  const sFactor = 1 + saturation / 100;
  const warmShift = warmth * 1.5;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]! * expMul;
    let g = data[i + 1]! * expMul;
    let b = data[i + 2]! * expMul;

    // contrast around mid grey
    r = (r - 128) * cFactor + 128;
    g = (g - 128) * cFactor + 128;
    b = (b - 128) * cFactor + 128;

    // saturation around luma
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + (r - luma) * sFactor;
    g = luma + (g - luma) * sFactor;
    b = luma + (b - luma) * sFactor;

    // warmth (approximate site-only effect)
    r += warmShift;
    b -= warmShift;

    data[i] = clamp255(Math.round(r));
    data[i + 1] = clamp255(Math.round(g));
    data[i + 2] = clamp255(Math.round(b));
    // alpha unchanged
  }
  return data;
}

export function recipesEqual(a: EditRecipe, b: EditRecipe): boolean {
  return (
    a.exposureEv === b.exposureEv &&
    a.contrast === b.contrast &&
    a.saturation === b.saturation &&
    a.warmth === b.warmth &&
    JSON.stringify(a.crop) === JSON.stringify(b.crop)
  );
}

export function isIdentity(recipe: EditRecipe): boolean {
  return (
    recipe.exposureEv === 0 &&
    recipe.contrast === 0 &&
    recipe.saturation === 0 &&
    recipe.warmth === 0 &&
    recipe.crop === null
  );
}