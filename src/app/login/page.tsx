'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, ErrorNote, Field, Input } from '@/components/ui';
import { postJson } from '@/lib/client/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson('/api/auth/login', { email, password });
      router.push('/studio');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink text-center">登录 PhotoMaster</h1>
      <p className="mt-2 text-center text-body">继续分析你的照片，或查看收藏的机位。</p>
      <Card className="mt-8 p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-5" data-testid="login-form">
          {error ? <ErrorNote message={error} /> : null}
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
          <Field label="密码" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="你的密码"
            />
          </Field>
          <Button type="submit" disabled={busy} data-testid="login-submit">
            {busy ? '正在登录…' : '登录'}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-body">
        还没有账号？
        <Link href="/register" className="text-accent hover:underline">
          去注册
        </Link>
      </p>
    </div>
  );
}