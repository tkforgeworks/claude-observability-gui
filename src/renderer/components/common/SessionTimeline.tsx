/**
 * Horizontal session timeline for the Today view.
 * Renders code and cowork sessions as color-coded blocks positioned by time.
 * Cowork blocks show thin vertical tick marks for each turn.
 * @see CGUI-18
 */

import { formatDuration as sharedFormatDuration, formatHour } from '../../utils/format';

const formatHourOfDate = (d: Date) => formatHour(d.getHours(), { style: 'compact' });
import React, { useMemo } from 'react';
import type { TimelineEntry } from '../../../shared/ipc-types';

interface SessionTimelineProps {
  entries: TimelineEntry[];
}

const CODE_COLOR = 'var(--chart-1)';
const COWORK_COLOR = 'var(--chart-5)';
const TURN_TICK_COLOR = 'rgba(255, 255, 255, 0.65)';

const trackStyles: React.CSSProperties = {
  position: 'relative',
  height: 40,
  backgroundColor: 'var(--background-light)',
  borderRadius: 4,
  overflow: 'hidden',
};

const hourLabelsStyles: React.CSSProperties = {
  position: 'relative',
  height: 16,
  marginTop: 2,
};

/** Compute the time axis range: 24h window snapped to hour boundaries. */
function computeAxis(entries: TimelineEntry[], now: Date): { start: number; end: number } {
  // End is always the next hour from now
  const end = new Date(now);
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() + 1);

  if (entries.length === 0) {
    const start = new Date(end);
    start.setHours(start.getHours() - 12);
    return { start: start.getTime(), end: end.getTime() };
  }

  // Start from the earliest session, but never more than 24h ago
  const earliest = Math.min(...entries.map(e => new Date(e.startedAt).getTime()));
  const floor24h = now.getTime() - 24 * 60 * 60 * 1000;
  const start = new Date(Math.max(earliest, floor24h));
  start.setMinutes(0, 0, 0);

  return { start: start.getTime(), end: end.getTime() };
}

function toPercent(time: number, axisStart: number, axisEnd: number): number {
  const range = axisEnd - axisStart;
  if (range === 0) return 0;
  return Math.max(0, Math.min(100, ((time - axisStart) / range) * 100));
}

function formatDuration(ms: number): string {
  return sharedFormatDuration(ms / 1000, { style: 'hm' });
}

function SessionBlock({ entry, axisStart, axisEnd, now }: {
  entry: TimelineEntry;
  axisStart: number;
  axisEnd: number;
  now: number;
}) {
  const rawStartMs = new Date(entry.startedAt).getTime();
  const endMs = entry.endedAt ? new Date(entry.endedAt).getTime() : now;
  const isOpen = !entry.endedAt;

  // Clamp start to axis bounds so sessions starting before the window are truncated
  const startMs = Math.max(rawStartMs, axisStart);

  const left = toPercent(startMs, axisStart, axisEnd);
  const right = toPercent(endMs, axisStart, axisEnd);
  const width = Math.max(right - left, 0.3); // minimum visible width

  const isCode = entry.type === 'code';
  const bgColor = isCode ? CODE_COLOR : COWORK_COLOR;

  const durationMs = endMs - startMs;
  const projectLabel = entry.projectPath
    ? entry.projectPath.split(/[\\/]/).pop() || entry.projectPath
    : null;

  const tooltip = [
    `${entry.type === 'code' ? 'Code' : 'Cowork'} session`,
    projectLabel ? `Project: ${projectLabel}` : null,
    `Duration: ${formatDuration(durationMs)}`,
    isOpen ? '(still running)' : null,
    entry.turnTimestamps.length > 0 ? `Turns: ${entry.turnTimestamps.length}` : null,
  ].filter(Boolean).join('\n');

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    top: isCode ? 2 : 20,
    height: 18,
    left: `${left}%`,
    width: `${width}%`,
    backgroundColor: bgColor,
    opacity: isOpen ? 0.7 : 1,
    borderRadius: 3,
    cursor: 'default',
    borderRight: isOpen ? '2px dashed rgba(255,255,255,0.4)' : 'none',
    transition: 'opacity 0.15s',
  };

  return (
    <div style={blockStyle} title={tooltip}>
      {/* Turn tick marks for cowork sessions */}
      {entry.turnTimestamps.map((ts, i) => {
        const turnMs = new Date(ts).getTime();
        const tickPos = toPercent(turnMs, startMs, endMs);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${tickPos}%`,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: TURN_TICK_COLOR,
            }}
          />
        );
      })}
    </div>
  );
}

export default function SessionTimeline({ entries }: SessionTimelineProps): React.JSX.Element {
  const now = useMemo(() => new Date(), []);
  const { start: axisStart, end: axisEnd } = useMemo(
    () => computeAxis(entries, now),
    [entries, now]
  );

  // Generate hour markers
  const hourMarkers = useMemo(() => {
    const markers: Date[] = [];
    const d = new Date(axisStart);
    // Start from the first full hour
    if (d.getMinutes() !== 0) {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
    }
    while (d.getTime() <= axisEnd) {
      markers.push(new Date(d));
      d.setHours(d.getHours() + 1);
    }
    return markers;
  }, [axisStart, axisEnd]);

  // Thin out labels if too many (show every 2nd or 3rd)
  const labelInterval = hourMarkers.length > 16 ? 3 : hourMarkers.length > 8 ? 2 : 1;

  return (
    <div className="card">
      <div className="card-head"><h2>Session Timeline</h2></div>

      <div style={trackStyles}>
        {/* Hour gridlines */}
        {hourMarkers.map((h, i) => {
          const pct = toPercent(h.getTime(), axisStart, axisEnd);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: 'var(--border-soft)',
              }}
            />
          );
        })}

        {/* Session blocks — code on top row, cowork on bottom */}
        {entries.map((entry) => (
          <SessionBlock
            key={`${entry.type}-${entry.sessionId}`}
            entry={entry}
            axisStart={axisStart}
            axisEnd={axisEnd}
            now={now.getTime()}
          />
        ))}
      </div>

      {/* Hour labels */}
      <div style={hourLabelsStyles}>
        {hourMarkers.map((h, i) => {
          if (i % labelInterval !== 0) return null;
          const pct = toPercent(h.getTime(), axisStart, axisEnd);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                transform: 'translateX(-50%)',
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: 'var(--text-tertiary)',
              }}
            >
              {formatHourOfDate(h)}
            </span>
          );
        })}
      </div>

      <div className="legend" style={{ marginTop: 4 }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: CODE_COLOR, marginRight: 4, verticalAlign: 'middle' }} />Code</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: COWORK_COLOR, marginRight: 4, verticalAlign: 'middle' }} />Cowork</span>
      </div>
    </div>
  );
}
