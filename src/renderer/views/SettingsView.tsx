/**
 * Settings view — tabbed layout.
 * Tabs: General, Remote Sync, Dashboard, Data
 * @see §8 "Settings Panel" in 04-wireframes.md
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ConfigPaths, LogPathStatus, DashboardConfig, ViewId, TrendsWidgetId } from '../../shared/ipc-types';
import { useDashboardConfig } from '../contexts/DashboardConfigContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const statusBadgeStyles = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
  backgroundColor: color === 'green' ? '#1a3a1a' : color === 'amber' ? '#3a3a1a' : '#3a1a1a',
  color: color === 'green' ? '#44cc44' : color === 'amber' ? '#ccaa44' : '#cc4444',
  border: `1px solid ${color === 'green' ? '#2a4a2a' : color === 'amber' ? '#4a4a2a' : '#4a2a2a'}`,
});

const warningBannerStyles: React.CSSProperties = {
  padding: '10px 14px',
  backgroundColor: '#3a2a1a',
  border: '1px solid #4a3a2a',
  borderRadius: 6,
  color: '#ccaa44',
  fontSize: 13,
  marginTop: 8,
};

function LogPathSection(): React.JSX.Element {
  const [status, setStatus] = useState<LogPathStatus | null>(null);

  useEffect(() => {
    window.api.logPath.getStatus().then(setStatus);
  }, []);

  if (!status) {
    return <span style={placeholderStyles}>Checking log path...</span>;
  }

  const badgeColor = status.valid ? 'green' : status.source === 'not-found' ? 'amber' : 'red';
  const badgeLabel = status.valid
    ? 'Connected'
    : status.source === 'not-found'
      ? 'Not Found'
      : 'Invalid Path';
  const sourceLabel = status.source === 'auto-discovered'
    ? 'Auto-discovered (MSIX)'
    : status.source === 'settings-override'
      ? 'Settings override'
      : 'No path found';

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: '#ccccdd', marginBottom: 12 }}>
        Claude Desktop Log
      </h3>
      <div style={pathRowStyles}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={pathLabelStyles}>Log File Path</span>
          <span style={statusBadgeStyles(badgeColor)}>{badgeLabel}</span>
        </div>
        {status.path ? (
          <span style={pathValueStyles}>{status.path}</span>
        ) : (
          <span style={{ ...pathValueStyles, color: '#666688', fontStyle: 'italic' }}>
            Claude Desktop not detected — install it or set a path override in settings.json
          </span>
        )}
        <span style={{ fontSize: 11, color: '#666688' }}>{sourceLabel}</span>
      </div>
      {status.source === 'settings-override' && !status.valid && (
        <div style={warningBannerStyles}>
          The log file path override in settings does not point to a valid file.
          Remove the override to re-enable auto-discovery, or correct the path.
        </div>
      )}
    </div>
  );
}

function GeneralTab(): React.JSX.Element {
  const [paths, setPaths] = useState<ConfigPaths | null>(null);

  useEffect(() => {
    window.api.configPaths.get().then(setPaths);
  }, []);

  return (
    <div style={{ padding: 4 }}>
      <LogPathSection />

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

// ---------------------------------------------------------------------------
// Dashboard tab — label maps, styles, sortable item, and main component
// ---------------------------------------------------------------------------

const VIEW_LABELS: Record<ViewId, string> = {
  today: 'Today',
  cowork: 'Cowork Sessions',
  code: 'Code Sessions',
  chat: 'Chat History',
  trends: 'Trends',
  heatmap: 'Heatmap',
  settings: 'Settings',
};

const WIDGET_LABELS: Record<TrendsWidgetId, string> = {
  cacheEfficiency: 'Cache Efficiency',
  turnDurationTrend: 'Turn Duration Trend',
  costVelocity: 'Cost Velocity',
  sessionDensity: 'Session Density',
  modelMigration: 'Model Migration',
  projectActivityTimeline: 'Project Activity Timeline',
  usagePatternsSummary: 'Usage Patterns Summary',
};

const sectionHeaderStyles: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#ccccdd',
  marginBottom: 4,
};

const sectionSubtextStyles: React.CSSProperties = {
  fontSize: 12,
  color: '#666688',
  marginBottom: 12,
};

const sortableItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  backgroundColor: '#1a1a2e',
  border: '1px solid #2a2a4a',
  borderRadius: 4,
  marginBottom: 4,
  fontSize: 13,
  color: '#ccccdd',
};

const dragHandleStyles: React.CSSProperties = {
  cursor: 'grab',
  color: '#555577',
  fontSize: 16,
  userSelect: 'none',
  lineHeight: 1,
};

const toggleStyles = (on: boolean): React.CSSProperties => ({
  width: 36,
  height: 20,
  borderRadius: 10,
  backgroundColor: on ? '#4444aa' : '#2a2a3a',
  border: '1px solid ' + (on ? '#5555bb' : '#3a3a5a'),
  position: 'relative',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background-color 0.15s',
});

const toggleKnobStyles = (on: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: '50%',
  backgroundColor: on ? '#ffffff' : '#666688',
  position: 'absolute',
  top: 2,
  left: on ? 19 : 3,
  transition: 'left 0.15s',
});

const radioStyles = (selected: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: `2px solid ${selected ? '#6666cc' : '#444466'}`,
  backgroundColor: selected ? '#6666cc' : 'transparent',
  cursor: 'pointer',
  flexShrink: 0,
});

const primaryButtonStyles = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  backgroundColor: disabled ? '#2a2a4a' : '#4444aa',
  border: '1px solid ' + (disabled ? '#3a3a5a' : '#5555bb'),
  borderRadius: 4,
  color: disabled ? '#555577' : '#ffffff',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
});

const secondaryButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'transparent',
  border: '1px solid #3a3a5a',
  borderRadius: 4,
  color: '#8888aa',
  fontSize: 13,
  cursor: 'pointer',
};

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    ...sortableItemStyles,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <span style={dragHandleStyles} {...attributes} {...listeners}>⠿</span>
      {children}
    </div>
  );
}

function DashboardTab(): React.JSX.Element {
  const { config: contextConfig, refreshConfig } = useDashboardConfig();
  const [localConfig, setLocalConfig] = useState<DashboardConfig | null>(null);
  const [dirty, setDirty] = useState(false);

  // Clone context config into local state on first load
  useEffect(() => {
    if (contextConfig && !localConfig) {
      setLocalConfig(structuredClone(contextConfig));
    }
  }, [contextConfig, localConfig]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleViewDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localConfig) return;
    setLocalConfig(prev => {
      if (!prev) return prev;
      const oldIndex = prev.views.findIndex(v => v.id === active.id);
      const newIndex = prev.views.findIndex(v => v.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return { ...prev, views: arrayMove(prev.views, oldIndex, newIndex) };
    });
    setDirty(true);
  }, [localConfig]);

  const handleWidgetDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localConfig) return;
    setLocalConfig(prev => {
      if (!prev) return prev;
      const oldIndex = prev.trendsWidgets.findIndex(w => w.id === active.id);
      const newIndex = prev.trendsWidgets.findIndex(w => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev.trendsWidgets, oldIndex, newIndex)
        .map((w, i) => ({ ...w, order: i }));
      return { ...prev, trendsWidgets: reordered };
    });
    setDirty(true);
  }, [localConfig]);

  const toggleViewVisibility = useCallback((viewId: ViewId) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      const view = prev.views.find(v => v.id === viewId);
      if (!view) return prev;
      // Cannot hide the landing view
      if (view.defaultLanding && view.visible) return prev;
      const views = prev.views.map(v =>
        v.id === viewId ? { ...v, visible: !v.visible } : v
      );
      return { ...prev, views };
    });
    setDirty(true);
  }, []);

  const setLandingView = useCallback((viewId: ViewId) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      const views = prev.views.map(v => ({
        ...v,
        defaultLanding: v.id === viewId,
        // Ensure landing view is visible
        visible: v.id === viewId ? true : v.visible,
      }));
      return { ...prev, views };
    });
    setDirty(true);
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: TrendsWidgetId) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      const widgets = prev.trendsWidgets.map(w =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      );
      return { ...prev, trendsWidgets: widgets };
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!localConfig) return;
    await window.api.dashboard.save(localConfig);
    refreshConfig();
    setDirty(false);
  }, [localConfig, refreshConfig]);

  const handleReset = useCallback(async () => {
    const confirmed = window.confirm('Reset dashboard to defaults? This will undo all view and widget customizations.');
    if (!confirmed) return;
    const fresh = await window.api.dashboard.reset();
    setLocalConfig(structuredClone(fresh));
    refreshConfig();
    setDirty(false);
  }, [refreshConfig]);

  const handleOpenJson = useCallback(async () => {
    const paths = await window.api.configPaths.get();
    await window.api.configPaths.openFolder(paths.dashboardPath);
  }, []);

  if (!localConfig) {
    return <div style={placeholderStyles}>Loading dashboard configuration...</div>;
  }

  return (
    <div style={{ padding: 4 }}>
      {/* Navigation Views */}
      <h3 style={sectionHeaderStyles}>Navigation Views</h3>
      <p style={sectionSubtextStyles}>Drag to reorder. Toggle visibility. Set the landing view.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleViewDragEnd}>
        <SortableContext items={localConfig.views.map(v => v.id)} strategy={verticalListSortingStrategy}>
          {localConfig.views.map(v => (
            <SortableItem key={v.id} id={v.id}>
              <span style={{ flex: 1 }}>{VIEW_LABELS[v.id] ?? v.id}</span>
              <span
                title={v.defaultLanding && v.visible ? 'Cannot hide the landing view' : (v.visible ? 'Visible' : 'Hidden')}
                style={toggleStyles(v.visible)}
                onClick={() => toggleViewVisibility(v.id)}
              >
                <span style={toggleKnobStyles(v.visible)} />
              </span>
              <span
                title="Landing view"
                style={radioStyles(v.defaultLanding)}
                onClick={() => setLandingView(v.id)}
              />
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      {/* Trends Widgets */}
      <h3 style={{ ...sectionHeaderStyles, marginTop: 24 }}>Trends Widgets</h3>
      <p style={sectionSubtextStyles}>Drag to reorder. Toggle visibility.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}>
        <SortableContext items={localConfig.trendsWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
          {localConfig.trendsWidgets.map(w => (
            <SortableItem key={w.id} id={w.id}>
              <span style={{ flex: 1 }}>{WIDGET_LABELS[w.id] ?? w.id}</span>
              <span
                title={w.visible ? 'Visible' : 'Hidden'}
                style={toggleStyles(w.visible)}
                onClick={() => toggleWidgetVisibility(w.id)}
              >
                <span style={toggleKnobStyles(w.visible)} />
              </span>
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button style={primaryButtonStyles(!dirty)} onClick={handleSave} disabled={!dirty}>
          {dirty ? 'Save Changes' : 'Saved'}
        </button>
        <button style={secondaryButtonStyles} onClick={handleReset}>
          Reset to Defaults
        </button>
        <button style={secondaryButtonStyles} onClick={handleOpenJson}>
          Open JSON File
        </button>
      </div>
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

const tableCountRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  borderBottom: '1px solid #2a2a4a',
  fontSize: 13,
};

const TABLE_LABELS: Record<string, string> = {
  app_sessions: 'App Sessions',
  code_sessions: 'Code Sessions',
  cowork_sessions: 'Cowork Sessions',
  cowork_turns: 'Cowork Turns',
  chat_conversations: 'Chat Conversations',
  app_focus_events: 'Focus Events',
};

function DataTab(): React.JSX.Element {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    window.api.data.getTableCounts().then(setTableCounts);
  }, []);

  // Refresh counts after clearing the database
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
      // Refresh counts
      const counts = await window.api.data.getTableCounts();
      setTableCounts(counts);
    } finally {
      setClearing(false);
    }
  };

  // TODO: implement per wireframe §8.4
  // Database stats (path, size, mode)
  // Backup Database and Open Folder buttons
  // Chat Import drop zone (same as ChatHistoryView)
  // Log Watcher Status panel
  // Recalculate Costs button (calls window.api.costs.recalculate())
  return (
    <div style={{ padding: 4 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: '#ccccdd', marginBottom: 12 }}>
          Table Row Counts
        </h3>
        {tableCounts ? (
          <div>
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <div key={key} style={tableCountRowStyles}>
                <span style={{ color: '#8888aa' }}>{label}</span>
                <span style={{ color: '#ccccdd', fontFamily: 'monospace' }}>
                  {(tableCounts[key] ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span style={placeholderStyles}>Loading...</span>
        )}
      </div>

      <div style={placeholderStyles}>
        {/* TODO: Database info (path, size, WAL mode) */}
        {/* TODO: Backup Database and Open Folder buttons */}
        {/* TODO: Chat import drop zone */}
        {/* TODO: Log watcher status */}
        {/* TODO: Recalculate Costs action button */}
        Remaining data management — not yet implemented
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
