/**
 * Donut chart showing session count and cost distribution by model.
 * Aggregates from raw CodeSession[] in the renderer.
 * @see CGUI-22 and FR-6.4
 */

import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import type { CodeSession } from '../../../shared/ipc-types';

interface ModelDistributionChartProps {
  sessions: CodeSession[];
}

// Distinct colors for up to 8 models
const MODEL_COLORS = [
  '#6666cc', '#cc6688', '#66aacc', '#ccaa44',
  '#44bb88', '#aa66cc', '#cc8844', '#6688cc',
];

const COLORS = {
  bg: '#16162a',
  text: '#ccccdd',
  muted: '#8888aa',
  dimmed: '#6666aa',
};

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function shortenModel(model: string | null): string {
  if (!model) return 'unknown';
  // "claude-sonnet-4-20250514" → "sonnet-4"
  const match = model.match(/(opus|sonnet|haiku)-(\d+(?:\.\d+)?)/i);
  if (match) return `${match[1].toLowerCase()}-${match[2]}`;
  // Fallback: last meaningful segment
  const parts = model.split('-').filter(Boolean);
  return parts.length > 2 ? parts.slice(-3, -1).join('-') : model;
}

interface AggRow {
  model: string;
  fullModel: string;
  count: number;
  cost: number;
  pct: number;
}

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: AggRow;
  percent: number;
}

function renderActiveShape(props: ActiveShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill={COLORS.text} fontSize={13} fontWeight={600}>
        {payload.model}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={COLORS.muted} fontSize={11}>
        {payload.count} sessions · {formatCost(payload.cost)}
      </text>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

const containerStyles: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
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

const legendContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 4,
  fontSize: 11,
};

const legendRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const legendDotStyles = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: color,
  flexShrink: 0,
});

export default function ModelDistributionChart({ sessions }: ModelDistributionChartProps): React.JSX.Element | null {
  const [activeIndex, setActiveIndex] = useState(0);

  const data = useMemo(() => {
    const map = new Map<string, { fullModel: string; count: number; cost: number }>();
    for (const s of sessions) {
      const short = shortenModel(s.model);
      const entry = map.get(short) ?? { fullModel: s.model ?? 'unknown', count: 0, cost: 0 };
      entry.count += 1;
      entry.cost += s.cost_usd ?? 0;
      map.set(short, entry);
    }
    const total = sessions.length || 1;
    return Array.from(map.entries())
      .map(([model, { fullModel, count, cost }]) => ({
        model,
        fullModel,
        count,
        cost,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [sessions]);

  if (data.length === 0) return null;

  return (
    <div style={containerStyles}>
      <div style={titleStyles}>Model Distribution</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ResponsiveContainer width="60%" height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="model"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              activeIndex={activeIndex}
              activeShape={renderActiveShape as unknown as (props: unknown) => React.JSX.Element}
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={legendContainerStyles}>
          {data.map((d, i) => (
            <div key={d.model} style={legendRowStyles}>
              <span style={legendDotStyles(MODEL_COLORS[i % MODEL_COLORS.length])} />
              <span style={{ color: COLORS.text }}>{d.model}</span>
              <span style={{ color: COLORS.dimmed }}>{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
