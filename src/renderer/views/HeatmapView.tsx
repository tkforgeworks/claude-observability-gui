import React, { useEffect, useMemo, useCallback, useState } from 'react';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import HeatmapChart from '../components/charts/HeatmapChart';
import { useTopbar } from '../contexts/TopbarContext';
import { useApi } from '../hooks/useApi';
import { useCoworkAvailability } from '../hooks/useCoworkAvailability';
import { formatTokens } from '../utils/format';

const RANGE_MAP: Record<string, number> = {
  '3 months': 91,
  '6 months': 182,
  '12 months': 365,
};

export default function HeatmapView(): React.JSX.Element {
  const [rangeLabel, setRangeLabel] = useState('12 months');
  const { setRangeControls, clearRangeControls } = useTopbar();

  const rangeDays = RANGE_MAP[rangeLabel] ?? 365;

  const handleRangeChange = useCallback((label: string) => {
    setRangeLabel(label);
  }, []);

  useEffect(() => {
    setRangeControls(rangeLabel, handleRangeChange);
    return clearRangeControls;
  }, [rangeLabel, handleRangeChange, setRangeControls, clearRangeControls]);

  const {
    data: fetched,
    loading,
    error,
    refetch,
  } = useApi(() => window.api.analytics.getHeatmapData(rangeDays), [rangeDays]);
  const data = fetched ?? [];

  // Cowork section renders unless availability says 'none' (CGUI-85). While
  // the answer is unknown (null) keep current behavior — Windows unchanged.
  // 'historical' keeps the section: the 365-day window can cover imported
  // activity.
  const availability = useCoworkAvailability();
  const showCowork = availability === null || availability.available;

  // The heatmap draws from both sources, so it has to follow both feeds —
  // previously it went stale until the view was remounted (CGUI-70).
  useEffect(() => {
    const unsubImport = window.api.onImportComplete?.((summary) => {
      if (summary.newRecords > 0 || summary.updatedRecords > 0) refetch();
    });
    const unsubEvent = window.api.onLogWatcherEvent?.(() => { refetch(); });
    return () => { unsubImport?.(); unsubEvent?.(); };
  }, [refetch]);

  // A hidden source must not count toward the totals the UI shows — with the
  // Cowork section gone, "active days" means days with code activity only.
  const totals = useMemo(() => {
    let activeDays = 0, coworkSessions = 0, codeSessions = 0;
    let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
    for (const d of data) {
      const visibleCount = d.codeCount + (showCowork ? d.coworkCount : 0);
      if (visibleCount > 0) activeDays++;
      coworkSessions += d.coworkCount;
      codeSessions += d.codeCount;
      inputTokens += d.inputTokens;
      outputTokens += d.outputTokens;
      cacheReadTokens += d.cacheReadTokens;
      cacheCreationTokens += d.cacheCreationTokens;
    }
    return { activeDays, coworkSessions, codeSessions, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens };
  }, [data, showCowork]);

  const coworkData = useMemo(() => data.map(d => ({ date: d.date, value: d.coworkCount })), [data]);
  const ioData = useMemo(() => data.map(d => ({ date: d.date, value: d.inputTokens + d.outputTokens })), [data]);
  const cacheData = useMemo(() => data.map(d => ({ date: d.date, value: d.cacheReadTokens + d.cacheCreationTokens })), [data]);

  const hasAnyData = (showCowork ? totals.coworkSessions : 0) + totals.codeSessions > 0;

  if (loading && !fetched) {
    return (
      <div className="page">
        <Loading label="heatmap data" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState what="heatmap data" error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="page">
        <EmptyState
          title="No activity data yet"
          message={showCowork
            ? 'The heatmap will show your Claude usage intensity over time once session data has been collected across Cowork and Code sources.'
            : 'The heatmap will show your Claude usage intensity over time once Code session data has been collected.'}
        />
      </div>
    );
  }

  const coworkActive = coworkData.filter(d => d.value > 0).length;
  const ioActive = ioData.filter(d => d.value > 0).length;
  const cacheActive = cacheData.filter(d => d.value > 0).length;

  return (
    <div className="page">
      <div className="card">
        <div className="summary-row">
          <span><strong>{totals.activeDays}</strong> active days</span>
          {showCowork && (
            <>
              <span className="sep">·</span>
              <span>Cowork: <strong>{totals.coworkSessions}</strong> sessions</span>
            </>
          )}
          <span className="sep">·</span>
          <span>Code: <strong>{totals.codeSessions}</strong> sessions</span>
          <span className="sep">·</span>
          <span>I/O: <strong>{formatTokens(totals.inputTokens + totals.outputTokens)}</strong></span>
          <span className="sep">·</span>
          <span>Cache: <strong>{formatTokens(totals.cacheReadTokens + totals.cacheCreationTokens)}</strong></span>
        </div>
      </div>

      {showCowork && (
        <div className="card">
          <div className="card-head">
            <h2>Cowork Sessions</h2>
            <span className="sub">{coworkActive} active days</span>
          </div>
          <HeatmapChart
            data={coworkData}
            days={rangeDays}
            colorScale="sky"
            formatValue={(v) => v > 0 ? `${v} session${v !== 1 ? 's' : ''}` : 'No sessions'}
          />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Code: Input + Output Tokens</h2>
          <span className="sub">{ioActive} active days · {formatTokens(totals.inputTokens + totals.outputTokens)} total</span>
        </div>
        <HeatmapChart
          data={ioData}
          days={rangeDays}
          colorScale="teal"
          formatValue={(v) => v > 0 ? formatTokens(v) + ' tokens' : 'No token usage'}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Code: Cache Read + Write Tokens</h2>
          <span className="sub">{cacheActive} active days · {formatTokens(totals.cacheReadTokens + totals.cacheCreationTokens)} total</span>
        </div>
        <HeatmapChart
          data={cacheData}
          days={rangeDays}
          colorScale="purple"
          formatValue={(v) => v > 0 ? formatTokens(v) + ' tokens' : 'No cache usage'}
        />
      </div>
    </div>
  );
}
