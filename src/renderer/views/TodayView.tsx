import React, { useEffect } from 'react';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import WeeklyActivityChart from '../components/common/WeeklyActivityChart';
import SessionTimeline from '../components/common/SessionTimeline';
import { Icons } from '../components/common/Icons';
import { useApi } from '../hooks/useApi';
import { useCoworkAvailability } from '../hooks/useCoworkAvailability';
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

  // Historical mode counts as unavailable on a *today*-scoped surface — the
  // imported data lives in the Cowork view (CGUI-83). Unknown (null) keeps the
  // full layout so nothing flickers away while the hook resolves.
  const availability = useCoworkAvailability();
  const coworkVisible = availability === null || availability.mode === 'live';

  // With cowork hidden, nothing may count a source the UI doesn't show — a
  // same-day import could otherwise put cowork rows inside the 24h window
  const visibleSessionCount = summary
    ? (coworkVisible ? summary.sessionCount : summary.codeSessionCount)
    : 0;
  const hasAnyData = summary != null && visibleSessionCount > 0;
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
        coworkVisible && hasCoworkData ? `${summary.coworkSessionCount} cowork` : null,
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
      {/* The Cowork Turns and Active Time cards are both LogWatcher-fed, so
          without live collection they'd dash out forever — drop them and let
          the grid reflow to the two cards that can populate (CGUI-83) */}
      <div
        className="stats-grid"
        style={coworkVisible ? undefined : { gridTemplateColumns: 'repeat(auto-fit, minmax(min(158px, 100%), 1fr))' }}
      >
        <StatCard
          label="Sessions"
          value={hasAnyData ? visibleSessionCount : '—'}
          icon={Icons.layers}
          meta={sessionMeta}
        />
        {coworkVisible && (
          <StatCard
            label="Cowork Turns"
            value={hasCoworkData ? summary.coworkTurnCount : '—'}
            icon={Icons.cowork}
            meta={turnsMeta}
          />
        )}
        <StatCard
          label="Code Cost"
          value={hasCodeData ? formatCost(summary.codeCostUsd) : '—'}
          unit="USD"
          icon={Icons.dollar}
          meta={costMeta}
        />
        {coworkVisible && (
          <StatCard
            label="Active Time"
            value={summary?.activeTimeSeconds ? formatDurationHm(summary.activeTimeSeconds) : '—'}
            icon={Icons.clock}
            meta={activeMeta}
          />
        )}
      </div>

      {weeklyActivity.some(d => d.codeCount > 0 || (coworkVisible && d.coworkCount > 0)) && (
        <WeeklyActivityChart data={weeklyActivity} showCowork={coworkVisible} />
      )}

      {initialLoading ? (
        <Loading />
      ) : !hasAnyData ? (
        <EmptyState
          title="No sessions recorded yet"
          message={coworkVisible
            ? 'The app is scanning for Claude Code data and connecting to the log watcher. Data will appear here automatically.'
            : 'The app is scanning for Claude Code data. Sessions will appear here automatically.'}
        />
      ) : (
        <SessionTimeline
          entries={coworkVisible ? timeline : timeline.filter(e => e.type === 'code')}
          showCowork={coworkVisible}
        />
      )}
    </div>
  );
}
