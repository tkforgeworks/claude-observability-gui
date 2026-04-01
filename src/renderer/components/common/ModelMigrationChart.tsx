/**
 * Stacked area chart showing proportion of Code sessions by model over time.
 * Model series are auto-discovered from data — no hardcoded model list.
 * @see CGUI-27
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { ModelMixDay } from '../../../shared/ipc-types';

interface ModelMigrationChartProps {
  data: ModelMixDay[];
  models: string[];
}

const COLORS = {
  grid: '#2a2a3e',
  axis: '#6666aa',
  bg: '#16162a',
};

// Distinct palette for up to 8 models
const MODEL_PALETTE = [
  '#6688cc',
  '#cc6688',
  '#44bbaa',
  '#cc8844',
  '#aa66cc',
  '#66ccaa',
  '#cc6644',
  '#8888cc',
];

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shortenModelName(model: string): string {
  // e.g. "claude-opus-4-6" → "opus-4-6", "claude-sonnet-4-6" → "sonnet-4-6"
  return model.replace(/^claude-/, '');
}

interface ChartPoint {
  label: string;
  [model: string]: string | number;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={{
      backgroundColor: '#1a1a2e',
      border: '1px solid #3a3a5e',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{ color: '#ccccdd', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value} ({total > 0 ? Math.round((p.value / total) * 100) : 0}%)
        </div>
      ))}
      <div style={{ color: '#666688', marginTop: 2 }}>Total: {total}</div>
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

export default function ModelMigrationChart({ data, models }: ModelMigrationChartProps): React.JSX.Element | null {
  if (models.length === 0) return null;

  const chartData: ChartPoint[] = data.map(d => {
    const point: ChartPoint = { label: formatDateLabel(d.date) };
    for (const m of models) {
      point[m] = (d[m] as number) ?? 0;
    }
    return point;
  });

  const tickInterval = data.length > 60 ? 13 : data.length > 14 ? 6 : 1;

  return (
    <div style={containerStyles}>
      <div style={titleStyles}>Model Migration</div>
      <div style={subtitleStyles}>Code sessions by model over time</div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: COLORS.axis }}
            formatter={(value: string) => shortenModelName(value)}
          />
          {models.map((model, i) => (
            <Area
              key={model}
              type="monotone"
              dataKey={model}
              name={model}
              stackId="1"
              stroke={MODEL_PALETTE[i % MODEL_PALETTE.length]}
              fill={MODEL_PALETTE[i % MODEL_PALETTE.length]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
