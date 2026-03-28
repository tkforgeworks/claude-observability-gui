/**
 * Cowork sessions view — sortable table with expandable rows.
 * @see §3 "Cowork Sessions List" in 04-wireframes.md
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

export default function CoworkSessionsView(): React.JSX.Element {
  // TODO: wire up useApi(() => window.api.coworkSessions.getAll(range))
  // TODO: add search input and sort dropdown per wireframe §3
  // TODO: implement sortable table with columns: Title, Date, Turns, Duration, Avg Turn
  // TODO: implement expandable rows showing turn-level breakdown + histogram
  // TODO: add pagination (Showing N of M sessions)

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Cowork Sessions</h1>
        {/* TODO: add [search...] and [sort ▾] controls */}
      </div>

      <div style={emptyContainerStyles}>
        <EmptyState
          title="No Cowork sessions yet"
          message="Cowork session data is collected from the Claude Desktop log file. Ensure Claude Desktop is running and the log watcher is connected. Check Settings > General."
        />
      </div>
    </div>
  );
}
