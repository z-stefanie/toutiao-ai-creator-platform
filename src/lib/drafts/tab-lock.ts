type LockCallbacks = {
  acquired: () => Promise<void>;
  released: () => Promise<void>;
  waiting: () => void;
  failed: (error: unknown) => void;
};

export class DraftTabLock {
  private abort = new AbortController();
  private release?: () => void;
  private task?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private name: string, private callbacks: LockCallbacks) {}

  start() {
    this.task = this.run().catch((error) => { if (!this.abort.signal.aborted) this.callbacks.failed(error); });
  }
  private async hold() {
    if (this.timer) clearTimeout(this.timer);
    if (this.abort.signal.aborted) return;
    const untilReleased = new Promise<void>((resolve) => { this.release = resolve; });
    try {
      await this.callbacks.acquired();
      if (!this.abort.signal.aborted) await untilReleased;
    } finally {
      await this.callbacks.released();
      this.release = undefined;
    }
  }
  private async run() {
    if (!navigator.locks) { await this.hold(); return; }
    this.timer = setTimeout(() => this.callbacks.waiting(), 300);
    let acquired = false;
    await navigator.locks.request(this.name, { ifAvailable: true }, async (lock) => {
      if (lock) { acquired = true; await this.hold(); }
    });
    if (!acquired && !this.abort.signal.aborted) {
      await navigator.locks.request(this.name, { signal: this.abort.signal }, () => this.hold());
    }
  }
  async stop() {
    this.abort.abort();
    if (this.timer) clearTimeout(this.timer);
    this.release?.();
    await this.task;
  }
}
