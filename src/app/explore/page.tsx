'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button, Input, Select, Spinner, EmptyState } from '@/components/ui';
import { CloseIcon, MapIcon, CompassIcon } from '@/components/icons';
import { apiFetch } from '@/lib/client/api';
import { SUBJECT_OPTIONS } from '@/lib/constants';
import type { SpotDTO } from '@/lib/services/spots';

const MapView = dynamic(() => import('@/components/explore/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-page rounded-card">
      <Spinner label="正在载入地图" />
    </div>
  ),
});

export default function ExplorePage() {
  const [spots, setSpots] = useState<SpotDTO[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenter, setRecenter] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (subject) params.set('subject', subject);
      if (q) params.set('q', q);
      if (onlyFavorites) params.set('favorites', '1');
      const data = await apiFetch<{ spots: SpotDTO[]; cities: string[] }>(`/api/spots?${params.toString()}`);
      setSpots(data.spots);
      setCities(data.cities);
    } catch {
      setSpots([]);
    } finally {
      setLoading(false);
    }
  }, [city, subject, q, onlyFavorites]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => spots.find((s) => s.id === selectedId) ?? null, [spots, selectedId]);

  function useMyLocation() {
    setGeoMessage(null);
    if (!('geolocation' in navigator)) {
      setGeoMessage('当前浏览器不支持定位，可手动在地图上点选或浏览列表。');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setRecenter({ lat: pos.coords.latitude, lng: pos.coords.longitude, key: Date.now() }),
      () => setGeoMessage('定位被拒绝或不可用，仍可浏览列表与手动选择机位。'),
      { timeout: 8000 },
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">发现机位</h1>
          <p className="mt-1 text-body">点位不是一句地名，而是样张、站位、方向和条件的组合。</p>
        </div>
        <Button variant="outline" size="sm" onClick={useMyLocation}>
          <CompassIcon /> 使用我的位置
        </Button>
      </div>

      {geoMessage ? <p className="mt-3 text-sm text-[#946200]">{geoMessage}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={city} onChange={(e) => setCity(e.target.value)} className="max-w-[200px]" aria-label="按城市筛选">
          <option value="">全部城市</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="max-w-[200px]" aria-label="按题材筛选">
          <option value="">全部题材</option>
          {SUBJECT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题或关键词"
          className="max-w-[240px]"
          aria-label="关键词搜索"
        />
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" checked={onlyFavorites} onChange={(e) => setOnlyFavorites(e.target.checked)} />
          仅看我的收藏
        </label>
        <div className="ml-auto flex gap-2 lg:hidden">
          <Button size="sm" variant={mobileView === 'map' ? 'primary' : 'outline'} onClick={() => setMobileView('map')}>
            <MapIcon /> 地图
          </Button>
          <Button size="sm" variant={mobileView === 'list' ? 'primary' : 'outline'} onClick={() => setMobileView('list')}>
            列表
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,2fr)_3fr]">
        <div className={`${mobileView === 'list' ? 'block' : 'hidden'} lg:block`}>
          {loading ? (
            <Spinner />
          ) : spots.length === 0 ? (
            <EmptyState
              title="没有符合条件的机位"
              description="可以调整筛选条件，或发布你自己的第一个机位。"
              action={
                <Link href="/publish" className="text-accent hover:underline">
                  发布机位 →
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3" data-testid="spot-list">
              {spots.map((spot) => (
                <li key={spot.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(spot.id);
                      setMobileView('map');
                    }}
                    className={`w-full text-left rounded-card border p-4 transition-colors duration-200 ${
                      selectedId === spot.id ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:bg-page'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>{spot.city || '未标注城市'}</span>
                      <span>· {spot.precision === 'approximate' ? '大致位置' : '精确位置'}</span>
                      {spot.isDemo ? <span>· 演示数据</span> : null}
                    </div>
                    <p className="mt-1 font-medium text-ink">{spot.title}</p>
                    <p className="text-sm text-body line-clamp-2 mt-0.5">
                      {spot.subjects.join(' · ') || spot.description}
                    </p>
                    <Link
                      href={`/spots/${spot.id}`}
                      className="mt-2 inline-block text-sm text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      查看详情 →
                    </Link>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${mobileView === 'map' ? 'block' : 'hidden'} lg:block`}>
          <div className="h-[420px] lg:h-[640px] rounded-card overflow-hidden shadow-card bg-surface">
            <MapView spots={spots} selectedId={selectedId} onSelect={setSelectedId} recenter={recenter} />
          </div>
          {selected ? (
            <div className="mt-4 rounded-card border border-line bg-surface p-5 relative">
              <button
                type="button"
                className="absolute right-4 top-4 text-muted hover:text-ink"
                onClick={() => setSelectedId(null)}
                aria-label="关闭详情"
              >
                <CloseIcon />
              </button>
              <p className="text-xs text-muted">{selected.city}</p>
              <h2 className="text-lg font-semibold tracking-tight text-ink">{selected.title}</h2>
              <p className="mt-1 text-sm text-body line-clamp-3">{selected.description}</p>
              <Link href={`/spots/${selected.id}`} className="mt-3 inline-block text-accent hover:underline">
                打开发布详情 →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}