/**
 * Claude Code sessions view — sortable table with summary charts.
 * @see §4 "Claude Code Sessions List" in 04-wireframes.md
 */

import React from 'react';
import EmptyState from '../components/common/EmptyState';

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  height: '100%',
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

const emptyContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function CodeSessionsView(): React.JSX.Element {
  // TODO: wire up useApi(() => window.api.codeSessions.getByDateRange(range))
  // TODO: add time range selector (7d / 30d / custom) per wireframe §4
  // TODO: implement sortable table with columns: Project, Model, Input Tok, Out Tok, Cache, Cost, Date
  // TODO: add cost-by-project horizontal bar chart (Recharts BarChart)
  // TODO: add model distribution donut chart (Recharts PieChart)
  // TODO: add cache efficiency bars below the session table

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Claude Code</h1>
        {/* TODO: add [7d ▾] time range selector and search input */}
      </div>

      <div style={emptyContainerStyles}>
        <EmptyState
          title="No Code sessions yet"
          message="Claude Code session data will appear here once the JSONL importer has scanned ~/.claude/projects/. Check Settings > General for import status."
        />
      </div>
    </div>
  );
}
