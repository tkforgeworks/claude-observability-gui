import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { ConfigPaths, LogPathStatus, DashboardConfig, ViewId, TrendsWidgetId, DatabaseStats, BackupResult } from '../../shared/ipc-types';
import { useDashboardConfig } from '../contexts/DashboardConfigContext';
import Loading from '../components/common/Loading';
import { formatBytes, formatDateFull } from '../utils/format';
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

  // Switching tabs unmounts DashboardTab, which used to throw away an unsaved
  // draft without a word. The switch is now held until the draft is resolved
  // (CGUI-70).
  const dashboardHandle = useRef<DashboardTabHandle | null>(null);
  const [dashboardDirty, setDashboardDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  const handleDashboardHandle = useCallback((h: DashboardTabHandle) => {
    dashboardHandle.current = h;
    setDashboardDirty(h.dirty);
  }, []);

  const requestTab = useCallback((id: SettingsTab) => {
    if (id === activeTab) return;
    if (activeTab === 'dashboard' && dashboardDirty) {
      setPendingTab(id);
      return;
    }
    setActiveTab(id);
  }, [activeTab, dashboardDirty]);

  const focusTab = (id: SettingsTab) => document.getElementById(`settings-tab-${id}`)?.focus();

  const resolvePending = useCallback(async (action: 'save' | 'discard' | 'cancel') => {
    const target = pendingTab;
    if (action === 'cancel' || !target) { setPendingTab(null); return; }
    if (action === 'save') {
      await dashboardHandle.current?.save();
    } else {
      dashboardHandle.current?.discard();
    }
    setPendingTab(null);
    setDashboardDirty(false);
    setActiveTab(target);
    focusTab(target);
  }, [pendingTab]);

  // ARIA tabs pattern (CGUI-68): roving tabindex + arrow-key navigation
  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = TABS.findIndex(t => t.id === activeTab);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next != null) {
      e.preventDefault();
      const id = TABS[next].id;
      requestTab(id);
      focusTab(id);
    }
  };

  return (
    <div className="page">
      <div style={tabBarStyles} role="tablist" aria-label="Settings sections" onKeyDown={handleTabKeyDown}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            id={`settings-tab-${id}`}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            style={tabButtonStyles(activeTab === id)}
            onClick={() => requestTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pendingTab && (
        <div
          role="alertdialog"
          aria-label="Unsaved dashboard changes"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 6,
            border: '1px solid var(--warning)',
            background: 'rgba(251, 191, 36, 0.10)',
            fontSize: 13, fontFamily: '"Poppins", sans-serif',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ flex: 1, minWidth: 220 }}>You have unsaved dashboard changes.</span>
          <button style={primaryButtonStyles(false)} onClick={() => void resolvePending('save')}>Save</button>
          <button style={secondaryButtonStyles} onClick={() => void resolvePending('discard')}>Discard</button>
          <button style={secondaryButtonStyles} onClick={() => void resolvePending('cancel')}>Cancel</button>
        </div>
      )}

      <div role="tabpanel" id={`settings-panel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`}>
        {activeTab === 'general'    && <GeneralTab />}
        {activeTab === 'remoteSync' && <RemoteSyncTab />}
        {activeTab === 'dashboard'  && <DashboardTab onHandleChange={handleDashboardHandle} />}
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
  backgroundColor: color === 'green' ? 'rgba(74, 222, 128, 0.12)' : color === 'amber' ? 'rgba(251, 191, 36, 0.12)' : color === 'gray' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(248, 113, 113, 0.12)',
  color: color === 'green' ? 'var(--success)' : color === 'amber' ? 'var(--warning)' : color === 'gray' ? 'var(--text-tertiary)' : 'var(--error)',
  border: `1px solid ${color === 'green' ? 'rgba(74, 222, 128, 0.25)' : color === 'amber' ? 'rgba(251, 191, 36, 0.25)' : color === 'gray' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
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

/** Inline error text for settings mutations/fetches (CGUI-66) */
function SettingError({ message }: { message: string | null }): React.JSX.Element | null {
  if (!message) return null;
  return (
    <div role="alert" style={{ color: 'var(--error)', fontSize: 12, fontFamily: '"Poppins", sans-serif', marginTop: 6 }}>
      {message}
    </div>
  );
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function LogPathSection(): React.JSX.Element {
  const [status, setStatus] = useState<LogPathStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    window.api.logPath.getStatus()
      .then(setStatus)
      .catch((err: unknown) => setLoadError(`Couldn't read log path status: ${errMsg(err)}`));
  }, []);

  if (loadError) {
    return <SettingError message={loadError} />;
  }

  if (!status) {
    return <Loading label="log path" compact />;
  }

  const unsupported = status.source === 'unsupported-platform';
  const badgeColor = status.valid ? 'green' : unsupported ? 'gray' : status.source === 'not-found' ? 'amber' : 'red';
  const badgeLabel = status.valid
    ? 'Connected'
    : unsupported
      ? 'Not Supported'
      : status.source === 'not-found'
        ? 'Not Found'
        : 'Invalid Path';
  const sourceLabel = status.source === 'auto-discovered'
    ? 'Auto-discovered (MSIX)'
    : status.source === 'settings-override'
      ? 'Settings override'
      : unsupported
        ? 'Not available on this platform'
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
            {unsupported
              ? 'Claude Desktop integration is Windows-only. Set a logFilePath override in settings.json to track a log file manually.'
              : 'Claude Desktop not detected — install it or set a path override in settings.json'}
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.settings.get()
      .then((s) => setEnabled(s.launchOnStartup))
      .catch((err: unknown) => setError(`Couldn't load setting: ${errMsg(err)}`));
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    setError(null);
    try {
      await window.api.settings.update({ launchOnStartup: newValue });
    } catch (err) {
      setEnabled(!newValue); // revert — the persisted value didn't change
      setError(`Couldn't save setting: ${errMsg(err)}`);
    }
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
      <SettingError message={error} />
    </div>
  );
}

function WindowBehaviorSection(): React.JSX.Element {
  const [minimizeToTray, setMinimizeToTray] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.settings.get()
      .then((s) => setMinimizeToTray(s.minimizeToTrayOnClose))
      .catch((err: unknown) => setError(`Couldn't load setting: ${errMsg(err)}`));
  }, []);

  const handleToggle = async () => {
    const newValue = !minimizeToTray;
    setMinimizeToTray(newValue);
    setError(null);
    try {
      await window.api.settings.update({ minimizeToTrayOnClose: newValue });
    } catch (err) {
      setMinimizeToTray(!newValue);
      setError(`Couldn't save setting: ${errMsg(err)}`);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
        Window
      </h3>
      {minimizeToTray !== null && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: '"Poppins", sans-serif' }}>
          <input
            type="checkbox"
            checked={minimizeToTray}
            onChange={handleToggle}
            style={{ accentColor: 'var(--purple-primary)' }}
          />
          Keep running in the system tray when I close the window
        </label>
      )}
      <SettingError message={error} />
    </div>
  );
}

function NotificationsSection(): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.settings.get()
      .then((s) => setEnabled(s.showTrayNotifications))
      .catch((err: unknown) => setError(`Couldn't load setting: ${errMsg(err)}`));
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    setError(null);
    try {
      await window.api.settings.update({ showTrayNotifications: newValue });
    } catch (err) {
      setEnabled(!newValue);
      setError(`Couldn't save setting: ${errMsg(err)}`);
    }
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
      <SettingError message={error} />
    </div>
  );
}

function GeneralTab(): React.JSX.Element {
  const [paths, setPaths] = useState<ConfigPaths | null>(null);
  const [pathsError, setPathsError] = useState<string | null>(null);

  useEffect(() => {
    window.api.configPaths.get()
      .then(setPaths)
      .catch((err: unknown) => setPathsError(`Couldn't load config paths: ${errMsg(err)}`));
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
        ) : pathsError ? (
          <SettingError message={pathsError} />
        ) : (
          <Loading label="paths" compact />
        )}
      </div>

      <LaunchOnStartupSection />
      <WindowBehaviorSection />

      <NotificationsSection />

      <UsagePollingSection />

      <DataMigrationSection />
    </div>
  );
}

function DataMigrationSection(): React.JSX.Element {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  // Success messages auto-dismiss; failures persist until the next action so
  // an error can't silently vanish on a timer (CGUI-66)
  const showStatus = (text: string, ok: boolean) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus({ text, ok });
    if (ok) {
      statusTimer.current = setTimeout(() => setStatus(null), 10_000);
    }
  };

  const handleExport = async () => {
    setBusy('export');
    setStatus(null);
    try {
      const result = await window.api.data.exportAll();
      if (result.success) {
        showStatus(`Exported to ${result.path}`, true);
      } else if (result.error) {
        showStatus(`Export failed: ${result.error}`, false);
      }
    } catch (err) {
      showStatus(`Export failed: ${errMsg(err)}`, false);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    const confirmed = window.confirm(
      'Import adds history from a previously exported bundle and applies its preferences. ' +
      'Existing data is never overwritten or deleted.\n\nContinue?'
    );
    if (!confirmed) return;

    setBusy('import');
    setStatus(null);
    try {
      const result = await window.api.data.importAll();
      if (result.success && result.summary) {
        const s = result.summary;
        const from = s.sourceHostname ? ` from ${s.sourceHostname}` : '';
        showStatus(
          `Imported ${s.totalImported} new record${s.totalImported === 1 ? '' : 's'}${from} ` +
          `(${s.totalSkipped} already present). Restart the app to apply imported preferences.`,
          true
        );
      } else if (result.success) {
        // Success with no summary (shouldn't happen, but don't stay silent)
        showStatus('Import completed.', true);
      } else if (result.error) {
        showStatus(`Import failed: ${result.error}`, false);
      }
      // No error + no success = user cancelled the file picker — stay silent
    } catch (err) {
      showStatus(`Import failed: ${errMsg(err)}`, false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
        Moving to a new computer?
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px', fontFamily: '"Poppins", sans-serif', maxWidth: 520 }}>
        Export all your data — usage history, preferences, and dashboard layout — into a
        single file, then import it on another install. Importing merges histories without
        overwriting anything, so it also works for combining data from two machines.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={actionButtonStyles} onClick={handleExport} disabled={busy !== null}>
          {busy === 'export' ? 'Exporting...' : 'Export All Data'}
        </button>
        <button style={actionButtonStyles} onClick={handleImport} disabled={busy !== null}>
          {busy === 'import' ? 'Importing...' : 'Import Data'}
        </button>
      </div>
      {status && (
        <p style={{ fontSize: 12, fontFamily: '"Poppins", sans-serif', color: status.ok ? 'var(--success)' : 'var(--error)', marginTop: 8, maxWidth: 520 }}>
          {status.text}
        </p>
      )}
    </div>
  );
}

/**
 * cship rewrites the usage-limit files with a ~60s expiry, and expired files
 * are skipped entirely, so any interval above 60s guarantees most polls land
 * on an already-expired file and capture nothing. The old set started at 1
 * minute and defaulted the UI to 5, which meant the default configuration
 * could not collect data. Sub-minute options are the useful ones; the longer
 * intervals stay only for deliberately low-power setups (CGUI-70).
 */
const POLL_INTERVAL_OPTIONS = [
  { label: '30 seconds', value: 30_000 },
  { label: '60 seconds (recommended)', value: 60_000 },
  { label: '2 minutes (misses most windows)',  value: 120_000 },
  { label: '5 minutes (misses most windows)',  value: 300_000 },
  { label: '15 minutes (misses most windows)', value: 900_000 },
];

const POLL_TTL_CAVEAT =
  'Usage files expire about 60 seconds after Claude Code refreshes them, and ' +
  'expired files are skipped rather than counted as zero. Intervals longer ' +
  'than 60 seconds will miss most collection windows.';

const RETENTION_MIN = 1;
const RETENTION_MAX = 365;

function UsagePollingSection(): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  // Named pollIntervalMs, not `interval`: the old pair shadowed the global
  // setInterval inside this component (CGUI-70).
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(60_000);
  const [retention, setRetention] = useState<number>(90);
  // Retention is edited as raw text and only parsed on blur. Parsing on every
  // keystroke made clearing the field snap to 90 mid-edit, and `Number('')
  // || 90` silently accepted out-of-range values that the max attribute only
  // enforced in the spinner UI.
  const [retentionDraft, setRetentionDraft] = useState<string>('90');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setEnabled(s.usageLimitPollingEnabled);
      setPollIntervalMs(s.usageLimitPollIntervalMs);
      setRetention(s.usageLimitRetentionDays);
      setRetentionDraft(String(s.usageLimitRetentionDays));
    }).catch((err: unknown) => setError(`Couldn't load settings: ${errMsg(err)}`));
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    setError(null);
    try {
      await window.api.settings.update({ usageLimitPollingEnabled: newValue });
    } catch (err) {
      setEnabled(!newValue);
      setError(`Couldn't save setting: ${errMsg(err)}`);
    }
  };

  const handleIntervalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prev = pollIntervalMs;
    const val = Number(e.target.value);
    setPollIntervalMs(val);
    setError(null);
    try {
      await window.api.settings.update({ usageLimitPollIntervalMs: val });
    } catch (err) {
      setPollIntervalMs(prev);
      setError(`Couldn't save setting: ${errMsg(err)}`);
    }
  };

  // Commit on blur: clamp into range, and fall back to the last saved value
  // if the field was left empty or unparseable.
  const handleRetentionCommit = async () => {
    const parsed = Number(retentionDraft);
    const val = Number.isFinite(parsed) && retentionDraft.trim() !== ''
      ? Math.min(RETENTION_MAX, Math.max(RETENTION_MIN, Math.round(parsed)))
      : retention;

    setRetentionDraft(String(val));
    if (val === retention) return;

    const prev = retention;
    setRetention(val);
    setError(null);
    try {
      await window.api.settings.update({ usageLimitRetentionDays: val });
    } catch (err) {
      setRetention(prev);
      setRetentionDraft(String(prev));
      setError(`Couldn't save setting: ${errMsg(err)}`);
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px',
    backgroundColor: 'var(--background-light)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: '"Poppins", sans-serif',
  };

  const inputStyle: React.CSSProperties = {
    ...selectStyle,
    width: 60,
    textAlign: 'right',
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
        Usage Limit Polling
      </h3>
      {enabled !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: '"Poppins", sans-serif' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              style={{ accentColor: 'var(--purple-primary)' }}
            />
            Enable usage limit tracking
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: '"Poppins", sans-serif', paddingLeft: 24 }}>
            <span id="poll-interval-label">Poll interval:</span>
            <select
              aria-labelledby="poll-interval-label"
              aria-describedby="poll-interval-caveat"
              value={pollIntervalMs}
              onChange={handleIntervalChange}
              style={selectStyle}
              disabled={!enabled}
            >
              {POLL_INTERVAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <p id="poll-interval-caveat" style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, paddingLeft: 24, maxWidth: 520, lineHeight: 1.5, fontFamily: '"Poppins", sans-serif' }}>
            {POLL_TTL_CAVEAT}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: '"Poppins", sans-serif', paddingLeft: 24 }}>
            <span id="retention-label">Data retention:</span>
            <input
              type="number"
              aria-labelledby="retention-label"
              value={retentionDraft}
              onChange={(e) => setRetentionDraft(e.target.value)}
              onBlur={handleRetentionCommit}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              min={RETENTION_MIN}
              max={RETENTION_MAX}
              style={inputStyle}
              disabled={!enabled}
            />
            <span>days ({RETENTION_MIN}&ndash;{RETENTION_MAX})</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, paddingLeft: 24, fontFamily: '"Poppins", sans-serif' }}>
            Interval and toggle changes take effect on next app restart.
          </p>
        </div>
      )}
      <SettingError message={error} />
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
  projects: 'Projects',
  trends: 'Trends',
  heatmap: 'Heatmap',
  usage: 'Usage Limits',
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
  label,
  children,
}: {
  id: string;
  label: string;
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
      {/* dnd-kit gives the handle button semantics; without a label it
          announces as the literal "⠿" glyph (CGUI-68) */}
      <span style={dragHandleStyles} aria-label={`Reorder ${label}`} {...attributes} {...listeners}>⠿</span>
      {children}
    </div>
  );
}

/**
 * Lets the parent intercept a tab switch that would discard an unsaved draft.
 * Only the flag and two actions cross the boundary — the draft itself stays
 * owned by DashboardTab (CGUI-70).
 */
interface DashboardTabHandle {
  dirty: boolean;
  save: () => Promise<void>;
  discard: () => void;
}

function DashboardTab({ onHandleChange }: { onHandleChange?: (h: DashboardTabHandle) => void }): React.JSX.Element {
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

  const [saveBusy, setSaveBusy] = useState<'save' | 'reset' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!localConfig || saveBusy) return;
    setSaveBusy('save');
    setSaveError(null);
    try {
      await window.api.dashboard.save(localConfig);
      refreshConfig();
      setDirty(false);
    } catch (err) {
      setSaveError(`Couldn't save dashboard config: ${errMsg(err)}`);
    } finally {
      setSaveBusy(null);
    }
  }, [localConfig, refreshConfig, saveBusy]);

  const handleReset = useCallback(async () => {
    if (saveBusy) return;
    const confirmed = window.confirm('Reset dashboard to defaults? This will undo all view and widget customizations.');
    if (!confirmed) return;
    setSaveBusy('reset');
    setSaveError(null);
    try {
      const fresh = await window.api.dashboard.reset();
      setLocalConfig(structuredClone(fresh));
      refreshConfig();
      setDirty(false);
    } catch (err) {
      setSaveError(`Couldn't reset dashboard config: ${errMsg(err)}`);
    } finally {
      setSaveBusy(null);
    }
  }, [refreshConfig, saveBusy]);

  // Discard drops the draft back to the persisted config; the load effect
  // re-clones from context on the next render.
  const handleDiscard = useCallback(() => {
    setLocalConfig(contextConfig ? structuredClone(contextConfig) : null);
    setDirty(false);
    setSaveError(null);
  }, [contextConfig]);

  useEffect(() => {
    onHandleChange?.({ dirty, save: handleSave, discard: handleDiscard });
  }, [onHandleChange, dirty, handleSave, handleDiscard]);

  const handleOpenJson = useCallback(async () => {
    const paths = await window.api.configPaths.get();
    await window.api.configPaths.openFolder(paths.dashboardPath);
  }, []);

  if (!localConfig) {
    return <Loading label="dashboard configuration" compact />;
  }

  return (
    <div style={{ padding: 4 }}>
      <h3 style={sectionHeaderStyles}>Navigation Views</h3>
      <p style={sectionSubtextStyles}>Drag to reorder. Toggle visibility. Set the landing view.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleViewDragEnd}>
        <SortableContext items={localConfig.views.map(v => v.id)} strategy={verticalListSortingStrategy}>
          {localConfig.views.map(v => (
            <SortableItem key={v.id} id={v.id} label={VIEW_LABELS[v.id] ?? v.id}>
              <span style={{ flex: 1 }}>{VIEW_LABELS[v.id] ?? v.id}</span>
              <button
                type="button"
                role="switch"
                aria-checked={v.visible}
                aria-label={`Show ${VIEW_LABELS[v.id] ?? v.id} in sidebar`}
                title={v.defaultLanding && v.visible ? 'Cannot hide the landing view' : (v.visible ? 'Visible' : 'Hidden')}
                style={{ ...toggleStyles(v.visible), border: 'none', padding: 0 }}
                onClick={() => toggleViewVisibility(v.id)}
              >
                <span style={toggleKnobStyles(v.visible)} />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={v.defaultLanding}
                aria-label={`Set ${VIEW_LABELS[v.id] ?? v.id} as landing view`}
                title="Landing view"
                style={{ ...radioStyles(v.defaultLanding), padding: 0 }}
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
            <SortableItem key={w.id} id={w.id} label={WIDGET_LABELS[w.id] ?? w.id}>
              <span style={{ flex: 1 }}>{WIDGET_LABELS[w.id] ?? w.id}</span>
              <button
                type="button"
                role="switch"
                aria-checked={w.visible}
                aria-label={`Show ${WIDGET_LABELS[w.id] ?? w.id} widget`}
                title={w.visible ? 'Visible' : 'Hidden'}
                style={{ ...toggleStyles(w.visible), border: 'none', padding: 0 }}
                onClick={() => toggleWidgetVisibility(w.id)}
              >
                <span style={toggleKnobStyles(w.visible)} />
              </button>
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button style={primaryButtonStyles(!dirty || saveBusy !== null)} onClick={handleSave} disabled={!dirty || saveBusy !== null}>
          {saveBusy === 'save' ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
        </button>
        <button style={secondaryButtonStyles} onClick={handleReset} disabled={saveBusy !== null}>
          {saveBusy === 'reset' ? 'Resetting...' : 'Reset to Defaults'}
        </button>
        <button style={secondaryButtonStyles} onClick={handleOpenJson}>
          Open JSON File
        </button>
      </div>
      <SettingError message={saveError} />
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
  usage_snapshots: 'Usage Snapshots',
};

/**
 * The row list is driven by what the query actually returns, with this map
 * supplying nicer names. Rendering `Object.entries(TABLE_LABELS)` instead
 * meant any table missing from the map — usage_snapshots, every future one —
 * was silently absent from the counts (CGUI-70).
 */
function tableLabel(key: string): string {
  return TABLE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function DataTab(): React.JSX.Element {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number> | null>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.data.getTableCounts()
      .then(setTableCounts)
      .catch((err: unknown) => setStatsError(`Couldn't load database stats: ${errMsg(err)}`));
    window.api.data.getStats()
      .then(setStats)
      .catch((err: unknown) => setStatsError(`Couldn't load database stats: ${errMsg(err)}`));
    return () => {
      if (backupTimer.current) clearTimeout(backupTimer.current);
    };
  }, []);

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupStatus(null);
    if (backupTimer.current) clearTimeout(backupTimer.current);
    let failed = false;
    try {
      const result: BackupResult = await window.api.data.backup();
      if (result.success) {
        setBackupStatus(`Backed up to ${result.path}`);
      } else if (result.error) {
        failed = true;
        setBackupStatus(`Backup failed: ${result.error}`);
      }
    } catch (err) {
      failed = true;
      setBackupStatus(`Backup failed: ${errMsg(err)}`);
    } finally {
      setBackingUp(false);
      // Success auto-dismisses; failures persist until the next backup (CGUI-66)
      if (!failed) {
        backupTimer.current = setTimeout(() => setBackupStatus(null), 5000);
      }
    }
  };

  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      'This will permanently delete ALL data from the database (code sessions, cowork sessions, etc.). ' +
      'The schema and config files will be preserved.\n\nAre you sure?'
    );
    if (!confirmed) return;

    setClearing(true);
    setClearError(null);
    try {
      await window.api.dev.clearDatabase();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
      const counts = await window.api.data.getTableCounts();
      setTableCounts(counts);
      const newStats = await window.api.data.getStats();
      setStats(newStats);
    } catch (err) {
      setClearError(`Clear failed: ${errMsg(err)}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div style={{ padding: 4 }}>
      <SettingError message={statsError} />
      <SettingError message={clearError} />
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
              <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>{stats?.journalMode ?? '—'}</span>
            </div>
          </div>
        ) : (
          <Loading compact />
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
          <p style={{ fontSize: 12, fontFamily: '"Poppins", sans-serif', color: backupStatus.startsWith('Backed') ? 'var(--success)' : 'var(--error)', marginTop: 8 }}>
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
            {Object.keys(tableCounts).sort((a, b) => tableLabel(a).localeCompare(tableLabel(b))).map((key) => (
              <div key={key} style={{ ...tableCountRowStyles, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', flex: 1, fontFamily: '"Poppins", sans-serif' }}>{tableLabel(key)}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', width: 80, textAlign: 'right' }}>
                  {(tableCounts[key] ?? 0).toLocaleString()}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, width: 120, textAlign: 'right' }}>
                  {formatDateFull(stats?.oldestRecords[key] ?? null)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Loading compact />
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
