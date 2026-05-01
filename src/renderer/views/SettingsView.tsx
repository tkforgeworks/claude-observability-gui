import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { ConfigPaths, LogPathStatus, DashboardConfig, ViewId, TrendsWidgetId, DatabaseStats, BackupResult } from '../../shared/ipc-types';
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

const tabBarStyles: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '1px solid var(--border-soft)',
  marginBottom: 24,
};

const tabButtonStyles = (active: boolean): React.CSSProperties => ({
  padding: '8px 20px',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--purple-primary)' : '2px solid transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  fontSize: 14,
  fontFamily: '"Poppins", sans-serif',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  marginBottom: -1,
});

const placeholderStyles: React.CSSProperties = {
  padding: 24,
  color: 'var(--text-tertiary)',
  fontSize: 14,
  fontFamily: '"Poppins", sans-serif',
  fontStyle: 'italic',
};

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general',     label: 'General' },
  { id: 'remoteSync',  label: 'Remote Sync' },
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'data',        label: 'Data' },
];

export default function SettingsView(): React.JSX.Element {
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(() => {
    const initial = (location.state as { tab?: SettingsTab } | null)?.tab;
    return initial ?? 'general';
  });

  useEffect(() => {
    const target = (location.state as { tab?: SettingsTab } | null)?.tab;
    if (target) {
      setActiveTab(target);
    }
  }, [location.key, location.state]);

  return (
    <div className="page">
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

const pathRowStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 0',
  borderBottom: '1px solid var(--border-soft)',
};

const pathLabelStyles: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontFamily: '"Poppins", sans-serif',
};

const pathValueStyles: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: '"JetBrains Mono", monospace',
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
  fontFamily: '"Poppins", sans-serif',
  backgroundColor: color === 'green' ? 'rgba(74, 222, 128, 0.12)' : color === 'amber' ? 'rgba(251, 191, 36, 0.12)' : 'rgba(248, 113, 113, 0.12)',
  color: color === 'green' ? 'var(--success)' : color === 'amber' ? 'var(--warning)' : 'var(--error)',
  border: `1px solid ${color === 'green' ? 'rgba(74, 222, 128, 0.25)' : color === 'amber' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
});

const warningBannerStyles: React.CSSProperties = {
  padding: '10px 14px',
  backgroundColor: 'rgba(251, 191, 36, 0.08)',
  border: '1px solid rgba(251, 191, 36, 0.25)',
  borderRadius: 6,
  color: 'var(--warning)',
  fontSize: 13,
  fontFamily: '"Poppins", sans-serif',
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
      <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
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
          <span style={{ ...pathValueStyles, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Claude Desktop not detected — install it or set a path override in settings.json
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>{sourceLabel}</span>
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

function LaunchOnStartupSection(): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    window.api.settings.get().then((s) => setEnabled(s.launchOnStartup));
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    await window.api.settings.update({ launchOnStartup: newValue });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
        Startup
      </h3>
      {enabled !== null && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: '"Poppins", sans-serif' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            style={{ accentColor: 'var(--purple-primary)' }}
          />
          Launch Claude Usage Monitor when I sign in to Windows
        </label>
      )}
    </div>
  );
}

function NotificationsSection(): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    window.api.settings.get().then((s) => setEnabled(s.showTrayNotifications));
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    await window.api.settings.update({ showTrayNotifications: newValue });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
        Notifications
      </h3>
      {enabled !== null && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: '"Poppins", sans-serif' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            style={{ accentColor: 'var(--purple-primary)' }}
          />
          Show tray notifications (stale chat import)
        </label>
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
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
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
                  backgroundColor: 'var(--background-light)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: '"Poppins", sans-serif',
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

      <LaunchOnStartupSection />

      <NotificationsSection />
    </div>
  );
}

function RemoteSyncTab(): React.JSX.Element {
  return (
    <div style={placeholderStyles}>
      Remote sync settings — not yet implemented
    </div>
  );
}

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
  color: 'var(--text-primary)',
  fontFamily: '"Poppins", sans-serif',
  marginBottom: 4,
};

const sectionSubtextStyles: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-tertiary)',
  fontFamily: '"Poppins", sans-serif',
  marginBottom: 12,
};

const sortableItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border-soft)',
  borderRadius: 4,
  marginBottom: 4,
  fontSize: 13,
  fontFamily: '"Poppins", sans-serif',
  color: 'var(--text-primary)',
};

const dragHandleStyles: React.CSSProperties = {
  cursor: 'grab',
  color: 'var(--text-tertiary)',
  fontSize: 16,
  userSelect: 'none',
  lineHeight: 1,
};

const toggleStyles = (on: boolean): React.CSSProperties => ({
  width: 36,
  height: 20,
  borderRadius: 10,
  backgroundColor: on ? 'var(--purple-tint)' : 'var(--background-light)',
  border: '1px solid ' + (on ? 'var(--purple-secondary)' : 'var(--border)'),
  position: 'relative',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background-color 200ms ease',
});

const toggleKnobStyles = (on: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: '50%',
  backgroundColor: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
  position: 'absolute',
  top: 2,
  left: on ? 19 : 3,
  transition: 'left 200ms ease',
});

const radioStyles = (selected: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: `2px solid ${selected ? 'var(--purple-primary)' : 'var(--border)'}`,
  backgroundColor: selected ? 'var(--purple-primary)' : 'transparent',
  cursor: 'pointer',
  flexShrink: 0,
});

const primaryButtonStyles = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  backgroundColor: disabled ? 'var(--background-light)' : 'var(--purple-tint)',
  border: '1px solid ' + (disabled ? 'var(--border)' : 'var(--purple-secondary)'),
  borderRadius: 4,
  color: disabled ? 'var(--text-tertiary)' : 'var(--purple-dark)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: '"Poppins", sans-serif',
  cursor: disabled ? 'default' : 'pointer',
});

const secondaryButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontFamily: '"Poppins", sans-serif',
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

const actionButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'var(--background-light)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: '"Poppins", sans-serif',
  cursor: 'pointer',
};

const dangerButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'rgba(248, 113, 113, 0.1)',
  border: '1px solid rgba(248, 113, 113, 0.3)',
  borderRadius: 4,
  color: 'var(--error)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: '"Poppins", sans-serif',
  cursor: 'pointer',
};

const tableCountRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  borderBottom: '1px solid var(--border-soft)',
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatOldestDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DataTab(): React.JSX.Element {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number> | null>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    window.api.data.getTableCounts().then(setTableCounts);
    window.api.data.getStats().then(setStats);
  }, []);

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupStatus(null);
    try {
      const result: BackupResult = await window.api.data.backup();
      if (result.success) {
        setBackupStatus(`Backed up to ${result.path}`);
      } else if (result.error) {
        setBackupStatus(`Backup failed: ${result.error}`);
      }
    } finally {
      setBackingUp(false);
      setTimeout(() => setBackupStatus(null), 5000);
    }
  };

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
      const counts = await window.api.data.getTableCounts();
      setTableCounts(counts);
      const newStats = await window.api.data.getStats();
      setStats(newStats);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div style={{ padding: 4 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
          Database
        </h3>
        {stats ? (
          <div>
            <div style={tableCountRowStyles}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: '"Poppins", sans-serif' }}>Path</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, maxWidth: '70%', textAlign: 'right', wordBreak: 'break-all' }}>
                {stats.path}
              </span>
            </div>
            <div style={tableCountRowStyles}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: '"Poppins", sans-serif' }}>Size</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>
                {formatBytes(stats.sizeBytes)}
              </span>
            </div>
            <div style={tableCountRowStyles}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: '"Poppins", sans-serif' }}>Mode</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>WAL</span>
            </div>
          </div>
        ) : (
          <span style={placeholderStyles}>Loading...</span>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={actionButtonStyles} onClick={handleBackup} disabled={backingUp}>
            {backingUp ? 'Backing up...' : 'Backup Database'}
          </button>
          <button style={actionButtonStyles} onClick={() => window.api.data.openFolder()}>
            Open Folder
          </button>
        </div>
        {backupStatus && (
          <p style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: backupStatus.startsWith('Backed') ? 'var(--success)' : 'var(--error)', marginTop: 8 }}>
            {backupStatus}
          </p>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
          Table Row Counts
        </h3>
        {tableCounts ? (
          <div>
            <div style={{ ...tableCountRowStyles, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)', flex: 1, fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>Table</span>
              <span style={{ color: 'var(--text-secondary)', width: 80, textAlign: 'right', fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>Rows</span>
              <span style={{ color: 'var(--text-secondary)', width: 120, textAlign: 'right', fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>Oldest Record</span>
            </div>
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <div key={key} style={{ ...tableCountRowStyles, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', flex: 1, fontFamily: '"Poppins", sans-serif' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', width: 80, textAlign: 'right' }}>
                  {(tableCounts[key] ?? 0).toLocaleString()}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, width: 120, textAlign: 'right' }}>
                  {formatOldestDate(stats?.oldestRecords[key] ?? null)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span style={placeholderStyles}>Loading...</span>
        )}
      </div>

      <div style={{ marginTop: 32, padding: 16, borderTop: '1px solid rgba(248, 113, 113, 0.2)' }}>
        <h3 style={{ fontSize: 14, color: 'var(--error)', marginBottom: 8, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: '"Poppins", sans-serif', marginBottom: 12 }}>
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
