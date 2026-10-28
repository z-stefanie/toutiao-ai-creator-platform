import type { FlushMode } from '@/lib/drafts/transport';
import type { FlushResult } from '@/lib/drafts/session';

type Timers = {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

export class DraftScheduler {
  private attempts = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private interval?: ReturnType<typeof setInterval>;
  private stopped = false;
  constructor(private flush: (mode?: FlushMode) => Promise<FlushResult>, private dirty: () => boolean,
    private timers: Timers = {
      setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setInterval: globalThis.setInterval.bind(globalThis), clearInterval: globalThis.clearInterval.bind(globalThis)
    }, private random = Math.random) {}
  start() {
    this.stopped = false;
    this.interval = this.timers.setInterval(() => { if (this.dirty() && !this.retry) void this.trigger(); }, 30_000);
  }
  async trigger(mode: FlushMode = 'normal', reset = false) {
    if (this.stopped) return;
    if (reset) { this.attempts = 0; this.cancelRetry(); }
    const result = await this.flush(mode);
    if (this.stopped) return;
    if (result === 'success') { this.attempts = 0; this.cancelRetry(); }
    if (result === 'retry' && !this.retry) {
      const delay = Math.min(30_000, 2_000 * 2 ** Math.min(this.attempts++, 5)) * (0.5 + this.random() * 0.5);
      this.retry = this.timers.setTimeout(() => { this.retry = undefined; void this.trigger(); }, delay);
    }
    return result;
  }
  private cancelRetry() { if (this.retry) this.timers.clearTimeout(this.retry); this.retry = undefined; }
  stop() {
    this.stopped = true;
    this.cancelRetry();
    if (this.interval) this.timers.clearInterval(this.interval);
    this.interval = undefined;
  }
}
