/**
 * Today view — default landing screen.
 * Shows four headline metric cards in empty/no-data state.
 * @see §1 "Today View" and §11.1 "First Run — No Data" in 04-wireframes.md
 */

import React from 'react';
import MetricCard from '../components/common/MetricCard';
import EmptyState from '../components/common/EmptyState';

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  height: '100%',
};

const headerStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ccccdd',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const metricsRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
};

const sectionStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function TodayView(): React.JSX.Element {
  // TODO: replace with useApi(() => window.api.coworkSessions.getSummaryToday())
  // once the query layer is implemented. Show real values when data is available.

  return (
    <div style={viewStyles}>
      <h1 style={headerStyles}>Today — {getTodayLabel()}</h1>

      {/* Metric cards — empty state per §11.1 wireframe */}
      <div style={metricsRowStyles}>
        <MetricCard
          value="—"
          label="Sessions"
          secondaryStat="no data yet"
        />
        <MetricCard
          value="—"
          label="Cowork Turns"
          secondaryStat="no data yet"
        />
        <MetricCard
          value="—"
          label="Code Cost Today"
          secondaryStat="no data yet"
        />
        <MetricCard
          value="—"
          label="Active Time"
          secondaryStat="no data yet"
        />
      </div>

      {/* Timeline area — empty state */}
      <div style={sectionStyles}>
        <EmptyState
          title="No sessions recorded yet"
          message="The app is scanning for Claude Code data and connecting to the log watcher. Data will appear here automatically."
        />
      </div>
    </div>
  );
}
