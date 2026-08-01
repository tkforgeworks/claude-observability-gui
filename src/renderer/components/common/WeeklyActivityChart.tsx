/**
 * 7-day rolling stacked bar chart showing daily session counts by source.
 * Uses Recharts BarChart with code (green) and cowork (blue) stacked bars.
 * @see CGUI-20 and FR-6.2
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { DailyActivity } from '../../../shared/ipc-types';

interface WeeklyActivityChartProps {
  data: DailyActivity[];
}

const COLORS = {
  code: 'var(--chart-1)',
  cowork: 'var(--chart-5)',
  grid: 'var(--border-soft)',
  axis: 'var(--text-tertiary)',
  bg: 'var(--background)',
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone shift
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  // Find the original data entry from the payload
  const codeEntry = payload.find(p => p.name === 'Code');
  const coworkEntry = payload.find(p => p.name === 'Cowork');

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
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
        {formatDateFull(label)}
      </div>
      {codeEntry && codeEntry.value > 0 && (
        <div style={{ color: COLORS.code }}>
          Code: {codeEntry.value} session{codeEntry.value !== 1 ? 's' : ''}
        </div>
      )}
      {coworkEntry && coworkEntry.value > 0 && (
        <div style={{ color: COLORS.cowork }}>
          Cowork: {coworkEntry.value} session{coworkEntry.value !== 1 ? 's' : ''}
        </div>
      )}
      {(codeEntry?.value ?? 0) === 0 && (coworkEntry?.value ?? 0) === 0 && (
        <div style={{ color: 'var(--text-tertiary)' }}>No sessions</div>
      )}
    </div>
  );
}

const containerStyles: React.CSSProperties = {};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};

const legendDotStyles = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: color,
  marginRight: 4,
  verticalAlign: 'middle',
});

export default function WeeklyActivityChart({ data }: WeeklyActivityChartProps): React.JSX.Element {
  const totalSessions = data.reduce((sum, d) => sum + d.codeCount + d.coworkCount, 0);
  const totalCost = data.reduce((sum, d) => sum + d.codeCost, 0);

  return (
    <div className="card" style={containerStyles}>
      <div className="card-head">
        <h2>Last 7 Days</h2>
        <div className="legend">
          <span><span style={legendDotStyles(COLORS.code)} />Code</span>
          <span><span style={legendDotStyles(COLORS.cowork)} />Cowork</span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            {totalSessions} sessions · {formatCost(totalCost)}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayLabel}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }}
          />
          <Bar dataKey="codeCount" name="Code" stackId="sessions" fill={COLORS.code} radius={[0, 0, 0, 0]} />
          <Bar dataKey="coworkCount" name="Cowork" stackId="sessions" fill={COLORS.cowork} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
