import { z } from 'zod';
import type { EditRecipe, EvidenceRegion, PhotoAnalysis, PhotoFinding } from './types';

export const LIMITS = {
  strengths: 3,
  improvements: 3,
  reshootSuggestions: 3,
  editingSuggestions: 6,
  uncertainties: 6,
  stringLength: 600,
  shortStringLength: 160,
} as const;

const regionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const findingSchema = z.object({
  id: z.string().optional(),
  category: z.enum(['composition', 'light', 'color', 'subject', 'background', 'other']),
  title: z.string(),
  observation: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  action: z.string().optional().default(''),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  certainty: z.enum(['clear', 'tentative']).optional().default('tentative'),
  region: regionSchema.nullable().optional().default(null),
  requiresReshoot: z.boolean().optional().default(false),
});

const recipeSchema = z.object({
  crop: regionSchema.nullable().optional().default(null),
  exposureEv: z.number().optional().default(0),
  contrast: z.number().optional().default(0),
  saturation: z.number().optional().default(0),
  warmth: z.number().optional().default(0),
});

export const modelOutputSchema = z.object({
  schemaVersion: z.literal('1').optional().default('1'),
  scene: z.string().optional().default(''),
  summary: z.string(),
  strengths: z.array(findingSchema).optional().default([]),
  improvements: z.array(findingSchema).optional().default([]),
  reshootSuggestions: z.array(z.string()).optional().default([]),
  editingSuggestions: z.array(z.string()).optional().default([]),
  recommendedRecipe: recipeSchema.nullable().optional().default(null),
  firstAction: z.string().optional().default(''),
  uncertainties: z.array(z.string()).optional().default([]),
});

export const editRecipeSchema = recipeSchema;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function sanitizeRegion(region: EvidenceRegion | null | undefined): EvidenceRegion | null {
  if (!region) return null;
  const x = Number(region.x);
  const y = Number(region.y);
  const width = Number(region.width);
  const height = Number(region.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (width <= 0 || height <= 0) return null;
  const cx = clamp(x, 0, 1);
  const cy = clamp(y, 0, 1);
  const cw = clamp(width, 0, 1 - cx);
  const ch = clamp(height, 0, 1 - cy);
  if (cw < 0.02 || ch < 0.02) return null;
  // Reject regions that clearly cover almost the entire image (not a useful annotation).
  if (cw > 0.98 && ch > 0.98) return null;
  return { x: cx, y: cy, width: cw, height: ch };
}

function sanitizeFinding(finding: z.infer<typeof findingSchema>, index: number): PhotoFinding {
  return {
    id: cleanText(finding.id, 40) || `f${index + 1}`,
    category: finding.category,
    title: cleanText(finding.title, LIMITS.shortStringLength) || '未命名要点',
    observation: cleanText(finding.observation, LIMITS.stringLength),
    explanation: cleanText(finding.explanation, LIMITS.stringLength),
    action: cleanText(finding.action, LIMITS.stringLength),
    priority: finding.priority,
    certainty: finding.certainty,
    region: sanitizeRegion(finding.region),
    requiresReshoot: finding.requiresReshoot,
  };
}

function sanitizeRecipe(recipe: z.infer<typeof recipeSchema> | null): EditRecipe | null {
  if (!recipe) return null;
  return {
    crop: sanitizeRegion(recipe.crop),
    exposureEv: clamp(Number(recipe.exposureEv) || 0, -1, 1),
    contrast: clamp(Number(recipe.contrast) || 0, -20, 20),
    saturation: clamp(Number(recipe.saturation) || 0, -20, 20),
    warmth: clamp(Number(recipe.warmth) || 0, -20, 20),
  };
}

function cleanStringArray(value: string[], max: number): string[] {
  return value
    .map((s) => cleanText(s, LIMITS.stringLength))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

export type ParseResult =
  | { ok: true; value: PhotoAnalysis; warnings: string[] }
  | { ok: false; errors: string[] };

export function parseAnalysis(raw: unknown): ParseResult {
  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const data = parsed.data;
  const warnings: string[] = [];

  const rawStrengths = data.strengths.slice(0, LIMITS.strengths + 2);
  const rawImprovements = data.improvements.slice(0, LIMITS.improvements + 2);
  if (data.strengths.length > LIMITS.strengths) warnings.push('优点条目超过上限，已截断');
  if (data.improvements.length > LIMITS.improvements) warnings.push('改进条目超过上限，已截断');

  const strengths = rawStrengths
    .map((f, i) => sanitizeFinding(f, i))
    .slice(0, LIMITS.strengths);
  const improvements = rawImprovements
    .map((f, i) => sanitizeFinding(f, i + 10))
    .slice(0, LIMITS.improvements);

  const value: PhotoAnalysis = {
    schemaVersion: '1',
    scene: cleanText(data.scene, LIMITS.shortStringLength),
    summary: cleanText(data.summary, LIMITS.stringLength),
    strengths,
    improvements,
    reshootSuggestions: cleanStringArray(data.reshootSuggestions, LIMITS.reshootSuggestions),
    editingSuggestions: cleanStringArray(data.editingSuggestions, LIMITS.editingSuggestions),
    recommendedRecipe: sanitizeRecipe(data.recommendedRecipe),
    firstAction: cleanText(data.firstAction, LIMITS.stringLength),
    uncertainties: cleanStringArray(data.uncertainties, LIMITS.uncertainties),
  };

  return { ok: true, value, warnings };
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('模型未返回可解析的 JSON');
  }
}