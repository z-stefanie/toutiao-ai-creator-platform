import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

export function traceId() {
  return `trace_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function ok<T>(data: T, init?: ResponseInit) {
  const body: ApiResponse<T> = {
    ok: true,
    data,
    traceId: traceId()
  };
  return NextResponse.json(body, init);
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  const body: ApiResponse<never> = {
    ok: false,
    error: { code, message, details },
    traceId: traceId()
  };
  return NextResponse.json(body, { status });
}

