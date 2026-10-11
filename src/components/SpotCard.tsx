import Link from 'next/link';
import { HeartIcon, MapIcon, StarIcon } from './icons';
import type { SpotDTO } from '@/lib/services/spots';

export function SpotCard({ spot }: { spot: SpotDTO }) {
  const cover = spot.media[0]?.url;
  return (
    <Link
      href={`/spots/${spot.id}`}
      className="group block bg-surface rounded-card shadow-card overflow-hidden transition-shadow duration-200 ease-apple hover:shadow-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      data-testid="spot-card"
    >
      <div className="aspect-[4/3] bg-page overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${spot.title} 样张`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-apple group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted">
            <MapIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{spot.city || '未标注城市'}</span>
          {spot.precision === 'approximate' ? <span>· 大致位置</span> : <span>· 精确位置</span>}
          {spot.isDemo ? <span>· 演示数据</span> : null}
        </div>
        <h3 className="mt-1 font-semibold tracking-tight text-ink text-lg line-clamp-2">{spot.title}</h3>
        {spot.subjects.length > 0 ? (
          <p className="mt-1 text-sm text-body line-clamp-2">{spot.subjects.join(' · ')}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="h-4 w-4" /> {spot.likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <StarIcon className="h-4 w-4" /> {spot.favoriteCount}
          </span>
        </div>
      </div>
    </Link>
  );
}