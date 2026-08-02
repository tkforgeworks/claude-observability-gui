/**
 * Gantt-style project activity timeline. Each row is a project, each
 * column a day in the range. Cells are filled if the project had a
 * code session that day. Grid fills the container width and scrolls
 * horizontally when the date range exceeds available space.
 * @see CGUI-28
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ProjectTimelineRow } from '../../../shared/ipc-types';
import { formatDayLabel } from '../../utils/format';

interface ProjectTimelineChartProps {
  rows: ProjectTimelineRow[];
  dateRange: string[];
}

const INITIAL_ROWS = 10;
const INCREMENT = 5;

const COLORS = {
  active: 'var(--chart-1)',
  empty: 'var(--background-light)',
  axis: 'var(--text-tertiary)',
  label: 'var(--text-secondary)',
};

const subtitleStyles: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-tertiary)',
  fontFamily: '"JetBrains Mono", monospace',
  marginBottom: 12,
};

const buttonStyles: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontFamily: '"Poppins"',
  padding: '4px 12px',
  cursor: 'pointer',
  marginRight: 8,
};

const MIN_CELL_SIZE = 6;
const CELL_GAP = 1;
const LABEL_WIDTH = 130;
const ROW_GAP = 2;
const MIN_ROW_HEIGHT = 18;
// The date-axis row needs a real height. Its cells were unsized, so the row
// collapsed to 0 and the `bottom: 0` labels painted above it — straight into
// the scroll container's clip region, which made them invisible at every
// range. 14px is the 9px font's line box (CGUI-69).
const AXIS_LABEL_HEIGHT = 14;

// Pins the project-name column while the grid scrolls horizontally, so rows
// never scroll away from their labels. Background must be opaque and match
// `.card` so cells slide underneath cleanly (CGUI-69).
const stickyLabelStyles: React.CSSProperties = {
  width: LABEL_WIDTH,
  flexShrink: 0,
  position: 'sticky',
  left: 0,
  zIndex: 1,
  backgroundColor: 'var(--background)',
};

export default function ProjectTimelineChart({ rows, dateRange }: ProjectTimelineChartProps): React.JSX.Element | null {
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  // Measure available width for the grid area (container minus label column)
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        // Available width = container content width - label column - padding
        setGridWidth(Math.floor(entry.contentRect.width - LABEL_WIDTH - 8));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (rows.length === 0) return null;

  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = rows.length > visibleCount;
  const isExpanded = visibleCount > INITIAL_ROWS;

  // Calculate cell size: fill container width, but enforce a minimum
  const totalGaps = (dateRange.length - 1) * CELL_GAP;
  const availableForCells = gridWidth - totalGaps;
  const naturalCellSize = gridWidth > 0 ? availableForCells / dateRange.length : MIN_CELL_SIZE;
  const cellSize = Math.max(MIN_CELL_SIZE, Math.floor(naturalCellSize));

  // Total grid pixel width — if cells exceed container, scrollbar appears
  const totalGridWidth = dateRange.length * cellSize + (dateRange.length - 1) * CELL_GAP;
  const needsScroll = totalGridWidth > gridWidth && gridWidth > 0;

  // Floor the row height independent of cellSize: at the 1y range cells drop
  // to MIN_CELL_SIZE, but the project label still occupies a ~16px line box
  // and adjacent labels collide (CGUI-69).
  const rowHeight = Math.max(MIN_ROW_HEIGHT, cellSize + ROW_GAP + 2);

  // Build lookup sets
  const projectSets = visibleRows.map(r => new Set(r.activeDates));

  // Date axis labels — ~7 labels
  const labelInterval = Math.max(1, Math.floor(dateRange.length / 7));
  // The final tick sits on the last cell, so a left-aligned label would run
  // past the grid's right edge — anchor that one from the right instead.
  const lastLabeledIndex = Math.floor((dateRange.length - 1) / labelInterval) * labelInterval;

  return (
    <div ref={containerRef} className="card">
      <div className="card-head"><h2>Project Activity Timeline</h2></div>
      <div style={subtitleStyles}>Code sessions by project and day</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>
        {/* Scrollable grid area */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: ROW_GAP,
            overflowX: needsScroll ? 'auto' : 'hidden',
          }}
        >
          {/* Date axis header */}
          <div style={{ display: 'flex', alignItems: 'stretch', height: AXIS_LABEL_HEIGHT, marginBottom: 4, minWidth: needsScroll ? totalGridWidth + LABEL_WIDTH : undefined }}>
            <div style={stickyLabelStyles} />
            <div style={{ display: 'flex', gap: CELL_GAP }}>
              {dateRange.map((date, i) => (
                <div
                  key={date}
                  style={{
                    width: cellSize,
                    position: 'relative',
                  }}
                >
                  {i % labelInterval === 0 && (
                    <span style={{
                      position: 'absolute',
                      bottom: 0,
                      ...(i === lastLabeledIndex ? { right: 0 } : { left: 0 }),
                      whiteSpace: 'nowrap',
                      fontSize: 9,
                      color: COLORS.axis,
                    }}>
                      {formatDayLabel(date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Project rows */}
          {visibleRows.map((row, rowIdx) => (
            <div
              key={row.project}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: rowHeight,
                minWidth: needsScroll ? totalGridWidth + LABEL_WIDTH : undefined,
              }}
            >
              <div style={{
                ...stickyLabelStyles,
                fontSize: 11,
                color: COLORS.label,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: 8,
              }} title={row.project}>
                {row.project}
              </div>
              <div style={{ display: 'flex', gap: CELL_GAP }}>
                {dateRange.map((date) => {
                  const isActive = projectSets[rowIdx].has(date);
                  return (
                    <div
                      key={date}
                      title={isActive ? `${row.project} — ${formatDayLabel(date)}` : undefined}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 1,
                        backgroundColor: isActive ? COLORS.active : COLORS.empty,
                        opacity: isActive ? 1 : 0.4,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expand / collapse controls */}
      {(hasMore || isExpanded) && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center' }}>
          {hasMore && (
            <button
              style={buttonStyles}
              onClick={() => setVisibleCount(prev => prev + INCREMENT)}
            >
              Show {Math.min(INCREMENT, rows.length - visibleCount)} more ({rows.length - visibleCount} remaining)
            </button>
          )}
          {isExpanded && (
            <button
              style={buttonStyles}
              onClick={() => setVisibleCount(INITIAL_ROWS)}
            >
              Show top {INITIAL_ROWS} only
            </button>
          )}
        </div>
      )}
    </div>
  );
}
