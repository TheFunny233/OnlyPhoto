'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, ButtonLink, Card, ErrorNote, Field, Select, Spinner, Badge } from '@/components/ui';
import { SlidersIcon, UploadIcon, TrashIcon, CheckIcon } from '@/components/icons';
import { apiFetch, del, postJson, putJson } from '@/lib/client/api';
import { useSession } from '@/components/useSession';
import { AnnotatedImage } from '@/components/studio/AnnotatedImage';
import { AnalysisView } from '@/components/studio/AnalysisView';
import { EditCanvas, downloadBlob, exportCanvas } from '@/components/studio/EditCanvas';
import { DEFAULT_RECIPE, normalizeRecipe } from '@/lib/edit/pixel';
import { GOAL_OPTIONS, SCENE_OPTIONS, type AnalysisReceipt, type EditRecipe, type PhotoAnalysis } from '@/lib/ai/types';
import type { PhotoDTO } from '@/lib/services/photos';

type Detail = {
  photo: PhotoDTO;
  analysis: PhotoAnalysis | null;
  receipt: AnalysisReceipt | null;
  jobId: string | null;
  recipe: EditRecipe | null;
};

export default function PhotoWorkbenchPage() {
  const params = useParams<{ photoId: string }>();
  const photoId = params.photoId;
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scene, setScene] = useState('auto');
  const [goals, setGoals] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [recipe, setRecipe] = useState<EditRecipe>(DEFAULT_RECIPE);
  const [savedRecipe, setSavedRecipe] = useState<EditRecipe>(DEFAULT_RECIPE);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Detail>(`/api/photos/${photoId}`);
      setDetail(data);
      if (data.recipe) {
        setRecipe(normalizeRecipe(data.recipe));
        setSavedRecipe(normalizeRecipe(data.recipe));
      }
      if (data.analysis && data.analysis.recommendedRecipe) {
        setRecipe((prev) => (data.recipe ? prev : normalizeRecipe(data.analysis!.recommendedRecipe)));
      }
    } catch {
      setNotFound(true);
    }
  }, [photoId]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const regions = useMemo(() => {
    if (!detail?.analysis) return [];
    const all = [...detail.analysis.improvements, ...detail.analysis.strengths];
    return all
      .filter((f) => f.region)
      .map((f) => ({ id: f.id, region: f.region!, label: f.title }));
  }, [detail]);

  const runAnalysis = useCallback(
    async (force = false) => {
      setAnalyzing(true);
      setAnalysisError(null);
      try {
        const res = await postJson<{
          status: string;
          analysis?: PhotoAnalysis;
          receipt?: AnalysisReceipt;
          error?: { message: string };
        }>(`/api/photos/${photoId}/analysis`, { scene, goals, force });
        if (res.status === 'succeeded' && res.analysis) {
          setDetail((prev) => (prev ? { ...prev, analysis: res.analysis!, receipt: res.receipt ?? null } : prev));
        } else if (res.status === 'processing') {
          for (let i = 0; i < 40; i += 1) {
            await new Promise((r) => setTimeout(r, 1500));
            const d = await apiFetch<Detail>(`/api/photos/${photoId}`);
            if (d.analysis) {
              setDetail(d);
              break;
            }
          }
        } else {
          setAnalysisError(res.error?.message ?? '分析失败');
        }
      } catch (err) {
        setAnalysisError(err instanceof Error ? err.message : '分析失败');
      } finally {
        setAnalyzing(false);
      }
    },
    [photoId, scene, goals],
  );

  async function saveRecipe() {
    setSaving(true);
    try {
      await putJson(`/api/photos/${photoId}/recipe`, recipe);
      setSavedRecipe(recipe);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function exportImage(type: 'image/jpeg' | 'image/webp') {
    if (!canvasRef.current) return;
    try {
      const blob = await exportCanvas(canvasRef.current, type);
      const ext = type === 'image/jpeg' ? 'jpg' : 'webp';
      downloadBlob(blob, `onlyphoto-${photoId.slice(0, 8)}.${ext}`);
    } catch {
      setAnalysisError('导出失败，请重试');
    }
  }

  async function removePhoto() {
    if (!confirm('确定删除这张照片吗？相关分析记录也会一并删除。')) return;
    setDeleting(true);
    try {
      await del(`/api/photos/${photoId}`);
      router.push('/studio');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : '删除失败');
      setDeleting(false);
    }
  }

  if (sessionLoading) return <div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>;
  if (!user)
    return (
      <div className="max-w-[980px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">请先登录</h1>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/login">登录</ButtonLink>
        </div>
      </div>
    );
  if (notFound)
    return (
      <div className="max-w-[980px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">照片不存在或无权访问</h1>
        <div className="mt-6">
          <ButtonLink href="/studio" variant="outline">返回工作台</ButtonLink>
        </div>
      </div>
    );
  if (!detail) return <div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>;

  const photo = detail.photo;

  return (
    <div className="max-w-[980px] mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink truncate">{photo.originalName}</h1>
          <p className="text-sm text-muted mt-0.5">
            {photo.width}×{photo.height} · {Math.round(photo.bytes / 1024)} KB
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditMode((v) => !v)} data-testid="toggle-edit">
            <SlidersIcon /> {editMode ? '查看点评' : '编辑预览'}
          </Button>
          <Button variant="ghost" size="sm" onClick={removePhoto} disabled={deleting} aria-label="删除照片">
            <TrashIcon /> 删除
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <div className="lg:sticky lg:top-20">
          <Card className="p-4">
            {editMode ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-body">{showOriginal ? '原图' : '修改预览'}</span>
                  <button
                    type="button"
                    className="text-sm text-accent hover:underline"
                    onClick={() => setShowOriginal((v) => !v)}
                    data-testid="toggle-compare"
                  >
                    {showOriginal ? '查看修改预览' : '对比原图'}
                  </button>
                </div>
                {showOriginal ? (
                  <AnnotatedImage
                    src={photo.mediaUrl}
                    alt={photo.originalName}
                    width={photo.width}
                    height={photo.height}
                    regions={[]}
                  />
                ) : (
                  <EditCanvas src={photo.mediaUrl} recipe={recipe} canvasRef={canvasRef} />
                )}
                <p className="mt-3 text-xs text-muted">
                  导出会去掉 GPS 等元数据，也不会把分析标注烧录进照片。原图不会被覆盖。
                </p>
              </div>
            ) : (
              <div>
                <AnnotatedImage
                  src={photo.mediaUrl}
                  alt={photo.originalName}
                  width={photo.width}
                  height={photo.height}
                  regions={regions.map((r) => ({ id: r.id, region: r.region, label: r.label }))}
                  activeId={activeId}
                  onSelectRegion={setActiveId}
                />
                {regions.length > 0 ? (
                  <p className="mt-3 text-xs text-muted">点击照片上的高亮框，可定位到对应的点评条目。</p>
                ) : null}
              </div>
            )}
          </Card>

          {analysisError ? <div className="mt-4"><ErrorNote message={analysisError} /></div> : null}

          {editMode ? (
            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold tracking-tight text-ink">调整</h2>
              <p className="text-sm text-muted mt-1">以下是建议参数，可继续调整，不是唯一正确答案。</p>
              <div className="mt-4 flex flex-col gap-5">
                <Slider label="曝光" value={recipe.exposureEv} min={-1} max={1} step={0.05} onChange={(v) => setRecipe((r) => ({ ...r, exposureEv: v }))} testid="slider-exposure" />
                <Slider label="对比度" value={recipe.contrast} min={-20} max={20} step={1} onChange={(v) => setRecipe((r) => ({ ...r, contrast: v }))} testid="slider-contrast" />
                <Slider label="饱和度" value={recipe.saturation} min={-20} max={20} step={1} onChange={(v) => setRecipe((r) => ({ ...r, saturation: v }))} testid="slider-saturation" />
                <Slider label="暖冷（近似）" value={recipe.warmth} min={-20} max={20} step={1} onChange={(v) => setRecipe((r) => ({ ...r, warmth: v }))} testid="slider-warmth" />
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-ink">裁切</p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRecipe((r) => ({ ...r, crop: null }))}
                  >
                    不裁切
                  </Button>
                  {detail.analysis?.recommendedRecipe?.crop ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRecipe((r) => ({ ...r, crop: detail.analysis!.recommendedRecipe!.crop }))
                      }
                    >
                      应用建议裁切
                    </Button>
                  ) : null}
                </div>
                {recipe.crop ? (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Slider label="裁切 X" value={Math.round(recipe.crop.x * 100)} min={0} max={80} step={1} onChange={(v) => setRecipe((r) => ({ ...r, crop: makeCrop({ ...r.crop!, x: v / 100 }) }))} />
                    <Slider label="裁切 Y" value={Math.round(recipe.crop.y * 100)} min={0} max={80} step={1} onChange={(v) => setRecipe((r) => ({ ...r, crop: makeCrop({ ...r.crop!, y: v / 100 }) }))} />
                    <Slider label="裁切宽度" value={Math.round(recipe.crop.width * 100)} min={20} max={100} step={1} onChange={(v) => setRecipe((r) => ({ ...r, crop: makeCrop({ ...r.crop!, width: v / 100 }) }))} />
                    <Slider label="裁切高度" value={Math.round(recipe.crop.height * 100)} min={20} max={100} step={1} onChange={(v) => setRecipe((r) => ({ ...r, crop: makeCrop({ ...r.crop!, height: v / 100 }) }))} />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted">可先应用建议裁切，或保持原图。</p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={saveRecipe} disabled={saving} data-testid="save-recipe">
                  <CheckIcon /> {saving ? '保存中…' : '保存方案'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRecipe(DEFAULT_RECIPE)}
                  data-testid="reset-recipe"
                >
                  复原原图
                </Button>
                <Button variant="outline" onClick={() => exportImage('image/jpeg')} data-testid="export-jpeg">
                  导出 JPEG
                </Button>
                <Button variant="outline" onClick={() => exportImage('image/webp')} data-testid="export-webp">
                  导出 WebP
                </Button>
              </div>
              {savedRecipe && JSON.stringify(savedRecipe) !== JSON.stringify(recipe) ? (
                <p className="mt-3 text-xs text-[#946200]">当前有未保存的调整。</p>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div>
          {!detail.analysis ? (
            <Card className="p-6">
              <h2 className="text-lg font-semibold tracking-tight text-ink">开始分析</h2>
              <p className="mt-1 text-sm text-body">
                选择拍摄场景与目标（可跳过），OnlyPhoto 会给出优点、问题、重拍与修图建议。
              </p>
              <div className="mt-5 grid gap-4">
                <Field label="拍摄场景" htmlFor="scene">
                  <Select id="scene" value={scene} onChange={(e) => setScene(e.target.value)} data-testid="scene-select">
                    {SCENE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <p className="text-sm font-medium text-ink mb-2">你想改善的目标（可选）</p>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((g) => {
                      const active = goals.includes(g.value);
                      return (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() =>
                            setGoals((prev) => (active ? prev.filter((x) => x !== g.value) : [...prev, g.value]))
                          }
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors duration-200 ${
                            active ? 'bg-accent text-white border-accent' : 'bg-surface text-body border-line hover:bg-page'
                          }`}
                          aria-pressed={active}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Button onClick={() => runAnalysis(false)} disabled={analyzing} data-testid="start-analysis">
                  {analyzing ? '正在分析…' : '开始分析'}
                </Button>
              </div>
            </Card>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-2">
                  {detail.receipt?.mode === 'live' ? (
                    <Badge tone="success">真实调用</Badge>
                  ) : (
                    <Badge tone="warn">演示模式</Badge>
                  )}
                  <span className="text-sm text-muted">{detail.receipt?.model ?? ''}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => runAnalysis(true)} disabled={analyzing} data-testid="reanalyze">
                  {analyzing ? '重新分析中…' : '重新分析'}
                </Button>
              </div>
              <AnalysisView
                analysis={detail.analysis}
                receipt={detail.receipt}
                activeId={activeId}
                onFocusRegion={(id) => {
                  setActiveId(id);
                  setEditMode(false);
                }}
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <ButtonLink href={`/publish?photoId=${photo.id}`} variant="outline">
                  <UploadIcon /> 发布到机位
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function makeCrop(crop: EditRecipe['crop']) {
  if (!crop) return null;
  const x = Math.min(Math.max(crop.x, 0), 0.95);
  const y = Math.min(Math.max(crop.y, 0), 0.95);
  const width = Math.min(Math.max(crop.width, 0.05), 1 - x);
  const height = Math.min(Math.max(crop.height, 0.05), 1 - y);
  return { x, y, width, height };
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  testid,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testid?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm text-body">
        <span>{label}</span>
        <span className="text-ink tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#0071e3]"
        data-testid={testid}
      />
    </label>
  );
}