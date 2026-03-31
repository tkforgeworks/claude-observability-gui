/**
 * Horizontal bar chart showing total cost by project.
 * Aggregates from raw CodeSession[] in the renderer — no extra IPC needed.
 * @see CGUI-22 and FR-6.4
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { CodeSession } from '../../../shared/ipc-types';

interface CostByProjectChartProps {
  sessions: CodeSession[];
}

const COLORS = {
  bar: '#22aa66',
  barAlt: '#338855',
  grid: '#2a2a3e',
  axis: '#6666aa',
  bg: '#16162a',
};

function formatProjectName(p: string | null): string {
  if (!p) return '(unknown)';
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length <= 2 ? parts.join('/') : parts.slice(-2).join('/');
}

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

interface AggRow {
  project: string;
  cost: number;
  count: number;
}

interface TooltipPayloadEntry {
  payload: AggRow;
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
      <div style={{ color: '#ccccdd', fontWeight: 600, marginBottom: 2 }}>{d.project}</div>
      <div style={{ color: COLORS.bar }}>{formatCost(d.cost)}</div>
      <div style={{ color: '#8888aa' }}>{d.count} session{d.count !== 1 ? 's' : ''}</div>
    </div>
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
  marginBottom: 12,
};

export default function CostByProjectChart({ sessions }: CostByProjectChartProps): React.JSX.Element | null {
  const data = useMemo(() => {
    const map = new Map<string, { cost: number; count: number }>();
    for (const s of sessions) {
      const key = formatProjectName(s.project_path);
      const entry = map.get(key) ?? { cost: 0, count: 0 };
      entry.cost += s.cost_usd ?? 0;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([project, { cost, count }]) => ({ project, cost, count }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8); // Top 8 projects
  }, [sessions]);

  if (data.length === 0) return null;

  const chartHeight = Math.max(120, data.length * 28 + 20);

  return (
    <div style={containerStyles}>
      <div style={titleStyles}>Cost by Project</div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatCost(v)}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="project"
            width={120}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(34, 170, 102, 0.1)' }} />
          <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? COLORS.bar : COLORS.barAlt} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
