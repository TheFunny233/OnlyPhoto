import { NextResponse } from 'next/server';

export function mountNoStore(status: number, message: string): NextResponse {
  return NextResponse.json({ error: { code: status === 404 ? 'not_found' : 'error', message } }, { status });
}