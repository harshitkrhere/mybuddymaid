// lib/leads/rate-limit.ts — a sliding-window counter per key, in memory.
//
// Per process: a Vercel function scales to several instances and each keeps its own map, so
// the cap is approximate — enough to blunt a script or a stuck retry loop, not a guarantee.
// That is the stated limitation of the lead route; Turnstile is the next step if the form is
// ever abused. /api/lead keeps two: five requests per address per ten minutes, and one per
// phone number per ten minutes so a double-click does not become two leads and two inbox
// threads.

export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit for the key and says whether it was within the limit. */
  allow(key: string): boolean {
    const t = this.now();
    const since = t - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((x) => x > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(since);
    return true;
  }

  /**
   * Withdraws the most recent hit for a key: the action it counted did not happen (an insert the
   * database refused), so the next attempt must be allowed to try again.
   */
  forget(key: string): void {
    const times = this.hits.get(key);
    if (!times?.length) return;
    times.pop();
    if (times.length) this.hits.set(key, times);
    else this.hits.delete(key);
  }

  /** Drops keys with no hit inside the window, so a long-lived instance does not grow forever. */
  prune(since: number = this.now() - this.windowMs): void {
    for (const [key, times] of this.hits) {
      const kept = times.filter((x) => x > since);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }

  get size(): number {
    return this.hits.size;
  }
}
