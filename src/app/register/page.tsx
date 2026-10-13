'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, ErrorNote, Field, Input } from '@/components/ui';
import { postJson } from '@/lib/client/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson('/api/auth/register', { email, nickname, password });
      router.push('/studio');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink text-center">创建 OnlyPhoto 账号</h1>
      <p className="mt-2 text-center text-body">上传照片即可获得有依据的点评与修图建议。</p>
      <Card className="mt-8 p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-5" data-testid="register-form">
          {error ? <ErrorNote message={error} /> : null}
          <Field label="昵称" htmlFor="nickname" hint="会显示在你的机位与评论上">
            <Input
              id="nickname"
              required
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="如何称呼你"
            />
          </Field>
          <Field label="邮箱" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="密码" htmlFor="password" hint="至少 8 位；服务端使用加盐哈希存储">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
            />
          </Field>
          <Button type="submit" disabled={busy} data-testid="register-submit">
            {busy ? '正在创建…' : '创建账号'}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-body">
        已有账号？
        <Link href="/login" className="text-accent hover:underline">
          去登录
        </Link>
      </p>
    </div>
  );
}