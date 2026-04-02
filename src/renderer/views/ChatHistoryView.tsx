/**
 * Chat history view — conversation count over time, import status, drop zone.
 * @see §5 "Chat History View" in 04-wireframes.md
 */

import React, { useState, useCallback } from 'react';
import EmptyState from '../components/common/EmptyState';
import type { ImportSummary } from '../../shared/ipc-types';

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

const dropZoneBaseStyles: React.CSSProperties = {
  border: '2px dashed #3344aa',
  borderRadius: 8,
  padding: 40,
  textAlign: 'center',
  color: '#8888aa',
  fontSize: 14,
  cursor: 'pointer',
  backgroundColor: 'rgba(51, 68, 170, 0.05)',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const dropZoneActiveStyles: React.CSSProperties = {
  ...dropZoneBaseStyles,
  borderColor: '#6666cc',
  backgroundColor: 'rgba(102, 102, 204, 0.12)',
};

const emptyContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
};

const summaryStyles: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  backgroundColor: 'rgba(51, 68, 170, 0.1)',
  border: '1px solid #3344aa',
  color: '#ccccdd',
  fontSize: 13,
  lineHeight: 1.6,
};

const errorStyles: React.CSSProperties = {
  ...summaryStyles,
  backgroundColor: 'rgba(170, 51, 51, 0.1)',
  borderColor: '#aa3333',
  color: '#dd8888',
};

export default function ChatHistoryView(): React.JSX.Element {
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runImport = useCallback(async (filePath: string) => {
    setImporting(true);
    setError(null);
    setLastSummary(null);
    try {
      const summary = await window.api.chatImport.start(filePath);
      setLastSummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }, []);

  const handleDropZoneClick = useCallback(async () => {
    if (importing) return;
    const filePath = await window.api.dialog.openFile([
      { name: 'ZIP Archives', extensions: ['zip'] },
    ]);
    if (filePath) {
      runImport(filePath);
    }
  }, [importing, runImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (importing) return;

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      const filePath = window.api.dialog.getFilePath(file);
      runImport(filePath);
    } else {
      setError('Please drop a .zip file exported from claude.ai');
    }
  }, [importing, runImport]);

  return (
    <div style={viewStyles}>
      <h1 style={headerStyles}>Chat History</h1>

      <div style={emptyContainerStyles}>
        {!lastSummary && !error && (
          <EmptyState
            title="No chat history imported"
            message="Drop your claude.ai data export ZIP below, or request an export from claude.ai > Settings > Privacy > Export data."
          />
        )}

        {/* Import summary */}
        {lastSummary && (
          <div style={summaryStyles}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#aaaacc' }}>
              Import Complete
            </div>
            <div>{lastSummary.newRecords} new records imported</div>
            <div>{lastSummary.updatedRecords} records updated</div>
            <div>{lastSummary.skippedRecords} records unchanged</div>
            {lastSummary.errorCount > 0 && (
              <div style={{ color: '#dd8888' }}>{lastSummary.errorCount} errors</div>
            )}
            <div style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>
              Completed in {lastSummary.scanDurationMs}ms
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={errorStyles}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Import Failed</div>
            <div>{error}</div>
          </div>
        )}

        {/* Drop zone */}
        <div
          style={dragOver ? dropZoneActiveStyles : dropZoneBaseStyles}
          onClick={handleDropZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Drop claude.ai export ZIP here or click to browse"
        >
          {importing ? (
            <div style={{ color: '#6666cc' }}>Importing...</div>
          ) : (
            <>
              <div>Drop claude.ai export ZIP here</div>
              <div style={{ marginTop: 4, opacity: 0.7 }}>or click to browse</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
