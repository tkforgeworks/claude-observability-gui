/**
 * Line chart showing daily average Cowork turn duration with 7-day
 * moving average overlay. Summary metrics below with trend direction.
 * @see CGUI-25
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { TurnDurationDay } from '../../../shared/ipc-types';

interface TurnDurationChartProps {
  data: TurnDurationDay[];
}

const COLORS = {
  daily: '#6688cc',
  ma7: '#cc6688',
  grid: '#2a2a3e',
  axis: '#6666aa',
  bg: '#16162a',
  trendUp: '#cc6666',
  trendDown: '#66cc88',
  neutral: '#8888aa',
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ChartDataPoint {
  date: string;
  label: string;
  avgDuration: number | null;
  ma7: number | null;
  turnCount: number;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number | null;
  color: string;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div style={{
      backgroundColor: '#1a1a2e',
      border: '1px solid #3a3a5e',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{ color: '#ccccdd', fontWeight: 600, marginBottom: 2 }}>{point.label}</div>
      {point.avgDuration != null && (
        <div style={{ color: COLORS.daily }}>Avg: {formatDuration(point.avgDuration)}</div>
      )}
      {point.ma7 != null && (
        <div style={{ color: COLORS.ma7 }}>7d MA: {formatDuration(Math.round(point.ma7))}</div>
      )}
      <div style={{ color: '#666688' }}>{point.turnCount} turn{point.turnCount !== 1 ? 's' : ''}</div>
    </div>
  );
}

const containerStyles: React.CSSProperties = {
  backgroundColor: COLORS.bg,
  borderRadius: 8,
  padding: '16px 16px 8px',
  border: '1px solid #2a2a3e',
};

const titleStyles: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#8888aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: 12,
};

const summaryRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  marginTop: 12,
  padding: '8px 4px 4px',
  borderTop: '1px solid #2a2a3e',
};

const summaryItemStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const summaryLabelStyles: React.CSSProperties = {
  fontSize: 11,
  color: '#666688',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.3px',
};

const summaryValueStyles: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#ccccdd',
};

export default function TurnDurationChart({ data }: TurnDurationChartProps): React.JSX.Element | null {
  const { chartData, todayAvg, avg7d, avg30d } = useMemo(() => {
    // Build chart data with 7-day moving average
    const points: ChartDataPoint[] = [];
    const durations = data.map(d => d.avgDurationSeconds);

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      // 7-day MA: average of last 7 days that have data
      let ma7: number | null = null;
      if (i >= 6) {
        const window = durations.slice(i - 6, i + 1).filter(v => v > 0);
        if (window.length > 0) {
          ma7 = window.reduce((a, b) => a + b, 0) / window.length;
        }
      }

      points.push({
        date: d.date,
        label: formatDateLabel(d.date),
        avgDuration: d.turnCount > 0 ? d.avgDurationSeconds : null,
        ma7,
        turnCount: d.turnCount,
      });
    }

    // Summary averages
    const daysWithData = data.filter(d => d.turnCount > 0);
    const todayEntry = daysWithData[daysWithData.length - 1];
    const todayAvg = todayEntry?.avgDurationSeconds ?? null;

    const last7 = daysWithData.filter(d => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return new Date(d.date + 'T00:00:00') >= cutoff;
    });
    const avg7d = last7.length > 0
      ? Math.round(last7.reduce((s, d) => s + d.avgDurationSeconds, 0) / last7.length)
      : null;

    const last30 = daysWithData.filter(d => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return new Date(d.date + 'T00:00:00') >= cutoff;
    });
    const avg30d = last30.length > 0
      ? Math.round(last30.reduce((s, d) => s + d.avgDurationSeconds, 0) / last30.length)
      : null;

    return { chartData: points, todayAvg, avg7d, avg30d };
  }, [data]);

  const hasAnyData = data.some(d => d.turnCount > 0);
  if (!hasAnyData) return null;

  // Trend: compare 7d to 30d. Down = faster (good), Up = slower
  let trendSymbol = '';
  let trendColor = COLORS.neutral;
  if (avg7d != null && avg30d != null && avg30d > 0) {
    const diff = avg7d - avg30d;
    const pct = Math.abs(diff / avg30d) * 100;
    if (pct >= 5) {
      if (diff < 0) {
        trendSymbol = ' ↓';
        trendColor = COLORS.trendDown;
      } else {
        trendSymbol = ' ↑';
        trendColor = COLORS.trendUp;
      }
    }
  }

  // Thin out X-axis labels for longer ranges
  const tickInterval = data.length > 60 ? 13 : data.length > 14 ? 6 : 1;

  return (
    <div style={containerStyles}>
      <div style={titleStyles}>Turn Duration Trend</div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={(v: number) => formatDuration(v)}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: COLORS.axis }}
          />
          <Line
            type="monotone"
            dataKey="avgDuration"
            name="Daily avg"
            stroke={COLORS.daily}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="ma7"
            name="7-day MA"
            stroke={COLORS.ma7}
            strokeWidth={2}
            dot={false}
            strokeDasharray="6 3"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={summaryRowStyles}>
        {todayAvg != null && (
          <div style={summaryItemStyles}>
            <span style={summaryLabelStyles}>Today</span>
            <span style={summaryValueStyles}>{formatDuration(todayAvg)}</span>
          </div>
        )}
        {avg7d != null && (
          <div style={summaryItemStyles}>
            <span style={summaryLabelStyles}>7d avg</span>
            <span style={{ ...summaryValueStyles, color: trendColor }}>
              {formatDuration(avg7d)}{trendSymbol}
            </span>
          </div>
        )}
        {avg30d != null && (
          <div style={summaryItemStyles}>
            <span style={summaryLabelStyles}>30d avg</span>
            <span style={summaryValueStyles}>{formatDuration(avg30d)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
