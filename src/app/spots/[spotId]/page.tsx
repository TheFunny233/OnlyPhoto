'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button, ButtonLink, Card, ErrorNote, Field, Input, Select, Spinner, Textarea, Badge } from '@/components/ui';
import { HeartIcon, StarIcon, CommentIcon, TrashIcon, MapIcon } from '@/components/icons';
import { apiFetch, del, patchJson, postJson } from '@/lib/client/api';
import { useSession } from '@/components/useSession';
import { SUBJECT_OPTIONS, LIGHT_SOURCE_LABEL } from '@/lib/constants';
import type { SpotDTO } from '@/lib/services/spots';

const MapView = dynamic(() => import('@/components/explore/MapView'), { ssr: false, loading: () => <Spinner label="地图载入中" /> });

type Comment = { id: string; body: string; userId: string; nickname: string; createdAt: string };

export default function SpotDetailPage() {
  const params = useParams<{ spotId: string }>();
  const spotId = params.spotId;
  const router = useRouter();
  const { user } = useSession();
  const [spot, setSpot] = useState<SpotDTO | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SpotDTO>>({});

  const load = useCallback(async () => {
    try {
      const [spotData, commentData] = await Promise.all([
        apiFetch<{ spot: SpotDTO }>(`/api/spots/${spotId}`),
        apiFetch<{ comments: Comment[] }>(`/api/spots/${spotId}/comments`),
      ]);
      setSpot(spotData.spot);
      setComments(commentData.comments);
      setEditForm(spotData.spot);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [spotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLike() {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!spot) return;
    const prev = { liked: spot.likedByViewer, count: spot.likeCount };
    setSpot({ ...spot, likedByViewer: !prev.liked, likeCount: prev.count + (prev.liked ? -1 : 1) });
    try {
      const res = await postJson<{ liked: boolean; count: number }>(`/api/spots/${spotId}/like`, {});
      setSpot((s) => (s ? { ...s, likedByViewer: res.liked, likeCount: res.count } : s));
    } catch {
      setSpot((s) => (s ? { ...s, likedByViewer: prev.liked, likeCount: prev.count } : s));
      setError('点赞失败，请重试');
    }
  }

  async function toggleFavorite() {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!spot) return;
    const prev = { fav: spot.favoritedByViewer, count: spot.favoriteCount };
    setSpot({ ...spot, favoritedByViewer: !prev.fav, favoriteCount: prev.count + (prev.fav ? -1 : 1) });
    try {
      const res = await postJson<{ favorited: boolean; count: number }>(`/api/spots/${spotId}/favorite`, {});
      setSpot((s) => (s ? { ...s, favoritedByViewer: res.favorited, favoriteCount: res.count } : s));
    } catch {
      setSpot((s) => (s ? { ...s, favoritedByViewer: prev.fav, favoriteCount: prev.count } : s));
      setError('收藏失败，请重试');
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      const res = await postJson<{ comment: Comment }>(`/api/spots/${spotId}/comments`, { body: commentBody });
      setComments((prev) => [res.comment, ...prev]);
      setCommentBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '评论失败');
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id: string) {
    try {
      await del(`/api/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  async function report(targetType: 'spot' | 'comment', targetId: string) {
    const reason = prompt('请简要说明举报原因');
    if (!reason) return;
    try {
      await postJson('/api/reports', { targetType, targetId, reason });
      alert('已收到举报，我们会进行核查。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '举报失败');
    }
  }

  async function saveEdit() {
    if (!spot) return;
    setBusy(true);
    try {
      const res = await patchJson<{ spot: SpotDTO }>(`/api/spots/${spotId}`, {
        title: editForm.title,
        city: editForm.city,
        area: editForm.area,
        precision: editForm.precision,
        subjects: editForm.subjects,
        description: editForm.description,
        howToStand: editForm.howToStand,
        direction: editForm.direction,
        bestLight: editForm.bestLight,
        lightSource: editForm.lightSource,
        gear: editForm.gear,
        safety: editForm.safety,
      });
      setSpot(res.spot);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSpot() {
    if (!confirm('确定删除这个机位吗？此操作不可恢复。')) return;
    try {
      await del(`/api/spots/${spotId}`);
      router.push('/explore');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  if (loading) return <div className="max-w-[980px] mx-auto px-4 py-16"><Spinner /></div>;
  if (error && !spot)
    return (
      <div className="max-w-[980px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">机位不存在</h1>
        <div className="mt-6"><ButtonLink href="/explore" variant="outline">返回发现</ButtonLink></div>
      </div>
    );
  if (!spot) return null;

  return (
    <div className="max-w-[980px] mx-auto px-4 md:px-8 py-8">
      <Link href="/explore" className="text-sm text-accent hover:underline">← 返回发现</Link>

      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}

      <div className="mt-4 grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div>
          <div className="rounded-card overflow-hidden shadow-card bg-surface aspect-[4/3]">
            {spot.media[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spot.media[0].url} alt={`${spot.title} 样张`} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted"><MapIcon className="h-10 w-10" /></div>
            )}
          </div>
          {spot.media.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {spot.media.slice(1, 5).map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt="样张" className="rounded-control aspect-square object-cover" />
              ))}
            </div>
          ) : null}

          {editing ? (
            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold text-ink">编辑机位</h2>
              <div className="mt-4 grid gap-4">
                <Field label="标题"><Input value={editForm.title ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="城市"><Input value={editForm.city ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} /></Field>
                  <Field label="区域/描述"><Input value={editForm.area ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, area: e.target.value }))} /></Field>
                </div>
                <Field label="位置精度">
                  <Select value={editForm.precision ?? 'approximate'} onChange={(e) => setEditForm((f) => ({ ...f, precision: e.target.value }))}>
                    <option value="exact">精确（我确认的具体位置）</option>
                    <option value="approximate">大致位置</option>
                  </Select>
                </Field>
                <Field label="怎么站 / 朝哪拍"><Textarea rows={3} value={editForm.howToStand ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, howToStand: e.target.value }))} /></Field>
                <Field label="朝向（可留空表示未知）"><Input value={editForm.direction ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, direction: e.target.value }))} /></Field>
                <Field label="适合的光线/时间"><Input value={editForm.bestLight ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, bestLight: e.target.value }))} /></Field>
                <Field label="光线信息来源">
                  <Select value={editForm.lightSource ?? 'unconfirmed'} onChange={(e) => setEditForm((f) => ({ ...f, lightSource: e.target.value }))}>
                    <option value="author_experience">作者经验</option>
                    <option value="external">外部资料</option>
                    <option value="unconfirmed">尚未确认</option>
                  </Select>
                </Field>
                <Field label="器材或倍率建议（可选）"><Input value={editForm.gear ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, gear: e.target.value }))} /></Field>
                <Field label="通行与安全提示"><Textarea rows={2} value={editForm.safety ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, safety: e.target.value }))} /></Field>
                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={busy}>保存</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
            <span>{spot.city}</span>
            <span>· {spot.precision === 'approximate' ? '大致位置' : '精确位置'}</span>
            {spot.isDemo ? <Badge tone="warn">机位数据演示</Badge> : null}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{spot.title}</h1>
          <p className="mt-1 text-sm text-muted">作者：{spot.ownerName}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {spot.subjects.map((s) => (
              <Badge key={s} tone="neutral">{s}</Badge>
            ))}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <Button variant={spot.likedByViewer ? 'primary' : 'outline'} size="sm" onClick={toggleLike} data-testid="like-button">
              <HeartIcon /> {spot.likedByViewer ? '已赞' : '点赞'} {spot.likeCount}
            </Button>
            <Button variant={spot.favoritedByViewer ? 'primary' : 'outline'} size="sm" onClick={toggleFavorite} data-testid="favorite-button">
              <StarIcon /> {spot.favoritedByViewer ? '已收藏' : '收藏'} {spot.favoriteCount}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => report('spot', spot.id)}>举报</Button>
          </div>

          {spot.description ? <p className="mt-5 text-body">{spot.description}</p> : null}

          <dl className="mt-5 rounded-card border border-line bg-surface divide-y divide-line">
            <Row label="怎么站、朝哪拍" value={spot.howToStand || '作者未提供站位说明'} />
            <Row label="朝向" value={spot.direction || '未知'} />
            <Row label="适合的光线/时间" value={spot.bestLight || '未提供'} />
            <Row label="光线来源" value={LIGHT_SOURCE_LABEL[spot.lightSource] ?? spot.lightSource} />
            <Row label="器材/倍率建议" value={spot.gear || '未提供'} />
            <Row label="通行与安全" value={spot.safety || '未提供'} />
            <Row label="坐标精度" value={spot.precision === 'approximate' ? '大致位置（非精确坐标）' : '精确位置'} />
          </dl>
          {spot.isDemo ? (
            <p className="mt-3 text-xs text-[#946200]">该机位为演示数据：配图非此地实拍，请勿据此导航或进入受限区域。</p>
          ) : null}

          <div className="mt-5 h-48 rounded-card overflow-hidden shadow-card">
            <MapView
              spots={[{ id: spot.id, title: spot.title, city: spot.city, lat: spot.lat, lng: spot.lng, precision: spot.precision }]}
              selectedId={spot.id}
              onSelect={() => {}}
            />
          </div>

          {spot.isOwner ? (
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>编辑</Button>
              <Button variant="ghost" size="sm" onClick={deleteSpot}><TrashIcon /> 删除</Button>
            </div>
          ) : null}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-ink flex items-center gap-2">
          <CommentIcon /> 讨论（{comments.length}）
        </h2>
        {user ? (
          <form onSubmit={addComment} className="mt-4 flex gap-2 items-start">
            <Textarea
              rows={2}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="分享你的拍法或提问"
              className="flex-1"
              data-testid="comment-input"
            />
            <Button type="submit" disabled={busy || commentBody.trim().length === 0} data-testid="comment-submit">发表</Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-body">
            <Link href="/login" className="text-accent hover:underline">登录</Link> 后可以参与讨论。
          </p>
        )}

        <ul className="mt-6 flex flex-col gap-3" data-testid="comment-list">
          {comments.length === 0 ? (
            <li className="text-sm text-muted">还没有评论，来说点什么吧。</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{c.nickname}</span>
                  <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                {/* Rendered as plain text, never as HTML */}
                <p className="mt-2 text-body whitespace-pre-wrap break-words">{c.body}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  {user?.id === c.userId ? (
                    <button className="text-danger hover:underline" onClick={() => deleteComment(c.id)}>删除</button>
                  ) : null}
                  <button className="text-muted hover:text-ink" onClick={() => report('comment', c.id)}>举报</button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-32 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-sm text-body">{value}</dd>
    </div>
  );
}