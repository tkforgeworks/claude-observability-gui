import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { UsageSnapshot } from '../../shared/ipc-types';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';
import { useApi } from '../hooks/useApi';

const RANGE_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
  '90d': 2160,
  'All': 999999,
};

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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

  const { data, loading, error, refetch } = useApi(
    () =>
      Promise.all([
        window.api.usageSnapshots.getLatest(),
        window.api.usageSnapshots.getRecent(hours),
      ]),
    [hours]
  );
  const [latest, snapshots] = data ?? [null, []];

  useEffect(() => {
    return window.api.onUsageSnapshot(() => {
      refetch();
    });
  }, [refetch]);

  // Oldest-first, matching getRecent ordering; pct zeroed when the window
  // had already reset at capture time (stale resets_at in the source file).
  const historyRows: HistoryRow[] = useMemo(
    () => snapshots.map(s => ({
      snapshot: s,
      fiveHour: effectivePctAtCapture(s.five_hour_pct, s.five_hour_resets_at, s.captured_at),
      sevenDay: effectivePctAtCapture(s.seven_day_pct, s.seven_day_resets_at, s.captured_at),
    })),
    [snapshots]
  );

  if (loading && !data) {
    return (
      <div style={{ padding: 24 }}>
        <Loading label="usage data" compact />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <ErrorState what="usage data" error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!latest && snapshots.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState
          title="No usage data yet"
          message="Usage data will appear after your first Claude Code session. The app polls for usage limits every 5 minutes."
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

  const recentRows = historyRows.slice(-20);
  const fiveHourSpark = recentRows.map(r => r.fiveHour);
  const sevenDaySpark = recentRows.map(r => r.sevenDay);

  // Highest value seen across the selected range, from the same
  // effective-at-capture values the history table shows.
  const fiveHourPeak = historyRows.length > 0 ? Math.max(...historyRows.map(r => r.fiveHour)) : null;
  const sevenDayPeak = historyRows.length > 0 ? Math.max(...historyRows.map(r => r.sevenDay)) : null;

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

  const stickyHeader: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    background: 'var(--surface)',
    zIndex: 1,
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <StatCard
          label="5-Hour Usage"
          value={effectiveFiveHour !== null ? `${effectiveFiveHour.toFixed(1)}%` : '—'}
          meta={fiveHourMeta}
          subMeta={fiveHourPeak !== null ? `Peak usage in window: ${fiveHourPeak.toFixed(1)}%` : undefined}
          icon={Icons.bolt}
          sparkData={fiveHourSpark}
          sparkColor="var(--chart-1)"
        />
        <StatCard
          label="7-Day Usage"
          value={effectiveSevenDay !== null ? `${effectiveSevenDay.toFixed(1)}%` : '—'}
          meta={sevenDayMeta}
          subMeta={sevenDayPeak !== null ? `Peak usage in window: ${sevenDayPeak.toFixed(1)}%` : undefined}
          icon={Icons.clock}
          sparkData={sevenDaySpark}
          sparkColor="var(--chart-4)"
        />
      </div>

      {/* Staleness notice */}
      {isStale && latest && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          <Icons.clock style={{ flexShrink: 0 }} />
          <span>
            Last snapshot {formatDateTime(latest.captured_at)} — usage limits only refresh
            while a Claude Code session is active.
          </span>
        </div>
      )}

      {/* History table */}
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
