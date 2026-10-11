'use client';

import { useRouter } from 'next/navigation';
import { Button, ButtonLink, Card, EmptyState, Spinner } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { useSession } from '@/components/useSession';

export default function SettingsPage() {
  const { user, loading, setUser } = useSession();
  const router = useRouter();

  async function logout() {
    await postJson('/api/auth/logout', {});
    setUser(null);
    router.push('/');
    router.refresh();
  }

  if (loading) return <div className="max-w-[760px] mx-auto px-4 py-16"><Spinner /></div>;
  if (!user)
    return (
      <div className="max-w-[760px] mx-auto px-4 py-16">
        <EmptyState title="请先登录" action={<ButtonLink href="/login">登录</ButtonLink>} />
      </div>
    );

  return (
    <div className="max-w-[760px] mx-auto px-4 md:px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">设置</h1>
      <p className="mt-2 text-body">隐私与显示偏好。此处不会显示任何服务端密钥。</p>

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold text-ink">账号</h2>
        <dl className="mt-3 text-sm">
          <div className="flex gap-4 py-2 border-b border-line">
            <dt className="w-24 text-muted">昵称</dt>
            <dd className="text-ink">{user.nickname}</dd>
          </div>
          <div className="flex gap-4 py-2 border-b border-line">
            <dt className="w-24 text-muted">邮箱</dt>
            <dd className="text-ink">{user.email}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold text-ink">隐私</h2>
        <ul className="mt-3 text-sm text-body list-disc pl-5 flex flex-col gap-2">
          <li>照片与分析记录默认私有，只有你能查看。</li>
          <li>发布机位时，公开的是清理过元数据的派生图，不包含 GPS、EXIF、私人分析或原始文件。</li>
          <li>读取 EXIF 位置需要你单独确认，不会默认公开精确地址。</li>
          <li>举报记录会持久化，维护入口受令牌保护。</li>
        </ul>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold text-ink">显示偏好</h2>
        <p className="mt-2 text-sm text-body">
          动画会遵循系统的“减少动态效果”设置；界面保持浅色，以获得稳定的照片对比表现。
        </p>
      </Card>

      <div className="mt-6">
        <Button variant="outline" onClick={logout} data-testid="logout-button">
          退出登录
        </Button>
      </div>
    </div>
  );
}