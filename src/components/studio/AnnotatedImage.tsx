'use client';

import type { EvidenceRegion } from '@/lib/ai/types';

export function AnnotatedImage({
  src,
  alt,
  width,
  height,
  regions,
  activeId,
  onSelectRegion,
  dimmed = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  regions: { id: string; region: EvidenceRegion; label: string }[];
  activeId?: string | null;
  onSelectRegion?: (id: string) => void;
  dimmed?: boolean;
}) {
  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-card bg-page"
      style={{ aspectRatio: `${width} / ${height}`, maxWidth: width >= height ? '100%' : `${(width / height) * 100}%` }}
    >
      {/* The wrapper matches the image aspect ratio, so percentage coordinates map directly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`h-full w-full object-contain transition-opacity duration-200 ${dimmed ? 'opacity-40' : ''}`} />
      {regions.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectRegion?.(item.id)}
          className="absolute rounded-[6px] ring-2 ring-accent bg-accent/10 transition-opacity duration-200 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            left: `${item.region.x * 100}%`,
            top: `${item.region.y * 100}%`,
            width: `${item.region.width * 100}%`,
            height: `${item.region.height * 100}%`,
            opacity: activeId && activeId !== item.id ? 0.4 : 1,
          }}
          aria-label={`标注：${item.label}`}
        />
      ))}
    </div>
  );
}