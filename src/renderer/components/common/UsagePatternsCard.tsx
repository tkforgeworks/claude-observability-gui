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
  bg: '#16162a',
  cardBg: '#1e1e38',
  accent: '#6688cc',
  heatLow: '#1e1e36',
  heatHigh: '#6688cc',
  label: '#666688',
  value: '#ccccdd',
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

const containerStyles: React.CSSProperties = {
  backgroundColor: COLORS.bg,
  borderRadius: 8,
  padding: '16px 16px 12px',
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

const gridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
  marginBottom: 16,
};

const statCardStyles: React.CSSProperties = {
  backgroundColor: COLORS.cardBg,
  borderRadius: 6,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const statLabelStyles: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.label,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.3px',
};

const statValueStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: COLORS.value,
};

const heatbarContainerStyles: React.CSSProperties = {
  marginTop: 4,
};

const heatbarLabelStyles: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.label,
  marginBottom: 6,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.3px',
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
  // From heatLow (#1e1e36) to heatHigh (#6688cc)
  const r = Math.round(0x1e + (0x66 - 0x1e) * ratio);
  const g = Math.round(0x1e + (0x88 - 0x1e) * ratio);
  const b = Math.round(0x36 + (0xcc - 0x36) * ratio);
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
    <div style={containerStyles}>
      <div style={titleStyles}>Usage Patterns</div>

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
