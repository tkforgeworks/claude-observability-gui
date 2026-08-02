/**
 * Shared display formatters for the renderer.
 *
 * These were previously duplicated across ~25 view and chart files with
 * divergent behavior — `formatCost(0)` alone returned "$0", "—" and
 * "$0.0000" depending on which copy you hit. Import from here instead of
 * redefining; if a call site needs different behavior, add an option rather
 * than a local copy.
 *
 * Null vs zero convention (CGUI-70): `null`/`undefined` means "no data" and
 * renders as an em dash; a real `0` renders as a real zero. Callers must pass
 * `null` for missing values rather than coercing to 0, or the distinction is
 * lost before it reaches these functions.
 *
 * @see CGUI-70
 */

/** Rendered for any null/undefined value — "we have no data", not "zero". */
export const DASH = '—';

// ---------------------------------------------------------------------------
// Money and counts
// ---------------------------------------------------------------------------

/**
 * USD cost. Sub-cent values keep 4 decimals so per-session costs don't all
 * collapse to "$0.00"; everything else uses 2.
 */
export function formatCost(n: number | null | undefined): string {
  if (n == null) return DASH;
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/** Token counts, abbreviated with a lowercase k/M suffix. */
export function formatTokens(n: number | null | undefined): string {
  if (n == null) return DASH;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

/** Byte counts for file and database sizes. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return DASH;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

/**
 * A duration in seconds.
 *
 * - `hms` (default): "2h 5m", "5m 19s", "46s" — for precise per-turn values
 * - `hm`: "2h 5m", "5m", "<1m" — for coarse session-level values
 *
 * Seconds are rounded before the modulo. The previous copy in
 * CoworkSessionsView took `seconds % 60` on a fractional input and rendered
 * "1m 30.699999999999996s".
 */
export function formatDuration(
  seconds: number | null | undefined,
  opts: { style?: 'hms' | 'hm' } = {}
): string {
  if (seconds == null) return DASH;
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (opts.style === 'hm') {
    if (total < 60) return '<1m';
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** An elapsed-milliseconds measurement, e.g. an import or scan duration. */
export function formatElapsed(ms: number | null | undefined): string {
  if (ms == null) return DASH;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return formatDuration(ms / 1000);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Local-calendar `YYYY-MM-DD` for a Date.
 *
 * The renderer-side counterpart to `localDateStr()` in the main process's
 * `db/queries.ts` — the two compilation targets never share runtime code, so
 * the helper is duplicated deliberately. Never use
 * `toISOString().slice(0, 10)` for a day key: it buckets in UTC and shifts
 * evening sessions to the next day (CGUI-52).
 */
export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "Aug 1, 11:05 PM" — timestamp with time of day. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** "Aug 1, 2026" — calendar date with year, no time. */
export function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** "11:05 PM" — time of day only. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Parses a `YYYY-MM-DD` chart key as a local date.
 *
 * Anchored at noon, not midnight: the offset keeps the date correct in every
 * zone while avoiding the handful where local midnight doesn't exist on a DST
 * transition day and the clock jumps to the next date. A bare `new Date(key)`
 * would parse as UTC and shift the label backwards west of Greenwich.
 */
function parseDayKey(dateKey: string): Date {
  return new Date(dateKey + 'T12:00:00');
}

/** "Aug 1" for a `YYYY-MM-DD` chart key. */
export function formatDayLabel(dateKey: string): string {
  return parseDayKey(dateKey).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
}

/** "Fri, Aug 1, 2026" for a `YYYY-MM-DD` chart key. */
export function formatDayLabelFull(dateKey: string): string {
  return parseDayKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** "Fri, Aug 1" for a `YYYY-MM-DD` chart key. */
export function formatDayLabelWithWeekday(dateKey: string): string {
  return parseDayKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** "Fri" — weekday only, for a `YYYY-MM-DD` chart key. */
export function formatWeekday(dateKey: string): string {
  return parseDayKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * An hour-of-day number (0–23).
 *
 * - `long` (default): "12 AM", "3 PM" — for readable stat lines
 * - `compact`: "12a", "3p" — for dense axis ticks where width is scarce
 */
export function formatHour(hour: number, opts: { style?: 'long' | 'compact' } = {}): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 || 12;
  return opts.style === 'compact'
    ? `${h12}${suffix[0].toLowerCase()}`
    : `${h12} ${suffix}`;
}

// ---------------------------------------------------------------------------
// Models and paths
// ---------------------------------------------------------------------------

/**
 * "claude-opus-4-6" → "opus-4-6", "claude-haiku-4-5-20251001" → "haiku-4-5".
 *
 * The version capture is bounded to two numeric groups on purpose: a greedy
 * `(?:-\d+)*` swallows the trailing release date on dated ids like
 * haiku-4-5-20251001, and the result overflows the 90px model column.
 *
 * Keeping the family list explicit (rather than just stripping a "claude-"
 * prefix) means an unrecognized id falls through unchanged instead of being
 * silently mangled — `fable` is in the list because the pre-CGUI-70 copies
 * omitted it and rendered the full id.
 */
export function shortenModel(model: string | null | undefined): string {
  if (!model) return DASH;
  const match = model.match(/(fable|opus|sonnet|haiku)-(\d+(?:-\d+)?)/i);
  if (match) return `${match[1].toLowerCase()}-${match[2]}`;
  return model.replace(/^claude-/, '');
}

/** Trims a filesystem project path down to its last two segments. */
export function formatProjectName(p: string | null | undefined): string {
  if (!p) return DASH;
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join('/');
}

// ---------------------------------------------------------------------------
// Ranges and chart ticks
// ---------------------------------------------------------------------------

/**
 * "All" is expressed as a very wide day window rather than a sentinel so
 * every range flows through the same day-count query parameter.
 */
export const ALL_RANGE_DAYS = 3650;

export const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  'All': ALL_RANGE_DAYS,
};

/** Days for a range label, falling back to 30 for an unknown label. */
export function rangeDays(label: string): number {
  return RANGE_DAYS[label] ?? 30;
}

/**
 * Recharts `interval` for a daily X axis — thins labels so a 90-day or
 * 1-year series doesn't overlap its own ticks.
 */
export function dateTickInterval(pointCount: number): number {
  if (pointCount > 60) return 13;
  if (pointCount > 14) return 6;
  return 1;
}

/**
 * Shared Y-axis width for the stacked Trends widgets. They previously used
 * 35/40/50 independently, so their plot areas started at different x offsets
 * and the cards read as misaligned when stacked.
 */
export const CHART_Y_AXIS_WIDTH = 50;
