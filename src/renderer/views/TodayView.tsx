/**
 * Today view — default landing screen.
 * Shows four headline metric cards with real data from TodaySummary.
 * Handles three states: no data, partial data (code but no cowork), full data.
 * @see §1 "Today View" and §11.1/§11.2 in 04-wireframes.md
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { TodaySummary, TimelineEntry, DailyActivity } from '../../shared/ipc-types';
import MetricCard from '../components/common/MetricCard';
import EmptyState from '../components/common/EmptyState';
import WeeklyActivityChart from '../components/common/WeeklyActivityChart';
import SessionTimeline from '../components/common/SessionTimeline';

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

const metricsRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
};

const sectionStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCost(n: number | null): string {
  if (n == null || n === 0) return '—';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m`;
  return `~${m}m`;
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

  // Auto-refresh when importer completes a scan
  useEffect(() => {
    const unsub = window.api.onImportComplete?.((s) => {
      if (s.newRecords > 0 || s.updatedRecords > 0) {
        fetchData();
      }
    });
    return () => { unsub?.(); };
  }, [fetchData]);

  // Auto-refresh when log watcher persists a new event
  useEffect(() => {
    const unsub = window.api.onLogWatcherEvent?.(() => {
      fetchData();
    });
    return () => { unsub?.(); };
  }, [fetchData]);

  const hasAnyData = summary && summary.sessionCount > 0;
  const hasCodeData = summary && summary.codeSessionCount > 0;
  const hasCoworkData = summary && summary.coworkSessionCount > 0;

  // Session count card
  const sessionValue = hasAnyData ? String(summary.sessionCount) : '—';
  const sessionSecondary = hasAnyData
    ? `${summary.codeSessionCount} code` + (hasCoworkData ? ` · ${summary.coworkSessionCount} cowork` : '')
    : 'no data yet';

  // Cowork turns card — partial state aware
  const turnsValue = hasCoworkData ? String(summary.coworkTurnCount) : '—';
  const turnsSecondary = hasCoworkData
    ? (summary.avgTurnDurationSeconds != null
      ? `avg ${formatDuration(summary.avgTurnDurationSeconds)}`
      : '')
    : (hasCodeData ? 'no cowork data yet' : 'no data yet');

  // Cost card
  const costValue = hasCodeData ? formatCost(summary.codeCostUsd) : '—';
  const costSecondary = hasCodeData
    ? `${summary.codeSessionCount} session${summary.codeSessionCount !== 1 ? 's' : ''}`
    : 'no data yet';

  // Active time card — partial state aware
  const activeValue = summary?.activeTimeSeconds ? formatDuration(summary.activeTimeSeconds) : '—';
  const activeSecondary = summary?.lastFocusedAt
    ? `last seen ${new Date(summary.lastFocusedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : (hasCodeData ? 'no cowork data yet' : 'no data yet');

  return (
    <div style={viewStyles}>
      <h1 style={headerStyles}>Last 24 Hours — {getTodayLabel()}</h1>

      <div style={metricsRowStyles}>
        <MetricCard value={sessionValue} label="Sessions" secondaryStat={sessionSecondary} />
        <MetricCard value={turnsValue} label="Cowork Turns" secondaryStat={turnsSecondary} />
        <MetricCard value={costValue} label="Code Cost Today" secondaryStat={costSecondary} />
        <MetricCard value={activeValue} label="Active Time" secondaryStat={activeSecondary} />
      </div>

      {weeklyActivity.some(d => d.codeCount > 0 || d.coworkCount > 0) && (
        <WeeklyActivityChart data={weeklyActivity} />
      )}

      {loading ? (
        <div style={sectionStyles}>
          <span style={{ color: '#8888aa' }}>Loading...</span>
        </div>
      ) : !hasAnyData ? (
        <div style={sectionStyles}>
          <EmptyState
            title="No sessions recorded yet"
            message="The app is scanning for Claude Code data and connecting to the log watcher. Data will appear here automatically."
          />
        </div>
      ) : (
        <SessionTimeline entries={timeline} />
      )}
    </div>
  );
}
