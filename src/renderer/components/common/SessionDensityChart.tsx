/**
 * Line chart showing session density (sessions per active hour) per day.
 * Active hours = time span between first and last session start on that day.
 * @see CGUI-27
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { SessionDensityDay } from '../../../shared/ipc-types';

interface SessionDensityChartProps {
  data: SessionDensityDay[];
}

const COLORS = {
  line: 'var(--chart-5)',
  grid: 'var(--border-soft)',
  axis: 'var(--text-tertiary)',
  bg: 'var(--background)',
};

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ChartPoint {
  label: string;
  density: number | null;
  sessionCount: number;
  activeHours: number;
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
      {d.density != null && (
        <div style={{ color: COLORS.line }}>{d.density.toFixed(1)} sessions/hr</div>
      )}
      <div style={{ color: 'var(--text-secondary)' }}>{d.sessionCount} sessions</div>
      <div style={{ color: 'var(--text-tertiary)' }}>{d.activeHours.toFixed(1)}h active</div>
    </div>
  );
}

const subtitleStyles: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-tertiary)',
  fontFamily: '"JetBrains Mono", monospace',
  marginBottom: 12,
};

export default function SessionDensityChart({ data }: SessionDensityChartProps): React.JSX.Element | null {
  const hasData = data.some(d => d.sessionCount > 0);
  if (!hasData) return null;

  const chartData: ChartPoint[] = data.map(d => ({
    label: formatDateLabel(d.date),
    density: d.sessionCount > 0 ? d.density : null,
    sessionCount: d.sessionCount,
    activeHours: d.activeHours,
  }));

  const tickInterval = data.length > 60 ? 13 : data.length > 14 ? 6 : 1;

  return (
    <div className="card">
      <div className="card-head"><h2>Session Density</h2></div>
      <div style={subtitleStyles}>Sessions per active hour per day</div>

      <ResponsiveContainer width="100%" height={180}>
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
            tickFormatter={(v: number) => `${v}`}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="density"
            stroke={COLORS.line}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
