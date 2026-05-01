import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { HeatmapDay } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';
import HeatmapChart from '../components/charts/HeatmapChart';
import { useTopbar } from '../contexts/TopbarContext';

const RANGE_MAP: Record<string, number> = {
  '12 months': 365,
  '6 months': 182,
  '3 months': 91,
};

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function HeatmapView(): React.JSX.Element {
  const [data, setData] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = useCallback(() => {
    return window.api.analytics.getHeatmapData(rangeDays)
      .then(setData)
      .catch(err => {
        console.error('[HeatmapView] fetch failed:', err);
        setData([]);
      });
  }, [rangeDays]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const totals = useMemo(() => {
    let activeDays = 0, coworkSessions = 0, codeSessions = 0;
    let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
    for (const d of data) {
      if (d.coworkCount + d.codeCount > 0) activeDays++;
      coworkSessions += d.coworkCount;
      codeSessions += d.codeCount;
      inputTokens += d.inputTokens;
      outputTokens += d.outputTokens;
      cacheReadTokens += d.cacheReadTokens;
      cacheCreationTokens += d.cacheCreationTokens;
    }
    return { activeDays, coworkSessions, codeSessions, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens };
  }, [data]);

  const coworkData = useMemo(() => data.map(d => ({ date: d.date, value: d.coworkCount })), [data]);
  const ioData = useMemo(() => data.map(d => ({ date: d.date, value: d.inputTokens + d.outputTokens })), [data]);
  const cacheData = useMemo(() => data.map(d => ({ date: d.date, value: d.cacheReadTokens + d.cacheCreationTokens })), [data]);

  const hasAnyData = totals.coworkSessions + totals.codeSessions > 0;

  if (loading) {
    return (
      <div className="page">
        <div style={{ color: 'var(--text-tertiary)', padding: 40, textAlign: 'center' }}>Loading heatmap data...</div>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="page">
        <EmptyState
          title="No activity data yet"
          message="The heatmap will show your Claude usage intensity over time once session data has been collected across Cowork and Code sources."
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
          <span className="sep">·</span>
          <span>Cowork: <strong>{totals.coworkSessions}</strong> sessions</span>
          <span className="sep">·</span>
          <span>Code: <strong>{totals.codeSessions}</strong> sessions</span>
          <span className="sep">·</span>
          <span>I/O: <strong>{formatTokenCount(totals.inputTokens + totals.outputTokens)}</strong></span>
          <span className="sep">·</span>
          <span>Cache: <strong>{formatTokenCount(totals.cacheReadTokens + totals.cacheCreationTokens)}</strong></span>
        </div>
      </div>

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

      <div className="card">
        <div className="card-head">
          <h2>Code: Input + Output Tokens</h2>
          <span className="sub">{ioActive} active days · {formatTokenCount(totals.inputTokens + totals.outputTokens)} total</span>
        </div>
        <HeatmapChart
          data={ioData}
          days={rangeDays}
          colorScale="teal"
          formatValue={(v) => v > 0 ? formatTokenCount(v) + ' tokens' : 'No token usage'}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Code: Cache Read + Write Tokens</h2>
          <span className="sub">{cacheActive} active days · {formatTokenCount(totals.cacheReadTokens + totals.cacheCreationTokens)} total</span>
        </div>
        <HeatmapChart
          data={cacheData}
          days={rangeDays}
          colorScale="purple"
          formatValue={(v) => v > 0 ? formatTokenCount(v) + ' tokens' : 'No cache usage'}
        />
      </div>
    </div>
  );
}
