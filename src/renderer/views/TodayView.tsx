import React, { useEffect, useState, useCallback } from 'react';
import type { TodaySummary, TimelineEntry, DailyActivity } from '../../shared/ipc-types';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import WeeklyActivityChart from '../components/common/WeeklyActivityChart';
import SessionTimeline from '../components/common/SessionTimeline';
import { Icons } from '../components/common/Icons';

function formatCost(n: number | null): string {
  if (n == null || n === 0) return '—';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TodayView(): React.JSX.Element {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    return Promise.all([
      window.api.coworkSessions.getSummaryToday().then(setSummary),
      window.api.coworkSessions.getTimeline().then(setTimeline),
      window.api.analytics.getWeeklyActivity().then(setWeeklyActivity),
    ]).catch(err => {
      console.error('[TodayView] fetch failed:', err);
      setSummary(null);
      setTimeline([]);
      setWeeklyActivity([]);
    });
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    const unsub = window.api.onImportComplete?.((s) => {
      if (s.newRecords > 0 || s.updatedRecords > 0) {
        fetchData();
      }
    });
    return () => { unsub?.(); };
  }, [fetchData]);

  useEffect(() => {
    const unsub = window.api.onLogWatcherEvent?.(() => {
      fetchData();
    });
    return () => { unsub?.(); };
  }, [fetchData]);

  const hasAnyData = summary && summary.sessionCount > 0;
  const hasCodeData = summary && summary.codeSessionCount > 0;
  const hasCoworkData = summary && summary.coworkSessionCount > 0;

  const sessionMeta = hasAnyData
    ? `${summary.codeSessionCount} code` + (hasCoworkData ? ` · ${summary.coworkSessionCount} cowork` : '')
    : 'no data yet';

  const turnsMeta = hasCoworkData
    ? (summary.avgTurnDurationSeconds != null
      ? `avg ${formatDuration(summary.avgTurnDurationSeconds)}`
      : '')
    : (hasCodeData ? 'no cowork data yet' : 'no data yet');

  const costMeta = hasCodeData
    ? `${summary.codeSessionCount} session${summary.codeSessionCount !== 1 ? 's' : ''}`
    : 'no data yet';

  const activeMeta = summary?.lastFocusedAt
    ? `last seen ${new Date(summary.lastFocusedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : (hasCodeData ? 'no cowork data yet' : 'no data yet');

  return (
    <div className="page">
      <div className="stats-grid">
        <StatCard
          label="Sessions"
          value={hasAnyData ? summary.sessionCount : '—'}
          icon={Icons.layers}
          meta={sessionMeta}
        />
        <StatCard
          label="Cowork Turns"
          value={hasCoworkData ? summary.coworkTurnCount : '—'}
          icon={Icons.cowork}
          meta={turnsMeta}
        />
        <StatCard
          label="Code Cost"
          value={hasCodeData ? formatCost(summary.codeCostUsd) : '—'}
          unit="USD"
          icon={Icons.dollar}
          meta={costMeta}
        />
        <StatCard
          label="Active Time"
          value={summary?.activeTimeSeconds ? formatDuration(summary.activeTimeSeconds) : '—'}
          icon={Icons.clock}
          meta={activeMeta}
        />
      </div>

      {weeklyActivity.some(d => d.codeCount > 0 || d.coworkCount > 0) && (
        <WeeklyActivityChart data={weeklyActivity} />
      )}

      {loading ? (
        <div style={{ color: 'var(--text-tertiary)', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : !hasAnyData ? (
        <EmptyState
          title="No sessions recorded yet"
          message="The app is scanning for Claude Code data and connecting to the log watcher. Data will appear here automatically."
        />
      ) : (
        <SessionTimeline entries={timeline} />
      )}
    </div>
  );
}
