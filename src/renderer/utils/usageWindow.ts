/**
 * Window-aligned series for the Usage view sparklines (CGUI-72).
 *
 * A usage limit is a fixed window ending at `resets_at`: 5 hours for the
 * five-hour limit, 7 days for the weekly one. Usage inside a window only ever
 * accumulates until the reset, so a sparkline for a card should cover exactly
 * that window — not "the last N snapshots", which at a 60s poll is a
 * 20-minute slice of a 7-day accumulator (flat by construction) or, when the
 * poller only ran during a few short sessions, a handful of points scattered
 * across several windows (a lone spike surrounded by zeroes).
 *
 * Snapshots are sparse by design (UsageLimitWatcher only captures while a
 * Claude Code session keeps cship's files fresh), so the series is bucketed
 * over the window's elapsed time rather than plotted per sample:
 *
 *   - buckets before the first in-window snapshot are `null` (unknown, not 0)
 *   - buckets with no snapshot carry the last known value forward — usage is
 *     monotonic within a window, so this is a truthful lower bound and reads
 *     as the flat stretch it actually was
 *   - buckets after `now` are `null`, so the line ends at "now" and its length
 *     shows how far into the window we are
 *
 * A snapshot whose own `resets_at` had already passed when it was captured is
 * a stale source file and means "unknown", so it is skipped rather than drawn
 * as 0 (which would break the monotonic shape with a false dip).
 */

export interface WindowSample {
  /** captured_at, epoch ms */
  t: number;
  /** raw percentage reported by the snapshot */
  pct: number;
  /** the snapshot's own resets_at, epoch ms (null when the limit is absent) */
  resetsAt: number | null;
}

export interface WindowSeriesOptions {
  /** end of the current window (latest snapshot's resets_at), epoch ms */
  windowEnd: number;
  /** window length in ms (5h or 7d) */
  windowMs: number;
  /** epoch ms of "now" — buckets past this are unknown */
  now: number;
  /** number of equal-width buckets across the window */
  buckets?: number;
}

export const DEFAULT_SPARK_BUCKETS = 60;

/**
 * How far a sample's own `resets_at` may sit from the window end and still be
 * "the same window" (CGUI-93). Within one window cship reports the reset with
 * only seconds of jitter, but the *rounding* of `resets_at` has changed over
 * time (unrounded in older data, hour-aligned now), so consecutive windows
 * can be reported such that the previous window's tail lands inside
 * `[windowEnd − windowMs, windowEnd]` by capture time alone. Those samples
 * belong to a window that reset ≥ windowMs − rounding earlier, so an hour is
 * comfortably below that gap for both the 5h and 7d limits while absorbing
 * every observed jitter. Mirrors the reset-marker dedup in UsageView.
 */
export const RESET_MATCH_TOLERANCE_MS = 60 * 60_000;

/**
 * Snapshots that belong to the window: captured inside it, reporting (within
 * tolerance) this window's reset, and not stale at capture.
 */
export function samplesInWindow(samples: WindowSample[], windowEnd: number, windowMs: number): WindowSample[] {
  const windowStart = windowEnd - windowMs;
  return samples.filter(s =>
    s.t >= windowStart
    && s.t <= windowEnd
    && s.resetsAt !== null
    && s.resetsAt > s.t
    && Math.abs(s.resetsAt - windowEnd) <= RESET_MATCH_TOLERANCE_MS
  );
}

/**
 * Bucketed, carry-forward series across the window. Returns an empty array
 * when the window has already ended (nothing current to draw) or when it has
 * no usable samples.
 */
export function buildWindowSeries(samples: WindowSample[], opts: WindowSeriesOptions): Array<number | null> {
  const { windowEnd, windowMs, now } = opts;
  const buckets = opts.buckets ?? DEFAULT_SPARK_BUCKETS;
  if (!(windowMs > 0) || buckets < 1) return [];
  if (windowEnd <= now) return [];

  const inWindow = samplesInWindow(samples, windowEnd, windowMs);
  if (inWindow.length === 0) return [];

  const windowStart = windowEnd - windowMs;
  const bucketMs = windowMs / buckets;
  // Last sample per bucket wins: samples are monotonic within a window, so
  // "last" and "max" agree, and last is what the poll would show anyway.
  const lastPerBucket: Array<number | null> = new Array(buckets).fill(null);
  for (const s of inWindow) {
    const idx = Math.min(buckets - 1, Math.floor((s.t - windowStart) / bucketMs));
    lastPerBucket[idx] = s.pct;
  }

  const nowIdx = Math.min(buckets - 1, Math.floor((now - windowStart) / bucketMs));
  const out: Array<number | null> = new Array(buckets).fill(null);
  let carry: number | null = null;
  for (let i = 0; i <= nowIdx; i++) {
    const v = lastPerBucket[i];
    if (v !== null) carry = v;
    out[i] = carry;
  }
  return out;
}
