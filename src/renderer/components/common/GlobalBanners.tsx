/**
 * Global warning/status banners rendered at the top of the content area
 * on every view. Subscribes to LogWatcher connection + health events and
 * renders a StatusBanner per active condition.
 *
 * Dismissal re-arms automatically: a new trigger (unhealthy event or
 * disconnect) advances an internal counter so any prior dismissal no
 * longer applies.
 *
 * @see CGUI-42, §10 "Warning / Status Banners" in 04-wireframes.md
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LogConnectionStatus, LogHealthStatus } from '../../../shared/ipc-types';
import StatusBanner, { type BannerAction } from './StatusBanner';

interface HealthState {
  unhealthy: boolean;
  triggerId: number;
}

interface ConnectionState {
  disconnected: boolean;
  reason: string | null;
}

export default function GlobalBanners(): React.JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();

  const [health, setHealth] = useState<HealthState>({ unhealthy: false, triggerId: 0 });
  const [healthDismissedAt, setHealthDismissedAt] = useState<number>(-1);
  const [connection, setConnection] = useState<ConnectionState>({ disconnected: false, reason: null });
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.logPath.getStatus().then((status) => {
      if (cancelled) return;
      if (!status.valid) {
        setConnection({
          disconnected: true,
          reason: status.source === 'not-found'
            ? 'Claude Desktop log not found — is Claude Desktop installed?'
            : `Log path invalid: ${status.path ?? 'unknown'}`,
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = window.api.onLogWatcherHealth?.((status: LogHealthStatus) => {
      setHealth((prev) => {
        if (!status.healthy) {
          return { unhealthy: true, triggerId: prev.triggerId + 1 };
        }
        return { unhealthy: false, triggerId: prev.triggerId };
      });
    });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => {
    const unsub = window.api.onLogWatcherConnection?.((status: LogConnectionStatus) => {
      setConnection({
        disconnected: !status.connected,
        reason: status.reason,
      });
    });
    return () => { unsub?.(); };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const result = await window.api.logWatcher.retry();
      setConnection({
        disconnected: !result.connected,
        reason: result.reason,
      });
    } catch (err) {
      console.error('[GlobalBanners] Retry failed:', err);
    } finally {
      setRetrying(false);
    }
  };

  const onSettingsView = location.pathname === '/settings';
  const settingsButtonLabel = onSettingsView ? 'Go to General Tab' : 'Open Settings';

  const connectionActions: BannerAction[] = [
    {
      label: retrying ? 'Retrying...' : 'Retry',
      onClick: handleRetry,
      disabled: retrying,
    },
    {
      label: settingsButtonLabel,
      onClick: () => navigate('/settings', { state: { tab: 'general' } }),
    },
  ];

  const showHealth = health.unhealthy && healthDismissedAt < health.triggerId;

  if (!connection.disconnected && !showHealth) return null;

  return (
    // Banners sit outside the page's scroll container, so they own their own
    // inset — without it they butt against the viewport edges and each other
    // (CGUI-70). Matches `.page`'s horizontal padding so they line up with
    // the content below.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 28px 0' }}>
      {connection.disconnected && (
        <StatusBanner
          variant="error"
          message={
            (connection.reason ?? 'Claude Desktop log file not found.') +
            ' Cowork session activity will not be tracked until this is resolved.'
          }
          actions={connectionActions}
        />
      )}
      {showHealth && (
        <StatusBanner
          variant="warning"
          message="Log format may have changed — no events parsed in several minutes despite log file growth. Some activity may not be tracked."
          onDismiss={() => setHealthDismissedAt(health.triggerId)}
        />
      )}
    </div>
  );
}
