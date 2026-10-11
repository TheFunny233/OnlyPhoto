'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, ButtonLink, Card, ErrorNote, Field, Input, Select, Spinner, Textarea, Badge } from '@/components/ui';
import { postJson, apiFetch } from '@/lib/client/api';
import { useSession } from '@/components/useSession';
import { SUBJECT_OPTIONS } from '@/lib/constants';
import type { SpotDTO } from '@/lib/services/spots';
import type { PhotoDTO } from '@/lib/services/photos';

const MapView = dynamic(() => import('@/components/explore/MapView'), { ssr: false, loading: () => <Spinner label="地图载入中" /> });

const STEPS = ['位置', '照片', '拍法', '公开确认'];

function PublishInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useSession();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<SpotDTO | null>(null);

  const [form, setForm] = useState({
    title: '',
    city: '',
    area: '',
    lat: 31.2304,
    lng: 121.4737,
    hasPoint: false,
    precision: 'approximate' as 'exact' | 'approximate',
    subjects: [] as string[],
    description: '',
    howToStand: '',
    direction: '',
    bestLight: '',
    lightSource: 'unconfirmed' as 'author_experience' | 'external' | 'unconfirmed',
    gear: '',
    safety: '',
    photoId: null as string | null,
  });
  const [confirmPublic, setConfirmPublic] = useState(false);

  useEffect(() => {
    const photoId = searchParams.get('photoId');
    if (photoId) setForm((f) => ({ ...f, photoId }));
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      apiFetch<{ photos: PhotoDTO[] }>('/api/photos')
        .then((d) => setPhotos(d.photos))
        .catch(() => setPhotos([]));
    }
  }, [user]);

  const set = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  function toggleSubject(s: string) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.includes(s) ? f.subjects.filter((x) => x !== s) : [...f.subjects, s],
    }));
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!form.city.trim()) {
        setError('请填写城市');
        return;
      }
      if (!form.hasPoint) {
        setError('请在地图上点选一个位置（至少大致位置）');
        return;
      }
    }
    if (step === 2) {
      if (!form.title.trim()) {
        setError('请填写机位标题');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function publish() {
    if (!confirmPublic) {
      setError('请确认公开范围');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ spot: SpotDTO }>('/api/spots', {
        title: form.title,
        city: form.city,
        area: form.area,
        lat: form.lat,
        lng: form.lng,
        coordSystem: 'WGS84',
        precision: form.precision,
        subjects: form.subjects,
        description: form.description,
        howToStand: form.howToStand,
        direction: form.direction,
        bestLight: form.bestLight,
        lightSource: form.lightSource,
        gear: form.gear,
        safety: form.safety,
        status: 'published',
        photoId: form.photoId,
      });
      setPublished(res.spot);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>;
  if (!user)
    return (
      <div className="max-w-[980px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">登录后发布机位</h1>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/login">登录</ButtonLink>
          <ButtonLink href="/register" variant="outline">注册</ButtonLink>
        </div>
      </div>
    );

  if (published)
    return (
      <div className="max-w-[640px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">机位已发布</h1>
        <p className="mt-3 text-body">你的机位已经出现在地图和列表中。</p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href={`/spots/${published.id}`}>查看机位</ButtonLink>
          <ButtonLink href="/explore" variant="outline">去发现页</ButtonLink>
        </div>
      </div>
    );

  return (
    <div className="max-w-[980px] mx-auto px-4 md:px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">发布机位</h1>
      <p className="mt-2 text-body">记录“站在哪里、朝哪里拍、什么条件下拍”，帮助别人拍好下一张。</p>

      <ol className="mt-6 flex gap-2 text-sm flex-wrap" aria-label="发布步骤">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs ${
                i <= step ? 'bg-accent text-white' : 'bg-page text-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className={i === step ? 'text-ink font-medium' : 'text-muted'}>{label}</span>
            {i < STEPS.length - 1 ? <span className="text-line">—</span> : null}
          </li>
        ))}
      </ol>

      {error ? <div className="mt-5"><ErrorNote message={error} /></div> : null}

      <Card className="mt-6 p-6">
        {step === 0 ? (
          <div>
            <h2 className="text-lg font-semibold text-ink">位置</h2>
            <p className="text-sm text-muted mt-1">在地图上点选拍摄者站立的位置。默认坐标系统为 WGS84。</p>
            <div className="mt-4 h-[380px] rounded-card overflow-hidden">
              <MapView
                spots={[]}
                selectedId={null}
                onSelect={() => {}}
                pick={{
                  value: form.hasPoint ? { lat: form.lat, lng: form.lng } : null,
                  onPick: (lat, lng) => setForm((f) => ({ ...f, lat, lng, hasPoint: true })),
                }}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="城市" htmlFor="city">
                <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="例如：上海" />
              </Field>
              <Field label="区域/位置描述（可选）" htmlFor="area">
                <Input id="area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="例如：外滩亲水平台" />
              </Field>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-ink mb-2">位置精度</p>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => set('precision', 'approximate')} className={`px-3 py-1.5 rounded-full text-sm border ${form.precision === 'approximate' ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-body'}`}>大致位置</button>
                <button type="button" onClick={() => set('precision', 'exact')} className={`px-3 py-1.5 rounded-full text-sm border ${form.precision === 'exact' ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-body'}`}>精确位置</button>
              </div>
              {form.precision === 'exact' ? (
                <p className="mt-2 text-xs text-[#946200]">精确位置会公开展示，请勿发布私宅或不允许进入的区域。</p>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted">
              当前坐标：{form.hasPoint ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : '未选择'}
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="text-lg font-semibold text-ink">样张（可选）</h2>
            <p className="text-sm text-muted mt-1">
              选择你的照片作为样张。只有清理过元数据的公开派生图会被公开，不会公开原始文件、EXIF 与私人分析。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => set('photoId', null)}
                className={`h-24 w-32 rounded-card border flex items-center justify-center text-sm ${!form.photoId ? 'border-accent bg-accent/5 text-accent' : 'border-line text-muted'}`}
              >
                不附带照片
              </button>
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set('photoId', p.id)}
                  className={`h-24 w-32 rounded-card overflow-hidden border ${form.photoId === p.id ? 'border-accent ring-2 ring-accent/40' : 'border-line'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.originalName} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            {photos.length === 0 ? (
              <p className="mt-4 text-sm text-body">
                你还没有照片。
                <ButtonLink href="/studio" variant="ghost" size="sm">去上传</ButtonLink>
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="text-lg font-semibold text-ink">拍法</h2>
            <div className="mt-4 grid gap-4">
              <Field label="机位标题" htmlFor="title">
                <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="例如：外滩亲水平台·对岸天际线" />
              </Field>
              <div>
                <p className="text-sm font-medium text-ink mb-2">拍摄题材</p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${form.subjects.includes(s) ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-body'}`}
                      aria-pressed={form.subjects.includes(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="怎么站、朝哪拍" htmlFor="howToStand">
                <Textarea id="howToStand" rows={3} value={form.howToStand} onChange={(e) => set('howToStand', e.target.value)} placeholder="例如：站在平台东侧，面向对岸，稍微向左移动让路牌避开主体。" />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="朝向（可留空表示未知）" htmlFor="direction">
                  <Input id="direction" value={form.direction} onChange={(e) => set('direction', e.target.value)} placeholder="例如：朝东北" />
                </Field>
                <Field label="适合的光线/时间" htmlFor="bestLight">
                  <Input id="bestLight" value={form.bestLight} onChange={(e) => set('bestLight', e.target.value)} placeholder="例如：日落前后半小时（作者经验）" />
                </Field>
              </div>
              <Field label="光线信息来源" htmlFor="lightSource">
                <Select id="lightSource" value={form.lightSource} onChange={(e) => set('lightSource', e.target.value as typeof form.lightSource)}>
                  <option value="author_experience">作者经验</option>
                  <option value="external">外部资料</option>
                  <option value="unconfirmed">尚未确认</option>
                </Select>
              </Field>
              <Field label="器材或倍率建议（可选）" htmlFor="gear">
                <Input id="gear" value={form.gear} onChange={(e) => set('gear', e.target.value)} placeholder="例如：等效 24mm 左右" />
              </Field>
              <Field label="通行与安全提示" htmlFor="safety">
                <Textarea id="safety" rows={2} value={form.safety} onChange={(e) => set('safety', e.target.value)} placeholder="例如：公共区域，注意人流，不要翻越围栏。" />
              </Field>
              <Field label="补充说明（可选）" htmlFor="description">
                <Textarea id="description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="text-lg font-semibold text-ink">公开确认</h2>
            <div className="mt-4 rounded-card border border-line p-5">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{form.city}</span>
                <span>· {form.precision === 'approximate' ? '大致位置' : '精确位置'}</span>
                <span>· WGS84</span>
              </div>
              <h3 className="mt-1 text-lg font-semibold text-ink">{form.title || '（未填写标题）'}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.subjects.map((s) => <Badge key={s}>{s}</Badge>)}
              </div>
              <p className="mt-3 text-sm text-body">{form.howToStand || '（未填写站位说明）'}</p>
              <p className="mt-2 text-xs text-muted">坐标：{form.lat.toFixed(4)}, {form.lng.toFixed(4)}</p>
              <p className="mt-2 text-xs text-muted">样张：{form.photoId ? '附带 1 张公开派生图' : '不附带照片'}</p>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm text-body">
              <input type="checkbox" checked={confirmPublic} onChange={(e) => setConfirmPublic(e.target.checked)} className="mt-0.5 h-4 w-4" data-testid="publish-confirm" />
              <span>我确认公开以上位置信息{form.photoId ? '与样张' : ''}，并了解可以随时编辑或删除；不会发布私宅或禁止进入的区域。</span>
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            上一步
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>下一步</Button>
          ) : (
            <Button onClick={publish} disabled={busy || !confirmPublic} data-testid="publish-submit">
              {busy ? '正在发布…' : '确认发布'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={<div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>}>
      <PublishInner />
    </Suspense>
  );
}