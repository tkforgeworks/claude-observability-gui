/**
 * Usage heatmap view — GitHub-style calendar heatmap.
 * Intensity = distinct session count per day across all sources.
 * @see §6 "Usage Heatmap" in 04-wireframes.md
 */

import React from 'react';
import EmptyState from '../components/common/EmptyState';

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
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

export default function HeatmapView(): React.JSX.Element {
  // TODO: implement GitHub-style calendar heatmap
  // - Fetch daily session counts across all sources (cowork + code + chat)
  // - Render 52-week grid with color intensity by session count
  //   Intensity buckets per wireframe §6: 0-1, 2-4, 5-8, 9+
  // - Hover tooltip showing date, session count by source
  // - Time range selector: 12 months (default), 6 months, 3 months
  // Consider using a heatmap library or implement with SVG/div grid

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Usage Heatmap</h1>
        {/* TODO: add time range selector [12 months] */}
      </div>

      <EmptyState
        title="No activity data yet"
        message="The heatmap will show your Claude usage intensity over time once session data has been collected across Cowork, Code, and Chat sources."
      />
    </div>
  );
}
