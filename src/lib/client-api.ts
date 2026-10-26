import type { ApiResponse } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) { super(message); }
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new ApiError(payload.error.message, response.status, payload.error.code, payload.error.details);
  }

  return payload.data;
}

export function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

