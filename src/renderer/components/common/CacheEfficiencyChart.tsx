/**
 * Cache efficiency widget for the Trends view.
 *
 * Bar chart: cache reuse ratio (cache_read / cache_write) per project —
 * shows how many times each cached context byte was reused.
 *
 * Table below: raw token counts, cache hit %, and estimated $ saved.
 * @see CGUI-24
 */

import React, { useState } from 'react';
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
import type { CacheEfficiencyData } from '../../../shared/ipc-types';

interface CacheEfficiencyChartProps {
  data: CacheEfficiencyData[];
}

const COLORS = {
  bar: '#6688cc',
  barAlt: '#5577bb',
  savings: '#22aa66',
  grid: '#2a2a3e',
  axis: '#6666aa',
  bg: '#16162a',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

interface TooltipPayloadEntry {
  payload: CacheEfficiencyData;
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
      <div style={{ color: COLORS.bar }}>{d.reuseRatio.toFixed(1)}x cache reuse</div>
      <div style={{ color: '#8888aa' }}>{d.efficiencyPct.toFixed(1)}% cache hit rate</div>
      <div style={{ color: '#8888aa' }}>
        Read: {formatTokens(d.cacheReadTokens)} &middot; Write: {formatTokens(d.cacheWriteTokens)} &middot; Input: {formatTokens(d.inputTokens)}
      </div>
      <div style={{ color: COLORS.savings }}>Saved {formatCost(d.estimatedSavingsUsd)}</div>
      <div style={{ color: '#666688' }}>{d.sessionCount} session{d.sessionCount !== 1 ? 's' : ''}</div>
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

const tokenRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '3px 0',
  fontSize: 11,
  color: '#666688',
  borderBottom: '1px solid #1e1e36',
};

const CHART_LIMIT = 10;

const showMoreButtonStyles: React.CSSProperties = {
  background: 'none',
  border: '1px solid #3333aa',
  borderRadius: 4,
  color: '#8888aa',
  fontSize: 11,
  padding: '4px 12px',
  cursor: 'pointer',
  marginTop: 8,
  alignSelf: 'flex-start',
};

export default function CacheEfficiencyChart({ data }: CacheEfficiencyChartProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false);

  if (data.length === 0) return null;

  const chartData = data.slice(0, CHART_LIMIT);
  const tableData = expanded ? data : chartData;
  const hasMore = data.length > CHART_LIMIT;

  const totalSavings = data.reduce((sum, d) => sum + d.estimatedSavingsUsd, 0);
  const chartHeight = Math.max(120, chartData.length * 32 + 20);

  return (
    <div style={containerStyles}>
      <div style={titleStyles}>Cache Reuse by Project</div>
      <div style={subtitleStyles}>
        cache_read / cache_write ratio &mdash; higher means more reuse per cache investment
        {totalSavings > 0 && (
          <span style={{ color: COLORS.savings, marginLeft: 12 }}>
            Total estimated savings: {formatCost(totalSavings)}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v}x`}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="project"
            width={140}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(102, 136, 204, 0.1)' }} />
          <Bar dataKey="reuseRatio" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? COLORS.bar : COLORS.barAlt} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed token breakdown table */}
      <div style={{ marginTop: 12, padding: '0 4px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...tokenRowStyles, fontWeight: 600, color: '#8888aa', borderBottom: '1px solid #2a2a3e' }}>
          <span style={{ flex: 2 }}>Project</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Cache Read</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Cache Write</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Input</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Hit %</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Reuse</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Saved</span>
        </div>
        {tableData.map((d) => (
          <div key={d.project} style={tokenRowStyles}>
            <span style={{ flex: 2 }}>{d.project}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{formatTokens(d.cacheReadTokens)}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{formatTokens(d.cacheWriteTokens)}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{formatTokens(d.inputTokens)}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{d.efficiencyPct.toFixed(1)}%</span>
            <span style={{ flex: 1, textAlign: 'right', color: COLORS.bar }}>{d.reuseRatio.toFixed(1)}x</span>
            <span style={{ flex: 1, textAlign: 'right', color: COLORS.savings }}>{formatCost(d.estimatedSavingsUsd)}</span>
          </div>
        ))}
        {hasMore && (
          <button
            style={showMoreButtonStyles}
            onClick={() => setExpanded(prev => !prev)}
          >
            {expanded ? `Show top ${CHART_LIMIT} only` : `Show all ${data.length} projects`}
          </button>
        )}
      </div>
    </div>
  );
}
