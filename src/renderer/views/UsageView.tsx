import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { UsageSnapshot } from '../../shared/ipc-types';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';
import { useApi } from '../hooks/useApi';
import { formatDateTime } from '../utils/format';
import { buildWindowSeries } from '../utils/usageWindow';
import type { WindowSample } from '../utils/usageWindow';

const RANGE_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
  '90d': 2160,
  'All': 999999,
};

const FIVE_HOUR_MS = 5 * 60 * 60_000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60_000;
// The 7-day card's sparkline needs the whole current 7-day window regardless
// of the selected range, so the fetch never asks for less than that; the
// history table is then filtered down to the range client-side (CGUI-72).
const SPARK_FETCH_HOURS = SEVEN_DAY_MS / 3_600_000;

function formatResetCountdown(resetsAt: string | null): string {
  if (!resetsAt) return 'no limit';
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (ms <= 0) return 'resetting';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `resets ${h}h ${m}m`;
  return `resets ${m}m`;
}

function getEffectivePct(pct: number, resetsAt: string | null): number {
  if (!resetsAt) return pct;
  return new Date(resetsAt).getTime() <= Date.now() ? 0 : pct;
}

function effectivePctAtCapture(pct: number, resetsAt: string | null, capturedAt: string): number {
  if (!resetsAt) return pct;
  return resetsAt <= capturedAt ? 0 : pct;
}

interface HistoryRow {
  snapshot: UsageSnapshot;
  fiveHour: number;
  sevenDay: number;
}

interface ResetRow {
  t: number; // epoch ms
  which: 'fiveHour' | 'sevenDay';
  resetsAt: string;
}

type TableEntry =
  | { key: string; t: number; kind: 'snapshot'; row: HistoryRow }
  | { key: string; t: number; kind: 'reset'; reset: ResetRow };

/**
 * Derives historical window-reset markers from the resets_at each snapshot
 * reported. Only resets already in the past are emitted (never future ones),
 * deduped to a single row per window reset. Consecutive real resets of the
 * same window are ≥5h (or 7d) apart, so reported times closer together than
 * RESET_DEDUP_MS are the same reset with polling jitter — the first-seen
 * time wins. Recomputed on every load, so a reset that passed while the app
 * was closed appears after restart.
 */
const RESET_DEDUP_MS = 60 * 60_000;

function deriveResetRows(rows: HistoryRow[], nowMs: number): ResetRow[] {
  const lastEmitted: Record<ResetRow['which'], number> = { fiveHour: -Infinity, sevenDay: -Infinity };
  const out: ResetRow[] = [];
  for (const { snapshot: s, fiveHour, sevenDay } of rows) {
    const candidates: Array<{ which: ResetRow['which']; at: string | null; pct: number }> = [
      { which: 'fiveHour', at: s.five_hour_resets_at, pct: fiveHour },
      { which: 'sevenDay', at: s.seven_day_resets_at, pct: sevenDay },
    ];
    for (const c of candidates) {
      if (!c.at || c.pct <= 0) continue; // nothing to reset
      if (c.at <= s.captured_at) continue; // already past at capture
      const t = Date.parse(c.at);
      if (t > nowMs) continue; // never show future resets
      if (Math.abs(t - lastEmitted[c.which]) < RESET_DEDUP_MS) continue; // jitter on an already-emitted reset
      lastEmitted[c.which] = t;
      out.push({ t, which: c.which, resetsAt: c.at });
    }
  }
  return out;
}

export default function UsageView(): React.JSX.Element {
  const { setRangeControls, clearRangeControls } = useTopbar();
  const [rangeLabel, setRangeLabel] = useState('24h');

  const handleRangeChange = useCallback((range: string) => {
    setRangeLabel(range);
  }, []);

  useEffect(() => {
    setRangeControls(rangeLabel, handleRangeChange);
    return clearRangeControls;
  }, [rangeLabel, handleRangeChange, setRangeControls, clearRangeControls]);

  const hours = RANGE_HOURS[rangeLabel] ?? 24;
  const fetchHours = Math.max(hours, SPARK_FETCH_HOURS);

  const { data, loading, error, refetch } = useApi(
    () =>
      Promise.all([
        window.api.usageSnapshots.getLatest(),
        window.api.usageSnapshots.getRecent(fetchHours),
      ]),
    [fetchHours]
  );
  const [latest, fetched] = data ?? [null, []];

  useEffect(() => {
    return window.api.onUsageSnapshot(() => {
      refetch();
    });
  }, [refetch]);

  // Reset countdowns and the staleness check are derived from Date.now() at
  // render time, so with no new snapshots arriving nothing re-rendered: the
  // countdown froze and the staleness notice could appear late or never.
  // A minute tick is enough for both — they're displayed to the minute.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Snapshots inside the selected range, oldest-first (getRecent ordering);
  // pct zeroed when the window had already reset at capture time (stale
  // resets_at in the source file). `fetched` may reach further back than the
  // range to feed the sparklines — the table only shows what's in range.
  const snapshots = useMemo(() => {
    const cutoff = Date.now() - hours * 3_600_000;
    return fetched.filter(s => Date.parse(s.captured_at) >= cutoff);
  }, [fetched, hours]);

  const historyRows: HistoryRow[] = useMemo(
    () => snapshots.map(s => ({
      snapshot: s,
      fiveHour: effectivePctAtCapture(s.five_hour_pct, s.five_hour_resets_at, s.captured_at),
      sevenDay: effectivePctAtCapture(s.seven_day_pct, s.seven_day_resets_at, s.captured_at),
    })),
    [snapshots]
  );

  // Sparkline samples come from everything fetched, not the range: each
  // card's line covers its own limit window (5h / 7d ending at the latest
  // resets_at), which is independent of the history range selector.
  const fiveHourSamples: WindowSample[] = useMemo(
    () => fetched.map(s => ({
      t: Date.parse(s.captured_at),
      pct: s.five_hour_pct,
      resetsAt: s.five_hour_resets_at ? Date.parse(s.five_hour_resets_at) : null,
    })),
    [fetched]
  );
  const sevenDaySamples: WindowSample[] = useMemo(
    () => fetched.map(s => ({
      t: Date.parse(s.captured_at),
      pct: s.seven_day_pct,
      resetsAt: s.seven_day_resets_at ? Date.parse(s.seven_day_resets_at) : null,
    })),
    [fetched]
  );

  if (loading && !data) {
    return (
      <div className="page">
        <Loading label="usage data" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState what="usage data" error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!latest && fetched.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="No usage data yet"
          message="Usage data will appear after your first Claude Code session. Usage limits are only published while a session is running, and the app polls for them every 60 seconds by default."
        />
      </div>
    );
  }

  const STALE_AFTER_MS = 15 * 60_000;
  const isStale = latest !== null
    && Date.now() - new Date(latest.captured_at).getTime() > STALE_AFTER_MS;

  const effectiveFiveHour = latest ? getEffectivePct(latest.five_hour_pct, latest.five_hour_resets_at) : null;
  const effectiveSevenDay = latest ? getEffectivePct(latest.seven_day_pct, latest.seven_day_resets_at) : null;

  const fiveHourMeta = latest ? formatResetCountdown(latest.five_hour_resets_at) : '';
  const sevenDayMeta = latest ? formatResetCountdown(latest.seven_day_resets_at) : '';

  // Window-aligned sparklines (CGUI-72): each line spans the card's own
  // current limit window and ends at "now". Empty when the window has already
  // reset (nothing current to draw) or has no usable samples — StatCard then
  // renders without a sparkline rather than showing a stale one.
  const now = Date.now();
  const fiveHourSpark = latest?.five_hour_resets_at
    ? buildWindowSeries(fiveHourSamples, { windowEnd: Date.parse(latest.five_hour_resets_at), windowMs: FIVE_HOUR_MS, now })
    : [];
  const sevenDaySpark = latest?.seven_day_resets_at
    ? buildWindowSeries(sevenDaySamples, { windowEnd: Date.parse(latest.seven_day_resets_at), windowMs: SEVEN_DAY_MS, now })
    : [];

  // Highest value seen across the selected range, from the same
  // effective-at-capture values the history table shows. Deliberately
  // range-scoped, not window-scoped: usage only accumulates inside a window,
  // so "peak in the current window" would always equal the current value.
  // The label says so (CGUI-72).
  const fiveHourPeak = historyRows.length > 0 ? Math.max(...historyRows.map(r => r.fiveHour)) : null;
  const sevenDayPeak = historyRows.length > 0 ? Math.max(...historyRows.map(r => r.sevenDay)) : null;
  const peakLabel = rangeLabel === 'All' ? 'All-time peak' : `Peak in last ${rangeLabel}`;

  const resetRows = deriveResetRows(historyRows, Date.now());
  const tableEntries: TableEntry[] = [
    ...historyRows.map((row): TableEntry => ({
      key: `s${row.snapshot.id}`,
      t: Date.parse(row.snapshot.captured_at),
      kind: 'snapshot',
      row,
    })),
    ...resetRows.map((reset): TableEntry => ({
      key: `r-${reset.which}-${reset.resetsAt}`,
      t: reset.t,
      kind: 'reset',
      reset,
    })),
  ].sort((a, b) => b.t - a.t);

  // A sticky <th> loses its bottom border under border-collapse — the border
  // belongs to the collapsed grid, which scrolls away. An inset shadow is
  // painted by the cell itself and survives (CGUI-70).
  const stickyHeader: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    background: 'var(--surface)',
    boxShadow: 'inset 0 -1px 0 var(--border-soft)',
    zIndex: 1,
  };

  return (
    <div className="page">
      {/* Stat cards. Uses the shared .stats-grid rather than an ad-hoc grid so
          the cards match every other view's; two cards need a wider track
          than the default, hence the override (CGUI-70). */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
        <StatCard
          label="5-Hour Usage"
          value={effectiveFiveHour !== null ? `${effectiveFiveHour.toFixed(1)}%` : '—'}
          meta={fiveHourMeta}
          subMeta={fiveHourPeak !== null ? `${peakLabel}: ${fiveHourPeak.toFixed(1)}%` : undefined}
          icon={Icons.bolt}
          sparkData={fiveHourSpark}
          sparkColor="var(--chart-1)"
          sparkBaseline={0}
        />
        <StatCard
          label="7-Day Usage"
          value={effectiveSevenDay !== null ? `${effectiveSevenDay.toFixed(1)}%` : '—'}
          meta={sevenDayMeta}
          subMeta={sevenDayPeak !== null ? `${peakLabel}: ${sevenDayPeak.toFixed(1)}%` : undefined}
          icon={Icons.clock}
          sparkData={sevenDaySpark}
          sparkColor="var(--chart-4)"
          sparkBaseline={0}
        />
      </div>

      {/* Staleness notice */}
      {isStale && latest && (
        <div role="status" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(251, 191, 36, 0.10)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--text-primary)',
        }}>
          <Icons.clock style={{ flexShrink: 0 }} />
          <span>
            Last snapshot {formatDateTime(latest.captured_at)} — usage limits only refresh
            while a Claude Code session is active.
          </span>
        </div>
      )}

      {/* History table. An empty *range* is not an empty database (CGUI-70):
          say so instead of silently dropping the card. */}
      {historyRows.length === 0 && (
        <div className="card" style={{ padding: 20 }}>
          <EmptyState
            title={`No snapshots in the last ${rangeLabel}`}
            message={fetched.length > 0
              ? `${fetched.length} older snapshot${fetched.length === 1 ? '' : 's'} on record — widen the range to see them.`
              : 'Older snapshots are on record — widen the range to see them.'}
          />
        </div>
      )}
      {historyRows.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Usage History
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {historyRows.length} snapshot{historyRows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ maxHeight: 440, overflow: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th style={stickyHeader}>Captured</th>
                  <th className="num" style={stickyHeader}>5-Hour</th>
                  <th style={stickyHeader}>5h Resets</th>
                  <th className="num" style={stickyHeader}>7-Day</th>
                  <th style={stickyHeader}>7d Resets</th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map(entry => {
                  if (entry.kind === 'reset') {
                    return (
                      <tr key={entry.key}>
                        <td style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          {formatDateTime(entry.reset.resetsAt)}
                        </td>
                        <td colSpan={4} style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          ↻ {entry.reset.which === 'fiveHour' ? '5-hour' : '7-day'} window reset (inferred)
                        </td>
                      </tr>
                    );
                  }
                  const { snapshot: s, fiveHour, sevenDay } = entry.row;
                  return (
                    <tr key={entry.key}>
                      <td>{formatDateTime(s.captured_at)}</td>
                      <td className="num" style={{ color: 'var(--chart-1)' }}>{fiveHour.toFixed(1)}%</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {s.five_hour_resets_at ? formatDateTime(s.five_hour_resets_at) : '—'}
                      </td>
                      <td className="num" style={{ color: 'var(--chart-4)' }}>{sevenDay.toFixed(1)}%</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {s.seven_day_resets_at ? formatDateTime(s.seven_day_resets_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
