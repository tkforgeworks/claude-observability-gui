/**
 * Settings view — tabbed layout.
 * Tabs: General, Remote Sync, Dashboard, Data
 * @see §8 "Settings Panel" in 04-wireframes.md
 */

import React, { useEffect, useState } from 'react';
import type { ConfigPaths } from '../../shared/ipc-types';

type SettingsTab = 'general' | 'remoteSync' | 'dashboard' | 'data';

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  height: '100%',
};

const headerStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ccccdd',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: 20,
};

const tabBarStyles: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '1px solid #2a2a4a',
  marginBottom: 24,
};

const tabButtonStyles = (active: boolean): React.CSSProperties => ({
  padding: '8px 20px',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid #6666cc' : '2px solid transparent',
  color: active ? '#ffffff' : '#8888aa',
  fontSize: 14,
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  marginBottom: -1,
});

const placeholderStyles: React.CSSProperties = {
  padding: 24,
  color: '#666688',
  fontSize: 14,
  fontStyle: 'italic',
};

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general',     label: 'General' },
  { id: 'remoteSync',  label: 'Remote Sync' },
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'data',        label: 'Data' },
];

export default function SettingsView(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('general');

  return (
    <div style={viewStyles}>
      <h1 style={headerStyles}>Settings</h1>

      <div style={tabBarStyles} role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            style={tabButtonStyles(activeTab === id)}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'general'    && <GeneralTab />}
        {activeTab === 'remoteSync' && <RemoteSyncTab />}
        {activeTab === 'dashboard'  && <DashboardTab />}
        {activeTab === 'data'       && <DataTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab panel stubs — each becomes its own component when implemented
// ---------------------------------------------------------------------------

const pathRowStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 0',
  borderBottom: '1px solid #2a2a4a',
};

const pathLabelStyles: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#8888aa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const pathValueStyles: React.CSSProperties = {
  fontSize: 13,
  color: '#ccccdd',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
};

function GeneralTab(): React.JSX.Element {
  const [paths, setPaths] = useState<ConfigPaths | null>(null);

  useEffect(() => {
    window.api.configPaths.get().then(setPaths);
  }, []);

  // TODO: implement per wireframe §8.1
  // Fields: Log File Path (with Browse button + auto-discovery status)
  //         Claude Code Data Path (with Browse button + last scan info)
  //         cleanupPeriodDays warning banner
  //         Behaviour checkboxes: minimize to tray, launch on startup, notifications
  return (
    <div style={{ padding: 4 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: '#ccccdd', marginBottom: 12 }}>
          Configuration Files
        </h3>
        {paths ? (
          <>
            <div style={pathRowStyles}>
              <span style={pathLabelStyles}>Settings File</span>
              <span style={pathValueStyles}>{paths.settingsPath}</span>
            </div>
            <div style={pathRowStyles}>
              <span style={pathLabelStyles}>Dashboard Config</span>
              <span style={pathValueStyles}>{paths.dashboardPath}</span>
            </div>
            <div style={pathRowStyles}>
              <span style={pathLabelStyles}>Database</span>
              <span style={pathValueStyles}>{paths.databasePath}</span>
            </div>
            <div style={{ ...pathRowStyles, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={pathLabelStyles}>Config Directory</span>
                <span style={pathValueStyles}>{paths.userDataPath}</span>
              </div>
              <button
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#2a2a4a',
                  border: '1px solid #3a3a5a',
                  borderRadius: 4,
                  color: '#ccccdd',
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => window.api.configPaths.openFolder(paths.userDataPath)}
              >
                Open Folder
              </button>
            </div>
          </>
        ) : (
          <span style={placeholderStyles}>Loading paths...</span>
        )}
      </div>

      <div style={placeholderStyles}>
        {/* TODO: Log file path input + auto-discovery status indicator */}
        {/* TODO: Claude Code data path input + last scan timestamp */}
        {/* TODO: cleanupPeriodDays warning if set to 30 or less */}
        {/* TODO: Behavior checkboxes (minimize to tray, launch on startup, notifications) */}
        Remaining general settings — not yet implemented
      </div>
    </div>
  );
}

function RemoteSyncTab(): React.JSX.Element {
  // TODO: implement per wireframe §8.2
  // Fields: Sync enabled toggle, connection profiles list,
  //         URL/Bucket/Org/Token fields for active profile,
  //         Test Connection button, Save button,
  //         Sync status panel with pending row counts, Sync Now button
  return (
    <div style={placeholderStyles}>
      {/* TODO: Sync enabled/disabled toggle */}
      {/* TODO: Connection profiles list with add/edit */}
      {/* TODO: Active profile config form (URL, bucket, org, token with safeStorage notice) */}
      {/* TODO: Test Connection and Save buttons */}
      {/* TODO: Sync status panel with pending counts and Sync Now */}
      Remote sync settings — not yet implemented
    </div>
  );
}

function DashboardTab(): React.JSX.Element {
  // TODO: implement per wireframe §8.3
  // Drag-to-reorder list of views with visibility toggles and per-view defaults
  // Separate list for trend widgets
  // Reset to Defaults and Open JSON File buttons
  return (
    <div style={placeholderStyles}>
      {/* TODO: Drag-to-reorder views list with visibility toggles */}
      {/* TODO: Per-view default config (landing, sort, time range) */}
      {/* TODO: Trends widgets reorder/toggle list */}
      {/* TODO: Reset to Defaults + Open JSON File buttons */}
      Dashboard layout settings — not yet implemented
    </div>
  );
}

const dangerButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#4a1a1a',
  border: '1px solid #6a2a2a',
  borderRadius: 4,
  color: '#ff6666',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

function DataTab(): React.JSX.Element {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      'This will permanently delete ALL data from the database (code sessions, cowork sessions, etc.). ' +
      'The schema and config files will be preserved.\n\nAre you sure?'
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      await window.api.dev.clearDatabase();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    } finally {
      setClearing(false);
    }
  };

  // TODO: implement per wireframe §8.4
  // Database stats (path, size, mode, table row counts)
  // Backup Database and Open Folder buttons
  // Chat Import drop zone (same as ChatHistoryView)
  // Log Watcher Status panel
  // Recalculate Costs button (calls window.api.costs.recalculate())
  return (
    <div style={{ padding: 4 }}>
      <div style={placeholderStyles}>
        {/* TODO: Database info (path, size, WAL mode) */}
        {/* TODO: Table row counts table */}
        {/* TODO: Backup Database and Open Folder buttons */}
        {/* TODO: Chat import drop zone */}
        {/* TODO: Log watcher status */}
        {/* TODO: Recalculate Costs action button */}
        Data management — not yet implemented
      </div>

      <div style={{ marginTop: 32, padding: '16px', borderTop: '1px solid #3a2a2a' }}>
        <h3 style={{ fontSize: 14, color: '#ff6666', marginBottom: 8 }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          Clear all data from the database. Schema and config files are preserved.
          Data will be re-imported on next scan cycle.
        </p>
        <button
          style={dangerButtonStyles}
          onClick={handleClearDatabase}
          disabled={clearing}
        >
          {clearing ? 'Clearing...' : cleared ? 'Database Cleared' : 'Clear Database'}
        </button>
      </div>
    </div>
  );
}
