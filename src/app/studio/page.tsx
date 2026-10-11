'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink, Card, EmptyState, ErrorNote, Spinner } from '@/components/ui';
import { UploadIcon, ImageIcon, ChevronRightIcon } from '@/components/icons';
import { apiFetch } from '@/lib/client/api';
import { useSession } from '@/components/useSession';
import type { PhotoDTO } from '@/lib/services/photos';

export default function StudioPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await apiFetch<{ photos: PhotoDTO[] }>('/api/photos');
      setPhotos(data.photos);
    } catch {
      setPhotos([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadPhotos();
  }, [user, loadPhotos]);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (file && file.size > 15 * 1024 * 1024) {
      setError('文件超过 15MB 限制');
      return;
    }
    setPendingFile(file);
    setConsent(false);
  }

  async function startUpload() {
    if (!pendingFile) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      const data = await apiFetch<{ photo: { id: string } }>('/api/photos', { method: 'POST', body: form });
      router.push(`/studio/${data.photo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setBusy(false);
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (loading) return <div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>;

  if (!user) {
    return (
      <div className="max-w-[980px] mx-auto px-4 md:px-8 py-16">
        <EmptyState
          title="登录后开始分析你的照片"
          description="上传一张自己的照片，PhotoMaster 会说明它看到了什么，以及最值得先做的一件事。"
          action={
            <>
              <ButtonLink href="/login">登录</ButtonLink>
              <ButtonLink href="/register" variant="outline">
                注册
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-[980px] mx-auto px-4 md:px-8 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">分析工作台</h1>
      <p className="mt-2 text-body">上传一张照片，获得有依据的点评与可预览的修图建议。</p>

      <Card className="mt-8 p-8">
        <div
          className="rounded-card bg-page border border-dashed border-line p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              setPendingFile(file);
              setConsent(false);
            }
          }}
        >
          <UploadIcon className="h-8 w-8 text-accent mx-auto" />
          <p className="mt-3 text-ink font-medium">拖拽图片到这里，或选择文件</p>
          <p className="mt-1 text-sm text-muted">支持 JPEG / PNG / WebP，最大 15MB，解码后最多约 40MP。</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onPick}
            data-testid="file-input"
          />
          <div className="mt-5">
            <Button type="button" onClick={() => inputRef.current?.click()}>
              选择图片
            </Button>
          </div>
        </div>

        {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}

        {pendingFile ? (
          <div className="mt-6 rounded-card border border-line p-6" data-testid="upload-consent">
            <p className="text-ink font-medium">已选择：{pendingFile.name}</p>
            <p className="mt-2 text-sm text-body">
              分析时，图片会被发送到你本地配置的 AI 服务（服务端调用）。Original 文件保存在本项目的私有上传目录，不会自动公开。
            </p>
            <label className="mt-4 flex items-start gap-3 text-sm text-body">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4"
                data-testid="consent-checkbox"
              />
              <span>我同意将这张图片发送到所配置的 AI 服务用于生成摄影点评，并了解可以随时删除。</span>
            </label>
            <div className="mt-4 flex gap-3">
              <Button onClick={startUpload} disabled={!consent || busy} data-testid="confirm-upload">
                {busy ? '正在上传…' : '上传并继续'}
              </Button>
              <Button variant="outline" onClick={() => setPendingFile(null)} disabled={busy}>
                取消
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-ink">最近分析</h2>
          {listLoading ? <Spinner label="加载中" /> : null}
        </div>
        {photos.length === 0 && !listLoading ? (
          <p className="mt-4 text-body">还没有照片。上传第一张开始吧。</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {photos.map((photo) => (
              <Link
                key={photo.id}
                href={`/studio/${photo.id}`}
                className="group bg-surface rounded-card shadow-card overflow-hidden hover:shadow-hover transition-shadow duration-200 ease-apple"
                data-testid="photo-card"
              >
                <div className="aspect-[4/3] bg-page overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt={photo.originalName}
                    className="h-full w-full object-cover transition-transform duration-500 ease-apple group-hover:scale-105"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{photo.originalName}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {photo.width}×{photo.height} ·{' '}
                      {photo.analysisStatus === 'succeeded'
                        ? '已分析'
                        : photo.analysisStatus === 'processing'
                          ? '分析中'
                          : photo.analysisStatus === 'failed'
                            ? '分析失败'
                            : '未分析'}
                    </p>
                  </div>
                  <ChevronRightIcon className="text-muted shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 rounded-card bg-surface p-6 flex items-center gap-3">
        <ImageIcon className="text-accent" />
        <p className="text-sm text-body">
          分析记录默认私有。发布到机位时，只会使用清理过元数据的公开派生图，不会公开原始文件、私人分析或 EXIF。
        </p>
      </section>
    </div>
  );
}