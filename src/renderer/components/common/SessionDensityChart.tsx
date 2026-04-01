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
  line: '#44bbaa',
  grid: '#2a2a3e',
  axis: '#6666aa',
  bg: '#16162a',
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
      backgroundColor: '#1a1a2e',
      border: '1px solid #3a3a5e',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{ color: '#ccccdd', fontWeight: 600, marginBottom: 2 }}>{d.label}</div>
      {d.density != null && (
        <div style={{ color: COLORS.line }}>{d.density.toFixed(1)} sessions/hr</div>
      )}
      <div style={{ color: '#8888aa' }}>{d.sessionCount} sessions</div>
      <div style={{ color: '#666688' }}>{d.activeHours.toFixed(1)}h active</div>
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
  marginBottom: 4,
};

const subtitleStyles: React.CSSProperties = {
  fontSize: 11,
  color: '#666688',
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
    <div style={containerStyles}>
      <div style={titleStyles}>Session Density</div>
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
