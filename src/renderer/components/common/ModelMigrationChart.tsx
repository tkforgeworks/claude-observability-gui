/**
 * Stacked area chart showing proportion of Code sessions by model over time.
 * Model series are auto-discovered from data — no hardcoded model list.
 * @see CGUI-27 (widget), CGUI-67 (token migration)
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
import { CHART_Y_AXIS_WIDTH, dateTickInterval, formatDayLabel, shortenModel } from '../../utils/format';
import { chartAxisTick, chartGridStroke, chartTooltipStyles, chartSeriesColors } from './chartTheme';

interface ModelMigrationChartProps {
  data: ModelMixDay[];
  models: string[];
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
  // Hide zero-value series — long ranges accumulate many retired models
  const active_ = payload.filter(p => (p.value ?? 0) > 0);
  return (
    <div style={chartTooltipStyles}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {active_.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {shortenModel(p.name)}: {p.value} ({total > 0 ? Math.round((p.value / total) * 100) : 0}%)
        </div>
      ))}
      <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Total: {total}</div>
    </div>
  );
}

export default function ModelMigrationChart({ data, models }: ModelMigrationChartProps): React.JSX.Element | null {
  if (models.length === 0) return null;

  const chartData: ChartPoint[] = data.map(d => {
    const point: ChartPoint = { label: formatDayLabel(d.date) };
    for (const m of models) {
      point[m] = (d[m] as number) ?? 0;
    }
    return point;
  });

  const tickInterval = dateTickInterval(data.length);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Model Migration</h2>
        <span className="sub">Code sessions by model over time</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
          <XAxis
            dataKey="label"
            tick={chartAxisTick}
            axisLine={{ stroke: chartGridStroke }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            width={CHART_Y_AXIS_WIDTH}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            formatter={(value: string) => shortenModel(value)}
          />
          {models.map((model, i) => (
            <Area
              key={model}
              type="monotone"
              dataKey={model}
              name={model}
              stackId="1"
              stroke={chartSeriesColors[i % chartSeriesColors.length]}
              fill={chartSeriesColors[i % chartSeriesColors.length]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
