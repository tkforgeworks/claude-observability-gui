import React, { useMemo, useState, useCallback } from 'react';

interface HeatmapDay {
  date: string;
  value: number;
}

type ColorScale = 'purple' | 'teal' | 'sky' | 'indigo';

interface HeatmapChartProps {
  data: HeatmapDay[];
  days: number;
  colorScale?: ColorScale;
  formatValue?: (v: number) => string;
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const DAY_LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 18;

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RAMPS: Record<ColorScale, string[]> = {
  purple: ['var(--background-light)', '#2a1e3a', '#3d2660', '#6b4fa0', 'var(--purple-primary)'],
  teal:   ['var(--background-light)', '#1a2e2e', '#1e4040', '#2a6060', 'var(--chart-5)'],
  sky:    ['var(--background-light)', '#1a2540', '#1e3a6a', '#2a5590', 'var(--chart-3)'],
  indigo: ['var(--background-light)', '#1e1e3a', '#2a2a60', '#3a3aa0', 'var(--chart-6)'],
};

interface CellData {
  date: string;
  weekIndex: number;
  dayIndex: number;
  value: number;
}

interface GridLayout {
  cells: CellData[];
  monthLabels: { label: string; weekIndex: number }[];
  weeksCount: number;
}

function buildGrid(data: HeatmapDay[], days: number): GridLayout {
  const dataMap = new Map(data.map(d => [d.date, d.value]));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(12, 0, 0, 0);

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

    cells.push({ date: dateStr, weekIndex, dayIndex, value: dataMap.get(dateStr) ?? 0 });
    current.setDate(current.getDate() + 1);
  }

  return { cells, monthLabels, weeksCount: weekIndex + 1 };
}

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

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  value: number;
}

export default function HeatmapChart({
  data,
  days,
  colorScale = 'purple',
  formatValue,
}: HeatmapChartProps): React.JSX.Element {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', value: 0 });
  const ramp = RAMPS[colorScale];

  const { cells, monthLabels, weeksCount } = useMemo(() => buildGrid(data, days), [data, days]);
  const levels = useMemo(() => computeIntensityLevels(cells.map(c => c.value)), [cells]);

  const gridWidth = DAY_LABEL_WIDTH + weeksCount * (CELL_SIZE + CELL_GAP);
  const gridHeight = MONTH_LABEL_HEIGHT + 7 * (CELL_SIZE + CELL_GAP);

  const handleMouseEnter = useCallback((e: React.MouseEvent, cell: CellData) => {
    setTooltip({ visible: true, x: e.clientX + 12, y: e.clientY - 40, date: cell.date, value: cell.value });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev.visible ? { ...prev, x: e.clientX + 12, y: e.clientY - 40 } : prev);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, x: 0, y: 0, date: '', value: 0 });
  }, []);

  return (
    <div>
      <div style={{ overflow: 'auto' }}>
        <svg width={gridWidth} height={gridHeight} style={{ display: 'block' }}>
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={DAY_LABEL_WIDTH + m.weekIndex * (CELL_SIZE + CELL_GAP)}
              y={MONTH_LABEL_HEIGHT - 4}
              fill="var(--text-tertiary)"
              fontSize={10}
              fontFamily='"JetBrains Mono", monospace'
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
                fill="var(--text-tertiary)"
                fontSize={10}
                fontFamily='"JetBrains Mono", monospace'
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
                fill={ramp[level]}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => handleMouseEnter(e, cell)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </svg>
      </div>
      <div className="heatmap-legend" style={{ marginTop: 8 }}>
        <span>Less</span>
        {ramp.map((color, i) => (
          <div
            key={i}
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: color,
              borderRadius: CELL_RADIUS,
            }}
          />
        ))}
        <span>More</span>
      </div>
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          padding: '6px 10px',
          backgroundColor: 'var(--background-light)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          fontFamily: '"JetBrains Mono", monospace',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{formatDateLabel(tooltip.date)}</div>
          <div style={{ color: tooltip.value > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
            {formatValue ? formatValue(tooltip.value) : (tooltip.value > 0 ? String(tooltip.value) : 'No activity')}
          </div>
        </div>
      )}
    </div>
  );
}
