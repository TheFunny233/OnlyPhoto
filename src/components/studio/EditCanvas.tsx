'use client';

import { useEffect, useRef, useState } from 'react';
import { cropRect, transformPixels } from '@/lib/edit/pixel';
import type { EditRecipe } from '@/lib/ai/types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

export function EditCanvas({
  src,
  recipe,
  canvasRef,
  onDrawn,
  className = '',
}: {
  src: string;
  recipe: EditRecipe;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onDrawn?: () => void;
  className?: string;
}) {
  const localRef = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? localRef;
  const [error, setError] = useState<string | null>(null);
  const onDrawnRef = useRef(onDrawn);

  useEffect(() => {
    onDrawnRef.current = onDrawn;
  }, [onDrawn]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const canvas = ref.current;
      if (!canvas) return;
      try {
        const img = await loadImage(src);
        if (cancelled) return;
        const rect = cropRect(recipe.crop, img.naturalWidth, img.naturalHeight);
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
        const imageData = ctx.getImageData(0, 0, rect.width, rect.height);
        transformPixels(imageData.data, recipe);
        ctx.putImageData(imageData, 0, 0);
        setError(null);
        onDrawnRef.current?.();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '预览生成失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, recipe, ref]);

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  return <canvas ref={ref} className={`max-w-full h-auto rounded-card ${className}`} aria-label="修改后的预览" />;
}

export async function exportCanvas(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/webp'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('导出失败'));
      },
      type,
      type === 'image/jpeg' ? 0.92 : 0.9,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}