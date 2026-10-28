import type { Draft } from '@/lib/types';
import type { DraftAck, DraftOperation } from '@/lib/drafts/fields';

export type FlushMode = 'normal' | 'hidden';
export type TransportResult =
  | { type: 'ack'; ack: DraftAck }
  | { type: 'conflict'; current: Draft }
  | { type: 'rejected'; code: string; message: string }
  | { type: 'protocol'; message: string }
  | { type: 'auth' }
  | { type: 'retry' };
export type DraftTransport = (operation: DraftOperation, mode: FlushMode) => Promise<TransportResult>;

export function createTransport(draftId: string, fetcher: typeof fetch = fetch): DraftTransport {
  return async (operation, mode) => {
    const { operationId, ...input } = operation;
    const body = JSON.stringify(input);
    try {
      const response = await fetcher(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationId },
        body,
        signal: AbortSignal.timeout(15_000),
        keepalive: mode === 'hidden' && new TextEncoder().encode(body).byteLength < 60 * 1024
      });
      if (response.status === 401) return { type: 'auth' };
      if (response.status === 429 || response.status >= 500) return { type: 'retry' };
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        if (payload?.ok && payload.data?.ack) return { type: 'ack', ack: payload.data.ack };
        return { type: 'protocol', message: '服务器返回了无效确认' };
      }
      if (response.status === 409 && payload?.error?.code === 'DRAFT_CONFLICT' && payload.error.details?.current) {
        return { type: 'conflict', current: payload.error.details.current };
      }
      if ([400, 404, 422].includes(response.status)) {
        return { type: 'rejected', code: payload?.error?.code ?? `HTTP_${response.status}`, message: payload?.error?.message ?? '请求被拒绝' };
      }
      return { type: 'protocol', message: '服务器返回了意外状态' };
    } catch {
      return { type: 'retry' };
    }
  };
}
