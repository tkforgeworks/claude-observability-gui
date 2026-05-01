/**
 * Cost velocity widget: headline metric card showing rolling 7-day average
 * daily cost with comparison to prior 7 days, plus a daily cost bar chart.
 * @see CGUI-26
 */

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import type { DailyCostData } from '../../../shared/ipc-types';

interface CostVelocityChartProps {
  data: DailyCostData[];
}

const COLORS = {
  bar: 'var(--chart-1)',
  barAlt: 'var(--chart-2)',
  barZero: 'var(--border-soft)',
  ma7: 'var(--chart-4)',
  grid: 'var(--border-soft)',
  axis: 'var(--text-tertiary)',
  bg: 'var(--background)',
  trendUp: 'var(--error)',
  trendDown: 'var(--success)',
  neutral: 'var(--text-secondary)',
};

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ChartPoint {
  date: string;
  label: string;
  costUsd: number;
  ma7: number | null;
  sessionCount: number;
}

interface TooltipPayloadEntry {
  payload: ChartPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      backgroundColor: 'var(--background-light)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
      lineHeight: 1.6,
    }}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{d.label}</div>
      <div style={{ color: COLORS.bar }}>{formatCost(d.costUsd)}</div>
      {d.ma7 != null && (
        <div style={{ color: COLORS.ma7 }}>7d MA: {formatCost(d.ma7)}</div>
      )}
      <div style={{ color: 'var(--text-tertiary)' }}>{d.sessionCount} session{d.sessionCount !== 1 ? 's' : ''}</div>
    </div>
  );
}

const headlineRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 16,
  marginBottom: 16,
};

const headlineValueStyles: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 500,
  fontFamily: '"JetBrains Mono", monospace',
  color: 'var(--text-primary)',
};

const headlineLabelStyles: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-tertiary)',
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

export default function CostVelocityChart({ data }: CostVelocityChartProps): React.JSX.Element | null {
  const { chartData, avg7d, avgPrior7d, totalPeriod, pctChange, trendColor, trendSymbol } = useMemo(() => {
    // Data includes days+7 extra for prior period comparison.
    // The last `days` entries are the display period; the first 7 are the prior comparison window.
    // We show only the display period in the chart (skip first 7).
    const displayData = data.slice(7);
    const priorData = data.slice(0, 7);

    const chartPoints: ChartPoint[] = displayData.map((d, i) => {
      // 7-day moving average over display data
      let ma7: number | null = null;
      if (i >= 6) {
        const window = displayData.slice(i - 6, i + 1);
        ma7 = window.reduce((s, w) => s + w.costUsd, 0) / 7;
      }
      return {
        date: d.date,
        label: formatDateLabel(d.date),
        costUsd: d.costUsd,
        ma7,
        sessionCount: d.sessionCount,
      };
    });

    // Rolling 7-day average (last 7 days of display data)
    const last7 = displayData.slice(-7);
    const sum7d = last7.reduce((s, d) => s + d.costUsd, 0);
    const daysWithCost7 = last7.filter(d => d.costUsd > 0).length;
    const avg7d = daysWithCost7 > 0 ? sum7d / 7 : 0;

    // Prior 7-day average
    const sumPrior = priorData.reduce((s, d) => s + d.costUsd, 0);
    const avgPrior7d = sumPrior / 7;

    // Total for display period
    const totalPeriod = displayData.reduce((s, d) => s + d.costUsd, 0);

    // Trend comparison
    let pctChange = 0;
    let trendColor = COLORS.neutral;
    let trendSymbol = '';
    if (avgPrior7d > 0) {
      pctChange = ((avg7d - avgPrior7d) / avgPrior7d) * 100;
      if (Math.abs(pctChange) >= 5) {
        if (pctChange > 0) {
          trendSymbol = ' ↑';
          trendColor = COLORS.trendUp;
        } else {
          trendSymbol = ' ↓';
          trendColor = COLORS.trendDown;
        }
      }
    }

    return { chartData: chartPoints, avg7d, avgPrior7d, totalPeriod, pctChange, trendColor, trendSymbol };
  }, [data]);

  const hasAnyData = data.some(d => d.costUsd > 0);
  if (!hasAnyData) return null;

  // Thin out X-axis labels for longer ranges
  const tickInterval = chartData.length > 60 ? 13 : chartData.length > 14 ? 6 : 1;

  return (
    <div className="card">
      <div className="card-head"><h2>Cost Velocity</h2></div>

      <div style={headlineRowStyles}>
        <span style={headlineValueStyles}>{formatCost(avg7d)}</span>
        <span style={headlineLabelStyles}>/day (7d avg)</span>
        {avgPrior7d > 0 && (
          <span style={{ fontSize: 14, fontWeight: 600, color: trendColor }}>
            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(0)}%{trendSymbol}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={(v: number) => formatCost(v)}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(204, 136, 68, 0.1)' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: COLORS.axis }} />
          <Bar dataKey="costUsd" name="Daily cost" radius={[2, 2, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.costUsd > 0 ? (i % 2 === 0 ? COLORS.bar : COLORS.barAlt) : COLORS.barZero} />
            ))}
          </Bar>
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
        </ComposedChart>
      </ResponsiveContainer>

      <div className="summary-row">
        <div style={summaryItemStyles}>
          <span style={summaryLabelStyles}>Period total</span>
          <span style={summaryValueStyles}>{formatCost(totalPeriod)}</span>
        </div>
        <div style={summaryItemStyles}>
          <span style={summaryLabelStyles}>7d avg/day</span>
          <span style={{ ...summaryValueStyles, color: trendColor }}>
            {formatCost(avg7d)}{trendSymbol}
          </span>
        </div>
        {avgPrior7d > 0 && (
          <div style={summaryItemStyles}>
            <span style={summaryLabelStyles}>Prior 7d avg/day</span>
            <span style={summaryValueStyles}>{formatCost(avgPrior7d)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
