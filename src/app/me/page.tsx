'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ButtonLink, Card, EmptyState, Spinner } from '@/components/ui';
import { apiFetch } from '@/lib/client/api';
import { useSession } from '@/components/useSession';
import { SlidersIcon } from '@/components/icons';

type MeSummary = {
  counts: { photos: number; analyses: number; spots: number; favorites: number; edits: number };
  photos: { id: string; originalName: string; thumbUrl: string; analysisStatus: string }[];
  spots: { id: string; title: string; city: string; status: string; createdAt: string }[];
  favoriteSpots: { id: string; title: string; city: string; status: string }[];
  recentEdits: { photoId: string; updatedAt: string }[];
};

export default function MePage() {
  const { user, loading } = useSession();
  const [data, setData] = useState<MeSummary | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) {
      setFetching(false);
      return;
    }
    apiFetch<MeSummary>('/api/me')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) return <div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>;
  if (!user)
    return (
      <div className="max-w-[980px] mx-auto px-4 py-16">
        <EmptyState
          title="登录后查看你的个人空间"
          action={<ButtonLink href="/login">登录</ButtonLink>}
        />
      </div>
    );
  if (!data) return <div className="max-w-[980px] mx-auto px-4 py-16"><p className="text-body">加载失败。</p></div>;

  return (
    <div className="max-w-[980px] mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{user.nickname}</h1>
          <p className="mt-1 text-body">你的照片收藏册、分析记录与发布。</p>
        </div>
        <ButtonLink href="/studio" variant="outline">上传新照片</ButtonLink>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="照片" value={data.counts.photos} />
        <Stat label="已分析" value={data.counts.analyses} />
        <Stat label="发布机位" value={data.counts.spots} />
        <Stat label="收藏" value={data.counts.favorites} />
        <Stat label="编辑方案" value={data.counts.edits} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight text-ink">我的照片</h2>
        {data.photos.length === 0 ? (
          <p className="mt-3 text-body">
            还没有照片。
            <Link href="/studio" className="text-accent hover:underline">去上传第一张</Link>
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3 md:grid-cols-4">
            {data.photos.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/studio/${p.id}`} className="bg-surface rounded-card shadow-card overflow-hidden hover:shadow-hover transition-shadow duration-200">
                <div className="aspect-square bg-page overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.originalName} className="h-full w-full object-cover" />
                </div>
                <p className="p-2 text-xs text-muted truncate">{p.originalName}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-ink">我的发布</h2>
          {data.spots.length === 0 ? (
            <p className="mt-3 text-body text-sm">
              还没有发布机位。<Link href="/publish" className="text-accent hover:underline">去发布</Link>
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {data.spots.map((s) => (
                <li key={s.id} className="bg-surface rounded-card shadow-card p-4 flex items-center justify-between">
                  <Link href={`/spots/${s.id}`} className="text-ink hover:text-accent">{s.title}</Link>
                  <span className="text-xs text-muted">{s.status === 'published' ? '已发布' : s.status === 'hidden' ? '已隐藏' : '草稿'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-ink">我的收藏</h2>
          {data.favoriteSpots.length === 0 ? (
            <p className="mt-3 text-body text-sm">
              还没有收藏。<Link href="/explore" className="text-accent hover:underline">去发现机位</Link>
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {data.favoriteSpots.map((s) => (
                <li key={s.id} className="bg-surface rounded-card shadow-card p-4 flex items-center justify-between">
                  <Link href={`/spots/${s.id}`} className="text-ink hover:text-accent">{s.title}</Link>
                  <span className="text-xs text-muted">{s.city}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight text-ink flex items-center gap-2"><SlidersIcon /> 最近编辑</h2>
        {data.recentEdits.length === 0 ? (
          <p className="mt-3 text-body text-sm">还没有保存的编辑方案。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentEdits.slice(0, 5).map((e) => (
              <li key={e.photoId} className="bg-surface rounded-card shadow-card p-4 flex items-center justify-between">
                <Link href={`/studio/${e.photoId}`} className="text-accent hover:underline">继续编辑照片 {e.photoId.slice(0, 8)}</Link>
                <span className="text-xs text-muted">{new Date(e.updatedAt).toLocaleString('zh-CN')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <div className="text-2xl font-semibold text-ink tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </Card>
  );
}