/**
 * Usage heatmap view — three stacked GitHub-style calendar heatmaps:
 *   1. Cowork sessions (intensity by session count)
 *   2. Code I/O tokens (intensity by input + output tokens)
 *   3. Code Cache tokens (intensity by cache read + cache creation tokens)
 *
 * Intensity is percentile-based relative to the user's own peak day.
 * @see CGUI-23
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { HeatmapDay } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE = 14;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const DAY_LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 18;
const DAYS_IN_WEEK = 7;

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RANGE_OPTIONS = [
  { label: '12 months', days: 365 },
  { label: '6 months', days: 182 },
  { label: '3 months', days: 91 },
];

/** Color ramps per heatmap type */
const COLOR_RAMPS = {
  cowork: ['#1a1a2e', '#1e2a5a', '#224488', '#3366bb', '#5588ee'],
  ioTokens: ['#1a1a2e', '#2a2a1e', '#4a4a20', '#7a7a30', '#aaaa44'],
  cacheTokens: ['#1a1a2e', '#2a1e2a', '#4a2050', '#7a3080', '#aa44bb'],
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  height: '100%',
  overflow: 'auto',
};

const headerRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const headerStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ccccdd',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const rangeButtonStyles = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  backgroundColor: active ? '#3a3a6a' : '#1a1a2e',
  border: `1px solid ${active ? '#5a5a8a' : '#2a2a4a'}`,
  borderRadius: 4,
  color: active ? '#ccccdd' : '#888899',
  fontSize: 13,
  cursor: 'pointer',
});

const sectionStyles: React.CSSProperties = {
  padding: 16,
  backgroundColor: '#12122a',
  borderRadius: 8,
  border: '1px solid #2a2a4a',
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#8888aa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 10,
};

const legendStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: '#8888aa',
  marginTop: 10,
};

const summaryBarStyles: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  padding: '10px 16px',
  backgroundColor: '#1a1a2e',
  borderRadius: 6,
  border: '1px solid #2a2a4a',
  fontSize: 13,
  color: '#8888aa',
  flexWrap: 'wrap',
};

const summaryValueStyles: React.CSSProperties = {
  color: '#ccccdd',
  fontWeight: 600,
  fontFamily: 'monospace',
};

const tooltipStyles: React.CSSProperties = {
  position: 'fixed',
  padding: '6px 10px',
  backgroundColor: '#2a2a4a',
  border: '1px solid #3a3a6a',
  borderRadius: 6,
  fontSize: 12,
  color: '#ccccdd',
  pointerEvents: 'none',
  zIndex: 1000,
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
};

const emptyContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

interface CellData {
  date: string;
  weekIndex: number;
  dayIndex: number;
  day: HeatmapDay;
}

interface GridLayout {
  cells: CellData[];
  monthLabels: { label: string; weekIndex: number }[];
  weeksCount: number;
}

function buildGrid(data: HeatmapDay[], days: number): GridLayout {
  const dataMap = new Map(data.map(d => [d.date, d]));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(12, 0, 0, 0);

  // Align to Sunday
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const cells: CellData[] = [];
  const monthLabels: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;
  let weekIndex = 0;

  const current = new Date(gridStart);
  while (current <= today) {
    const dayIndex = current.getDay();
    if (dayIndex === 0 && cells.length > 0) weekIndex++;

    const dateStr = current.toISOString().slice(0, 10);

    if (current.getMonth() !== lastMonth) {
      lastMonth = current.getMonth();
      if (dayIndex <= 3) {
        monthLabels.push({ label: MONTH_NAMES[lastMonth], weekIndex });
      }
    }

    const emptyDay: HeatmapDay = {
      date: dateStr, coworkCount: 0, codeCount: 0,
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
    };

    cells.push({
      date: dateStr,
      weekIndex,
      dayIndex,
      day: dataMap.get(dateStr) ?? emptyDay,
    });

    current.setDate(current.getDate() + 1);
  }

  return { cells, monthLabels, weeksCount: weekIndex + 1 };
}

/**
 * Compute percentile-based intensity (0-4) using the non-zero values.
 * Level 0 = zero, levels 1-4 split remaining values into quartiles.
 */
function computeIntensityLevels(values: number[]): number[] {
  const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return values.map(() => 0);

  const p25 = nonZero[Math.floor(nonZero.length * 0.25)] ?? 1;
  const p50 = nonZero[Math.floor(nonZero.length * 0.50)] ?? p25;
  const p75 = nonZero[Math.floor(nonZero.length * 0.75)] ?? p50;

  return values.map(v => {
    if (v === 0) return 0;
    if (v <= p25) return 1;
    if (v <= p50) return 2;
    if (v <= p75) return 3;
    return 4;
  });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Tooltip types
// ---------------------------------------------------------------------------

type HeatmapType = 'cowork' | 'ioTokens' | 'cacheTokens';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  cell: CellData | null;
  type: HeatmapType | null;
}

// ---------------------------------------------------------------------------
// Single heatmap grid component
// ---------------------------------------------------------------------------

interface HeatmapGridProps {
  title: string;
  cells: CellData[];
  monthLabels: { label: string; weekIndex: number }[];
  weeksCount: number;
  levels: number[];
  colorRamp: string[];
  type: HeatmapType;
  onMouseEnter: (e: React.MouseEvent, cell: CellData, type: HeatmapType) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

function HeatmapGrid({
  title, cells, monthLabels, weeksCount, levels, colorRamp,
  type, onMouseEnter, onMouseMove, onMouseLeave,
}: HeatmapGridProps): React.JSX.Element {
  const gridWidth = DAY_LABEL_WIDTH + weeksCount * (CELL_SIZE + CELL_GAP);
  const gridHeight = MONTH_LABEL_HEIGHT + DAYS_IN_WEEK * (CELL_SIZE + CELL_GAP);

  return (
    <div style={sectionStyles}>
      <div style={sectionTitleStyles}>{title}</div>
      <div style={{ overflow: 'auto' }}>
        <svg width={gridWidth} height={gridHeight} style={{ display: 'block' }}>
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={DAY_LABEL_WIDTH + m.weekIndex * (CELL_SIZE + CELL_GAP)}
              y={MONTH_LABEL_HEIGHT - 4}
              fill="#6666aa"
              fontSize={10}
            >
              {m.label}
            </text>
          ))}

          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={i}
                x={0}
                y={MONTH_LABEL_HEIGHT + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
                fill="#6666aa"
                fontSize={10}
              >
                {label}
              </text>
            ) : null
          )}

          {cells.map((cell, i) => {
            const x = DAY_LABEL_WIDTH + cell.weekIndex * (CELL_SIZE + CELL_GAP);
            const y = MONTH_LABEL_HEIGHT + cell.dayIndex * (CELL_SIZE + CELL_GAP);
            const level = levels[i];
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={CELL_RADIUS}
                ry={CELL_RADIUS}
                fill={colorRamp[level]}
                stroke={level > 0 ? colorRamp[level] : '#2a2a4a'}
                strokeWidth={0.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => onMouseEnter(e, cell, type)}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
              />
            );
          })}
        </svg>
      </div>
      <div style={legendStyles}>
        <span>Less</span>
        {colorRamp.map((color, i) => (
          <div
            key={i}
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: color,
              borderRadius: CELL_RADIUS,
              border: i === 0 ? '0.5px solid #2a2a4a' : 'none',
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HeatmapView(): React.JSX.Element {
  const [data, setData] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(365);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, cell: null, type: null });

  const fetchData = useCallback(() => {
    return window.api.analytics.getHeatmapData(rangeDays)
      .then(setData)
      .catch(err => {
        console.error('[HeatmapView] fetch failed:', err);
        setData([]);
      });
  }, [rangeDays]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const { cells, monthLabels, weeksCount } = useMemo(
    () => buildGrid(data, rangeDays),
    [data, rangeDays]
  );

  // Compute intensity levels for each heatmap
  const coworkLevels = useMemo(
    () => computeIntensityLevels(cells.map(c => c.day.coworkCount)),
    [cells]
  );
  const ioTokenLevels = useMemo(
    () => computeIntensityLevels(cells.map(c => c.day.inputTokens + c.day.outputTokens)),
    [cells]
  );
  const cacheTokenLevels = useMemo(
    () => computeIntensityLevels(cells.map(c => c.day.cacheReadTokens + c.day.cacheCreationTokens)),
    [cells]
  );

  const totals = useMemo(() => {
    let activeDays = 0;
    let coworkSessions = 0;
    let codeSessions = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    for (const c of cells) {
      if (c.day.coworkCount + c.day.codeCount > 0) activeDays++;
      coworkSessions += c.day.coworkCount;
      codeSessions += c.day.codeCount;
      inputTokens += c.day.inputTokens;
      outputTokens += c.day.outputTokens;
      cacheReadTokens += c.day.cacheReadTokens;
      cacheCreationTokens += c.day.cacheCreationTokens;
    }
    return { activeDays, coworkSessions, codeSessions, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens };
  }, [cells]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, cell: CellData, type: HeatmapType) => {
    setTooltip({ visible: true, x: e.clientX + 12, y: e.clientY - 40, cell, type });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev.visible ? { ...prev, x: e.clientX + 12, y: e.clientY - 40 } : prev);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, x: 0, y: 0, cell: null, type: null });
  }, []);

  const hasAnyData = totals.coworkSessions + totals.codeSessions > 0;

  if (loading) {
    return (
      <div style={viewStyles}>
        <div style={headerRowStyles}>
          <h1 style={headerStyles}>Usage Heatmap</h1>
        </div>
        <div style={emptyContainerStyles}>
          <span style={{ color: '#8888aa' }}>Loading heatmap data...</span>
        </div>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div style={viewStyles}>
        <div style={headerRowStyles}>
          <h1 style={headerStyles}>Usage Heatmap</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {RANGE_OPTIONS.map(r => (
              <button key={r.days} style={rangeButtonStyles(rangeDays === r.days)} onClick={() => setRangeDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div style={emptyContainerStyles}>
          <EmptyState
            title="No activity data yet"
            message="The heatmap will show your Claude usage intensity over time once session data has been collected across Cowork and Code sources."
          />
        </div>
      </div>
    );
  }

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Usage Heatmap</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTIONS.map(r => (
            <button key={r.days} style={rangeButtonStyles(rangeDays === r.days)} onClick={() => setRangeDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={summaryBarStyles}>
        <span><span style={summaryValueStyles}>{totals.activeDays}</span> active days</span>
        <span>Cowork: <span style={summaryValueStyles}>{totals.coworkSessions}</span> sessions</span>
        <span>Code: <span style={summaryValueStyles}>{totals.codeSessions}</span> sessions</span>
        <span>I/O tokens: <span style={summaryValueStyles}>{formatTokenCount(totals.inputTokens + totals.outputTokens)}</span></span>
        <span>Cache tokens: <span style={summaryValueStyles}>{formatTokenCount(totals.cacheReadTokens + totals.cacheCreationTokens)}</span></span>
      </div>

      <HeatmapGrid
        title="Cowork Sessions"
        cells={cells}
        monthLabels={monthLabels}
        weeksCount={weeksCount}
        levels={coworkLevels}
        colorRamp={COLOR_RAMPS.cowork}
        type="cowork"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      <HeatmapGrid
        title="Code: Input + Output Tokens"
        cells={cells}
        monthLabels={monthLabels}
        weeksCount={weeksCount}
        levels={ioTokenLevels}
        colorRamp={COLOR_RAMPS.ioTokens}
        type="ioTokens"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      <HeatmapGrid
        title="Code: Cache Read + Write Tokens"
        cells={cells}
        monthLabels={monthLabels}
        weeksCount={weeksCount}
        levels={cacheTokenLevels}
        colorRamp={COLOR_RAMPS.cacheTokens}
        type="cacheTokens"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {tooltip.visible && tooltip.cell && tooltip.type && (
        <div style={{ ...tooltipStyles, left: tooltip.x, top: tooltip.y }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {formatDateLabel(tooltip.cell.date)}
          </div>
          {tooltip.type === 'cowork' && (
            tooltip.cell.day.coworkCount === 0
              ? <div style={{ color: '#8888aa' }}>No sessions</div>
              : <div>{tooltip.cell.day.coworkCount} Cowork session{tooltip.cell.day.coworkCount !== 1 ? 's' : ''}</div>
          )}
          {tooltip.type === 'ioTokens' && (
            (tooltip.cell.day.inputTokens + tooltip.cell.day.outputTokens) === 0
              ? <div style={{ color: '#8888aa' }}>No token usage</div>
              : <>
                  <div>Input: {formatTokenCount(tooltip.cell.day.inputTokens)}</div>
                  <div>Output: {formatTokenCount(tooltip.cell.day.outputTokens)}</div>
                  <div style={{ color: '#aaaa44', marginTop: 2 }}>
                    Total: {formatTokenCount(tooltip.cell.day.inputTokens + tooltip.cell.day.outputTokens)}
                  </div>
                </>
          )}
          {tooltip.type === 'cacheTokens' && (
            (tooltip.cell.day.cacheReadTokens + tooltip.cell.day.cacheCreationTokens) === 0
              ? <div style={{ color: '#8888aa' }}>No cache usage</div>
              : <>
                  <div>Cache read: {formatTokenCount(tooltip.cell.day.cacheReadTokens)}</div>
                  <div>Cache write: {formatTokenCount(tooltip.cell.day.cacheCreationTokens)}</div>
                  <div style={{ color: '#aa44bb', marginTop: 2 }}>
                    Total: {formatTokenCount(tooltip.cell.day.cacheReadTokens + tooltip.cell.day.cacheCreationTokens)}
                  </div>
                </>
          )}
          {tooltip.type !== 'cowork' && tooltip.cell.day.codeCount > 0 && (
            <div style={{ color: '#6666aa', fontSize: 11, marginTop: 2 }}>
              {tooltip.cell.day.codeCount} code session{tooltip.cell.day.codeCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
