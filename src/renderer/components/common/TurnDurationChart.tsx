/**
 * Line chart showing daily average Cowork turn duration with 7-day
 * moving average overlay. Summary metrics below with trend direction.
 * @see CGUI-25 (widget), CGUI-67 (token migration)
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
import { chartAxisTick, chartGridStroke, chartTooltipStyles } from './chartTheme';
import { CHART_Y_AXIS_WIDTH, dateTickInterval, formatDayLabel, formatDuration } from '../../utils/format';

interface TurnDurationChartProps {
  data: TurnDurationDay[];
}

const COLORS = {
  daily: 'var(--chart-1)',
  ma7: 'var(--chart-4)',
  trendUp: 'var(--error)',
  trendDown: 'var(--success)',
  neutral: 'var(--text-secondary)',
};

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
    <div style={chartTooltipStyles}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{point.label}</div>
      {point.avgDuration != null && (
        <div style={{ color: COLORS.daily }}>Avg: {formatDuration(point.avgDuration)}</div>
      )}
      {point.ma7 != null && (
        <div style={{ color: COLORS.ma7 }}>7d MA: {formatDuration(Math.round(point.ma7))}</div>
      )}
      <div style={{ color: 'var(--text-tertiary)' }}>{point.turnCount} turn{point.turnCount !== 1 ? 's' : ''}</div>
    </div>
  );
}

const summaryRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  marginTop: 12,
  padding: '8px 4px 4px',
  borderTop: '1px solid var(--border-soft)',
};

const summaryItemStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const summaryLabelStyles: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  fontFamily: '"JetBrains Mono", monospace',
};

const summaryValueStyles: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
  fontFamily: '"JetBrains Mono", monospace',
  color: 'var(--text-primary)',
};

export default function TurnDurationChart({ data }: TurnDurationChartProps): React.JSX.Element | null {
  const { chartData, latestAvg, avg7d, avg30d } = useMemo(() => {
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
        label: formatDayLabel(d.date),
        avgDuration: d.turnCount > 0 ? d.avgDurationSeconds : null,
        ma7,
        turnCount: d.turnCount,
      });
    }

    // Summary averages — "latest" is the last day WITH data, which may not be today
    const daysWithData = data.filter(d => d.turnCount > 0);
    const latestEntry = daysWithData[daysWithData.length - 1];
    const latestAvg = latestEntry?.avgDurationSeconds ?? null;

    const cutoff7 = new Date();
    cutoff7.setDate(cutoff7.getDate() - 7);
    const last7 = daysWithData.filter(d => new Date(d.date + 'T00:00:00') >= cutoff7);
    const avg7d = last7.length > 0
      ? Math.round(last7.reduce((s, d) => s + d.avgDurationSeconds, 0) / last7.length)
      : null;

    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const last30 = daysWithData.filter(d => new Date(d.date + 'T00:00:00') >= cutoff30);
    const avg30d = last30.length > 0
      ? Math.round(last30.reduce((s, d) => s + d.avgDurationSeconds, 0) / last30.length)
      : null;

    return { chartData: points, latestAvg, avg7d, avg30d };
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
  const tickInterval = dateTickInterval(data.length);

  return (
    <div className="card">
      <div className="card-head"><h2>Turn Duration Trend</h2></div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
          <XAxis
            dataKey="label"
            tick={chartAxisTick}
            axisLine={{ stroke: chartGridStroke }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={(v: number) => formatDuration(v)}
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            width={CHART_Y_AXIS_WIDTH}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-tertiary)' }}
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
        {latestAvg != null && (
          <div style={summaryItemStyles}>
            <span style={summaryLabelStyles}>Latest</span>
            <span style={summaryValueStyles}>{formatDuration(latestAvg)}</span>
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
