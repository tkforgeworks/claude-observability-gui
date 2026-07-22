import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { UsageSnapshot } from '../../shared/ipc-types';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

function injectResetPoints(snapshots: UsageSnapshot[], isShortRange: boolean): ChartPoint[] {
  if (snapshots.length === 0) return [];

  const points: ChartPoint[] = [];
  const nowIso = new Date().toISOString();
  const fmt = isShortRange ? formatTime : formatDateTime;

  for (let i = 0; i < snapshots.length; i++) {
    const curr = snapshots[i];
    const nextCapturedAt = i < snapshots.length - 1 ? snapshots[i + 1].captured_at : nowIso;

    const fiveHourAtCapture = effectivePctAtCapture(curr.five_hour_pct, curr.five_hour_resets_at, curr.captured_at);
    const sevenDayAtCapture = effectivePctAtCapture(curr.seven_day_pct, curr.seven_day_resets_at, curr.captured_at);

    points.push({
      time: curr.captured_at,
      label: fmt(curr.captured_at),
      fiveHour: fiveHourAtCapture,
      sevenDay: sevenDayAtCapture,
      polled: true,
      fiveHourDot: fiveHourAtCapture,
      sevenDayDot: sevenDayAtCapture,
    });

    const resets: Array<{ time: string; which: 'fiveHour' | 'sevenDay' }> = [];

    if (curr.five_hour_resets_at
        && curr.five_hour_resets_at > curr.captured_at
        && curr.five_hour_resets_at < nextCapturedAt
        && fiveHourAtCapture > 0) {
      resets.push({ time: curr.five_hour_resets_at, which: 'fiveHour' });
    }

    if (curr.seven_day_resets_at
        && curr.seven_day_resets_at > curr.captured_at
        && curr.seven_day_resets_at < nextCapturedAt
        && sevenDayAtCapture > 0) {
      resets.push({ time: curr.seven_day_resets_at, which: 'sevenDay' });
    }

    if (resets.length === 0) continue;

    resets.sort((a, b) => a.time.localeCompare(b.time));

    let fiveHour = fiveHourAtCapture;
    let sevenDay = sevenDayAtCapture;

    for (const reset of resets) {
      if (reset.which === 'fiveHour') fiveHour = 0;
      else sevenDay = 0;

      points.push({
        time: reset.time,
        label: fmt(reset.time),
        fiveHour,
        sevenDay,
        polled: false,
      });
    }
  }

  return points;
}

interface ChartPoint {
  time: string;
  label: string;
  fiveHour: number;
  sevenDay: number;
  polled: boolean;
  fiveHourDot?: number;
  sevenDayDot?: number;
}

interface TooltipEntry {
  payload: ChartPoint;
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
        {point.label}{!point.polled ? ' (inferred)' : ''}
      </div>
      <div style={{ color: 'var(--chart-1)' }}>5h: {point.fiveHour.toFixed(1)}%</div>
      <div style={{ color: 'var(--chart-4)' }}>7d: {point.sevenDay.toFixed(1)}%</div>
    </div>
  );
}

export default function UsageView(): React.JSX.Element {
  const [latest, setLatest] = useState<UsageSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = useCallback(() => {
    return Promise.all([
      window.api.usageSnapshots.getLatest().then(setLatest),
      window.api.usageSnapshots.getRecent(hours).then(setSnapshots),
    ]).catch(err => {
      console.error('[UsageView] fetch failed:', err);
    });
  }, [hours]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    return window.api.onUsageSnapshot((snapshot) => {
      setLatest(snapshot);
      fetchData();
    });
  }, [fetchData]);

  const chartData: ChartPoint[] = useMemo(
    () => injectResetPoints(snapshots, hours <= 24),
    [snapshots, hours]
  );

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading…</div>;
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

  const recentPoints = chartData.slice(-20);
  const fiveHourSpark = recentPoints.map(p => p.fiveHour);
  const sevenDaySpark = recentPoints.map(p => p.sevenDay);

  const maxPct = Math.max(
    ...chartData.map(d => Math.max(d.fiveHour, d.sevenDay)),
    10,
  );
  const yMax = Math.min(Math.ceil(maxPct / 5) * 5, 100);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 5) yTicks.push(v);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <StatCard
          label="5-Hour Usage"
          value={effectiveFiveHour !== null ? `${effectiveFiveHour.toFixed(1)}%` : '—'}
          meta={fiveHourMeta}
          icon={Icons.bolt}
          sparkData={fiveHourSpark}
          sparkColor="var(--chart-1)"
        />
        <StatCard
          label="7-Day Usage"
          value={effectiveSevenDay !== null ? `${effectiveSevenDay.toFixed(1)}%` : '—'}
          meta={sevenDayMeta}
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

      {/* History chart */}
      {chartData.length > 1 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Usage History
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad5h" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad7d" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, yMax]}
                ticks={yTicks}
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="fiveHour"
                name="5-Hour"
                stroke="var(--chart-1)"
                fill="url(#grad5h)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="sevenDay"
                name="7-Day"
                stroke="var(--chart-4)"
                fill="url(#grad7d)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
              <Scatter
                dataKey="fiveHourDot"
                name="5h polled"
                fill="var(--chart-1)"
                r={3}
                isAnimationActive={false}
              />
              <Scatter
                dataKey="sevenDayDot"
                name="7d polled"
                fill="var(--chart-4)"
                r={3}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
