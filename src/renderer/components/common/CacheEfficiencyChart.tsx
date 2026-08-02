/**
 * Cache efficiency widget for the Trends view.
 *
 * Bar chart: cache reuse ratio (cache_read / cache_write) per project —
 * shows how many times each cached context byte was reused.
 *
 * Table below: raw token counts, cache hit %, and estimated $ saved.
 * @see CGUI-24 (widget), CGUI-67 (token migration)
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
} from 'recharts';
import type { CacheEfficiencyData } from '../../../shared/ipc-types';
import { chartAxisTick, chartGridStroke, chartCursorFill, chartTooltipStyles } from './chartTheme';
import { formatCost, formatTokens } from '../../utils/format';

interface CacheEfficiencyChartProps {
  data: CacheEfficiencyData[];
}

const BAR_COLOR = 'var(--chart-1)';
const SAVINGS_COLOR = 'var(--success)';

function truncateProject(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
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
    <div style={chartTooltipStyles}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{d.project}</div>
      <div style={{ color: BAR_COLOR }}>{d.reuseRatio.toFixed(1)}x cache reuse</div>
      <div style={{ color: 'var(--text-secondary)' }}>{d.efficiencyPct.toFixed(1)}% cache hit rate</div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Read: {formatTokens(d.cacheReadTokens)} &middot; Write: {formatTokens(d.cacheWriteTokens)} &middot; Input: {formatTokens(d.inputTokens)}
      </div>
      <div style={{ color: SAVINGS_COLOR }}>Saved {formatCost(d.estimatedSavingsUsd)}</div>
      <div style={{ color: 'var(--text-tertiary)' }}>{d.sessionCount} session{d.sessionCount !== 1 ? 's' : ''}</div>
    </div>
  );
}

const CHART_LIMIT = 10;

const showMoreButtonStyles: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontFamily: '"Poppins", sans-serif',
  padding: '4px 12px',
  cursor: 'pointer',
  marginTop: 8,
  alignSelf: 'flex-start',
};

const numCellStyles: React.CSSProperties = {
  textAlign: 'right',
  fontFamily: '"JetBrains Mono", monospace',
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
    <div className="card">
      <div className="card-head">
        <h2>Cache Reuse by Project</h2>
        <span className="sub">
          cache_read / cache_write — higher means more reuse
          {totalSavings > 0 && ` · saved ${formatCost(totalSavings)}`}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v}x`}
            tick={chartAxisTick}
            axisLine={{ stroke: chartGridStroke }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="project"
            width={140}
            tickFormatter={truncateProject}
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: chartCursorFill }} />
          <Bar dataKey="reuseRatio" radius={[0, 4, 4, 0]} fill={BAR_COLOR} />
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed token breakdown. The 7 columns need ~633px of min-content
          width, more than the ~610px card interior at the 900px window
          minimum, so the table scrolls in its own wrapper — the button stays
          outside it and always visible (CGUI-69). */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Project</th>
                <th style={{ textAlign: 'right' }}>Cache Read</th>
                <th style={{ textAlign: 'right' }}>Cache Write</th>
                <th style={{ textAlign: 'right' }}>Input</th>
                <th style={{ textAlign: 'right' }}>Hit %</th>
                <th style={{ textAlign: 'right' }}>Reuse</th>
                <th style={{ textAlign: 'right' }}>Saved</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((d) => (
                <tr key={d.project}>
                  <td>{d.project}</td>
                  <td style={numCellStyles}>{formatTokens(d.cacheReadTokens)}</td>
                  <td style={numCellStyles}>{formatTokens(d.cacheWriteTokens)}</td>
                  <td style={numCellStyles}>{formatTokens(d.inputTokens)}</td>
                  <td style={numCellStyles}>{d.efficiencyPct.toFixed(1)}%</td>
                  <td style={{ ...numCellStyles, color: BAR_COLOR }}>{d.reuseRatio.toFixed(1)}x</td>
                  <td style={{ ...numCellStyles, color: SAVINGS_COLOR }}>{formatCost(d.estimatedSavingsUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
