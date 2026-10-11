import { describe, it, expect } from 'vitest';
import { extractJsonObject, parseAnalysis } from '@/lib/ai/schema';

const base = {
  summary: '一句总览',
  strengths: [],
  improvements: [],
  reshootSuggestions: [],
  editingSuggestions: [],
  recommendedRecipe: null,
  firstAction: '先做这件事',
  uncertainties: [],
};

describe('analysis schema parsing', () => {
  it('accepts a minimal valid object with defaults', () => {
    const result = parseAnalysis(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe('1');
      expect(result.value.summary).toBe('一句总览');
      expect(result.value.firstAction).toBe('先做这件事');
    }
  });

  it('rejects when summary is missing', () => {
    const result = parseAnalysis({ ...base, summary: undefined });
    expect(result.ok).toBe(false);
  });

  it('drops out-of-range regions and keeps valid ones', () => {
    const result = parseAnalysis({
      ...base,
      improvements: [
        {
          category: 'composition',
          title: 'bad',
          region: { x: 5, y: 5, width: 1, height: 1 },
        },
        {
          category: 'light',
          title: 'good',
          region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.improvements[0]!.region).toBeNull();
      expect(result.value.improvements[1]!.region).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
    }
  });

  it('limits array sizes', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      category: 'composition' as const,
      title: `t${i}`,
    }));
    const result = parseAnalysis({ ...base, strengths: many, uncertainties: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.strengths.length).toBeLessThanOrEqual(3);
      expect(result.value.uncertainties.length).toBeLessThanOrEqual(6);
    }
  });

  it('clamps recommended recipe values', () => {
    const result = parseAnalysis({
      ...base,
      recommendedRecipe: { exposureEv: 9, contrast: -80, saturation: 80, warmth: 5, crop: null },
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.value.recommendedRecipe) {
      expect(result.value.recommendedRecipe.exposureEv).toBe(1);
      expect(result.value.recommendedRecipe.contrast).toBe(-20);
      expect(result.value.recommendedRecipe.saturation).toBe(20);
    }
  });
});

describe('extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('parses JSON embedded in prose', () => {
    expect(extractJsonObject('好的，结果是 {"a":3} 完毕')).toEqual({ a: 3 });
  });
  it('throws on non-JSON', () => {
    expect(() => extractJsonObject('没有任何结构')).toThrow();
  });
});