/**
 * Usage patterns summary: 8-stat card grid with peak hour, peak day,
 * streaks, and averages. Plus a 24-hour distribution heatbar.
 * @see CGUI-28
 */

import React from 'react';
import type { UsagePatternsData } from '../../../shared/ipc-types';

interface UsagePatternsCardProps {
  data: UsagePatternsData;
}

const COLORS = {
  bg: 'var(--background)',
  cardBg: 'var(--background-light)',
  accent: 'var(--chart-1)',
  heatLow: 'var(--background-light)',
  heatHigh: 'var(--chart-1)',
  label: 'var(--text-tertiary)',
  value: 'var(--text-primary)',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

const gridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
  marginBottom: 16,
};

const statCardStyles: React.CSSProperties = {
  backgroundColor: COLORS.cardBg,
  border: '1px solid var(--border-soft)',
  borderRadius: 6,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const statLabelStyles: React.CSSProperties = {
  fontSize: 10,
  fontFamily: '"Poppins"',
  fontWeight: 600,
  color: COLORS.label,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.14em',
};

const statValueStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 500,
  fontFamily: '"JetBrains Mono", monospace',
  color: COLORS.value,
};

const heatbarContainerStyles: React.CSSProperties = {
  marginTop: 4,
};

const heatbarLabelStyles: React.CSSProperties = {
  fontSize: 11,
  fontFamily: '"Poppins"',
  fontWeight: 600,
  color: COLORS.label,
  marginBottom: 6,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.14em',
};

const heatbarRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 2,
};

const hourLabelRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  marginTop: 3,
};

function interpolateColor(ratio: number): string {
  const r = Math.round(0x1e + (0xa8 - 0x1e) * ratio);
  const g = Math.round(0x29 + (0x55 - 0x29) * ratio);
  const b = Math.round(0x3b + (0xf7 - 0x3b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function UsagePatternsCard({ data }: UsagePatternsCardProps): React.JSX.Element | null {
  if (data.totalSessions === 0) return null;

  const maxHourly = Math.max(...data.hourlyDistribution, 1);

  const stats = [
    { label: 'Peak Hour', value: formatHour(data.peakHour) },
    { label: 'Peak Day', value: DAY_NAMES[data.peakDay] },
    { label: 'Current Streak', value: `${data.currentStreak}d` },
    { label: 'Longest Streak', value: `${data.longestStreak}d` },
    { label: 'Avg Sessions/Day', value: `${data.avgSessionsPerDay}` },
    { label: 'Avg Cost/Day', value: formatCost(data.avgCostPerDay) },
    { label: 'Total Sessions', value: `${data.totalSessions}` },
    { label: 'Active Days', value: `${data.totalActiveDays}` },
  ];

  return (
    <div className="card">
      <div className="card-head"><h2>Usage Patterns</h2></div>

      <div style={gridStyles}>
        {stats.map(s => (
          <div key={s.label} style={statCardStyles}>
            <span style={statLabelStyles}>{s.label}</span>
            <span style={statValueStyles}>{s.value}</span>
          </div>
        ))}
      </div>

      <div style={heatbarContainerStyles}>
        <div style={heatbarLabelStyles}>Hourly Distribution</div>
        <div style={heatbarRowStyles}>
          {data.hourlyDistribution.map((count, hour) => {
            const ratio = count / maxHourly;
            return (
              <div
                key={hour}
                title={`${formatHour(hour)}: ${count} sessions`}
                style={{
                  flex: 1,
                  height: 24,
                  borderRadius: 2,
                  backgroundColor: count > 0 ? interpolateColor(ratio) : COLORS.heatLow,
                  opacity: count > 0 ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>
        <div style={hourLabelRowStyles}>
          {data.hourlyDistribution.map((_, hour) => (
            <div
              key={hour}
              style={{
                flex: 1,
                fontSize: 8,
                color: COLORS.label,
                textAlign: 'center',
              }}
            >
              {hour % 3 === 0 ? `${hour}` : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
