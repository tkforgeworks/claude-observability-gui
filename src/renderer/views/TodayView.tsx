import React, { useEffect } from 'react';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import WeeklyActivityChart from '../components/common/WeeklyActivityChart';
import SessionTimeline from '../components/common/SessionTimeline';
import { Icons } from '../components/common/Icons';
import { useApi } from '../hooks/useApi';
import { formatCost, formatDuration, formatTime } from '../utils/format';

const formatDurationHm = (s: number | null) => formatDuration(s, { style: 'hm' });

export default function TodayView(): React.JSX.Element {
  const { data, loading, error, refetch } = useApi(() =>
    Promise.all([
      window.api.coworkSessions.getSummaryToday(),
      window.api.coworkSessions.getTimeline(),
      window.api.analytics.getWeeklyActivity(),
    ])
  );
  const [summary, timeline, weeklyActivity] = data ?? [null, [], []];

  useEffect(() => {
    const unsub = window.api.onImportComplete?.((s) => {
      if (s.newRecords > 0 || s.updatedRecords > 0) {
        refetch();
      }
    });
    return () => { unsub?.(); };
  }, [refetch]);

  useEffect(() => {
    const unsub = window.api.onLogWatcherEvent?.(() => {
      refetch();
    });
    return () => { unsub?.(); };
  }, [refetch]);

  const hasAnyData = summary && summary.sessionCount > 0;
  const hasCodeData = summary && summary.codeSessionCount > 0;
  const hasCoworkData = summary && summary.coworkSessionCount > 0;

  // While the first fetch is in flight, don't claim "no data yet" — that reads
  // as a confirmed empty state before anything has loaded (CGUI-66)
  const initialLoading = loading && !data;
  const noDataMeta = initialLoading ? '' : 'no data yet';

  if (error && !data) {
    return (
      <div className="page">
        <ErrorState what="today's activity" error={error} onRetry={refetch} />
      </div>
    );
  }

  // Only name the sources that actually contributed — "0 code · 3 cowork"
  // led with a zero that read as a problem rather than an absence (CGUI-70).
  const sessionMeta = hasAnyData
    ? [
        hasCodeData ? `${summary.codeSessionCount} code` : null,
        hasCoworkData ? `${summary.coworkSessionCount} cowork` : null,
      ].filter(Boolean).join(' · ')
    : noDataMeta;

  const turnsMeta = hasCoworkData
    ? (summary.avgTurnDurationSeconds != null
      ? `avg ${formatDurationHm(summary.avgTurnDurationSeconds)}`
      : '')
    : (hasCodeData ? 'no cowork data yet' : noDataMeta);

  const costMeta = hasCodeData
    ? `${summary.codeSessionCount} session${summary.codeSessionCount !== 1 ? 's' : ''}`
    : noDataMeta;

  const activeMeta = summary?.lastFocusedAt
    ? `last seen ${formatTime(summary.lastFocusedAt)}`
    : (hasCodeData ? 'no cowork data yet' : noDataMeta);

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
          value={summary?.activeTimeSeconds ? formatDurationHm(summary.activeTimeSeconds) : '—'}
          icon={Icons.clock}
          meta={activeMeta}
        />
      </div>

      {weeklyActivity.some(d => d.codeCount > 0 || d.coworkCount > 0) && (
        <WeeklyActivityChart data={weeklyActivity} />
      )}

      {initialLoading ? (
        <Loading />
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
