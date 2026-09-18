import type { RawFix, SportType } from "@stride/core";
import type { LocationSource, RecorderStatus } from "./types";

/**
 * Plays a fixed array of fixes back on a timer, at up to 60x speed,
 * through the exact same LocationSource interface a real device uses.
 * This is what makes the recorder state machine, live stats and
 * auto-pause/gap logic testable and deterministic without a device — the
 * same fixture-driven approach packages/core's own tests use, just fed
 * through the recorder instead of straight into processActivity().
 */
export class ReplaySource implements LocationSource {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private index = 0;
  private listeners = new Set<(fix: RawFix) => void>();
  private tracking = false;
  private lastFix: RawFix | null = null;

  constructor(
    private readonly fixture: readonly RawFix[],
    private readonly speedMultiplier = 1,
  ) {}

  async start(_sport: SportType): Promise<void> {
    this.tracking = true;
    this.index = 0;
    this.scheduleNext();
  }

  async stop(): Promise<void> {
    this.tracking = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  onFix(listener: (fix: RawFix) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async readPersistedFixes(_sinceTs: number): Promise<RawFix[]> {
    // The replay source has no separate native persistence layer to
    // recover from — every fix it emits already reaches onFix listeners
    // directly, so there's nothing additional to reconcile.
    return [];
  }

  async clearPersistedFixes(): Promise<void> {}

  async updateNotificationText(_text: string): Promise<void> {}

  async getStatus(): Promise<RecorderStatus> {
    return {
      isTracking: this.tracking,
      lastFixAt: this.lastFix?.ts ?? null,
      lastAccuracyM: this.lastFix?.hAcc ?? null,
    };
  }

  private scheduleNext(): void {
    if (!this.tracking || this.index >= this.fixture.length) return;

    const fix = this.fixture[this.index]!;
    const prev = this.fixture[this.index - 1];
    const realDelayMs = prev ? fix.ts - prev.ts : 0;
    const delayMs = Math.max(0, realDelayMs / this.speedMultiplier);

    this.timer = setTimeout(() => {
      this.lastFix = fix;
      for (const listener of this.listeners) listener(fix);
      this.index++;
      this.scheduleNext();
    }, delayMs);
  }
}
