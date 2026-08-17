import { buildWindowSeries, samplesInWindow } from '../usageWindow';
import type { WindowSample } from '../usageWindow';

const H = 3_600_000;
const FIVE_H = 5 * H;
const SEVEN_D = 7 * 24 * H;

// A window that started at t=0 and resets at t=5h; "now" is 3h in.
const END = 5 * H;
const NOW = 3 * H;

function s(t: number, pct: number, resetsAt: number | null = END): WindowSample {
  return { t, pct, resetsAt };
}

describe('samplesInWindow', () => {
  it('keeps only samples captured inside the window and not stale at capture', () => {
    const before = s(-1, 10);
    const inside = s(H, 20);
    const atEnd = s(END, 30); // captured at the reset instant: expired at capture, like the table's zeroing
    const nearEnd = s(END - 1, 30);
    const staleFile = s(2 * H, 5, 2 * H - 1); // resets_at already passed at capture
    const noLimit = s(2 * H, 5, null);
    const after = s(END + 1, 40);
    expect(samplesInWindow([before, inside, atEnd, nearEnd, staleFile, noLimit, after], END, FIVE_H))
      .toEqual([inside, nearEnd]);
  });
});

describe('samplesInWindow reset matching (CGUI-93)', () => {
  it('drops previous-window samples whose capture time falls inside the derived window', () => {
    // Previous 5h window reported an unrounded reset at 7:30; the next window's
    // reset came back hour-rounded as 12:00, so the derived window starts at
    // 7:00 and would otherwise admit the old window's 7:00–7:30 tail.
    const prevEnd = 7.5 * H;
    const end = 12 * H;
    const prevTail = s(7.2 * H, 80, prevEnd);
    const current = s(8 * H, 5, end);
    const jittered = s(9 * H, 6, end + 1500); // sub-second/second-level jitter is the same window
    expect(samplesInWindow([prevTail, current, jittered], end, FIVE_H)).toEqual([current, jittered]);
  });

  it('tolerates a resets_at up to an hour off but no more', () => {
    const end = 12 * H;
    const within = s(9 * H, 6, end + 59 * 60_000);
    const beyond = s(9 * H, 6, end - 61 * 60_000);
    expect(samplesInWindow([within, beyond], end, FIVE_H)).toEqual([within]);
  });
});

describe('buildWindowSeries', () => {
  it('returns an empty series when the window has already reset', () => {
    expect(buildWindowSeries([s(H, 10)], { windowEnd: END, windowMs: FIVE_H, now: END })).toEqual([]);
    expect(buildWindowSeries([s(H, 10)], { windowEnd: END, windowMs: FIVE_H, now: END + 1 })).toEqual([]);
  });

  it('returns an empty series when there are no usable samples', () => {
    expect(buildWindowSeries([], { windowEnd: END, windowMs: FIVE_H, now: NOW })).toEqual([]);
    expect(buildWindowSeries([s(-H, 10), s(END + H, 10)], { windowEnd: END, windowMs: FIVE_H, now: NOW })).toEqual([]);
  });

  it('is null before the first sample, carries forward across gaps, and null after now', () => {
    // 10 buckets of 30 min. Samples at 1h (bucket 2) and 2h (bucket 4); now = 3h (bucket 6).
    const series = buildWindowSeries([s(H, 10), s(2 * H, 25)], { windowEnd: END, windowMs: FIVE_H, now: NOW, buckets: 10 });
    expect(series).toEqual([null, null, 10, 10, 25, 25, 25, null, null, null]);
  });

  it('takes the last sample in a bucket', () => {
    const series = buildWindowSeries(
      [s(H, 10), s(H + 60_000, 12), s(H + 120_000, 14)],
      { windowEnd: END, windowMs: FIVE_H, now: NOW, buckets: 10 }
    );
    expect(series[2]).toBe(14);
  });

  it('never straddles a reset: samples from the previous window are excluded', () => {
    // Previous window reset at t=0; a sample captured at -30min belonged to it,
    // and a stale-file sample at +10min still reporting the old resets_at is
    // unknown, not zero.
    const prevWindow = s(-30 * 60_000, 80, 0);
    const staleAfterReset = s(10 * 60_000, 80, 0);
    const fresh = s(H, 5);
    const series = buildWindowSeries([prevWindow, staleAfterReset, fresh], { windowEnd: END, windowMs: FIVE_H, now: NOW, buckets: 10 });
    expect(series.filter(v => v !== null)).toEqual([5, 5, 5, 5, 5]);
    expect(series[0]).toBeNull();
  });

  it('spans a 7-day window at the same bucket count so it is not flat by construction', () => {
    const end = SEVEN_D;
    const now = 4 * 24 * H;
    const samples = [s(1 * 24 * H, 10, end), s(2 * 24 * H, 30, end), s(3 * 24 * H, 55, end)];
    const series = buildWindowSeries(samples, { windowEnd: end, windowMs: SEVEN_D, now, buckets: 14 });
    // 14 buckets of 12h; days 1,2,3 land in buckets 2,4,6; now (day 4) is bucket 8.
    expect(series).toEqual([null, null, 10, 10, 30, 30, 55, 55, 55, null, null, null, null, null]);
    expect(new Set(series.filter(v => v !== null)).size).toBeGreaterThan(1);
  });

  it('clamps a sample just before windowEnd into the last bucket', () => {
    const series = buildWindowSeries([s(END - 1, 99)], { windowEnd: END, windowMs: FIVE_H, now: END - 1, buckets: 10 });
    expect(series[9]).toBe(99);
  });
});
