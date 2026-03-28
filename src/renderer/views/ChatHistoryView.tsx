/**
 * Chat history view — conversation count over time, import status, drop zone.
 * @see §5 "Chat History View" in 04-wireframes.md
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

const headerStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ccccdd',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const dropZoneStyles: React.CSSProperties = {
  border: '2px dashed #3344aa',
  borderRadius: 8,
  padding: 40,
  textAlign: 'center',
  color: '#8888aa',
  fontSize: 14,
  cursor: 'pointer',
  backgroundColor: 'rgba(51, 68, 170, 0.05)',
};

const emptyContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
};

export default function ChatHistoryView(): React.JSX.Element {
  // TODO: check for last import timestamp and show StatusBanner if > 14 days old
  // TODO: wire up useApi for conversation count / chart data
  // TODO: implement conversations per week line chart (Recharts LineChart)
  // TODO: implement import summary section
  // TODO: implement drag-and-drop on the drop zone — call window.api.chatImport.start(filePath)

  const handleDropZoneClick = () => {
    // TODO: open file picker dialog and call window.api.chatImport.start(filePath)
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // TODO: extract dropped file path and call window.api.chatImport.start(filePath)
  };

  return (
    <div style={viewStyles}>
      <h1 style={headerStyles}>Chat History</h1>

      {/* TODO: StatusBanner if last import is stale (> 14 days) */}

      <div style={emptyContainerStyles}>
        <EmptyState
          title="No chat history imported"
          message="Drop your claude.ai data export ZIP below, or request an export from claude.ai > Settings > Privacy > Export data."
        />

        {/* Drop zone per wireframe §5 */}
        <div
          style={dropZoneStyles}
          onClick={handleDropZoneClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Drop claude.ai export ZIP here or click to browse"
        >
          <div>Drop claude.ai export ZIP here</div>
          <div style={{ marginTop: 4, opacity: 0.7 }}>or click to browse</div>
        </div>
      </div>
    </div>
  );
}
