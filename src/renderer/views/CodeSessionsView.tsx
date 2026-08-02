import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { CleanupWarning, ImportSummary } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import StatCard from '../components/common/StatCard';
import SortableTh from '../components/common/SortableTh';
import StatusBanner from '../components/common/StatusBanner';
import HBar from '../components/charts/HBar';
import Donut from '../components/charts/Donut';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';
import { useApi } from '../hooks/useApi';
import {
  formatCost,
  formatElapsed,
  formatDateTime,
  formatProjectName,
  formatTokens,
  ALL_RANGE_DAYS,
  rangeDays,
  shortenModel,
} from '../utils/format';

type SortKey = 'project_path' | 'model' | 'input_tokens' | 'output_tokens' | 'cache_creation_tokens' | 'cache_read_tokens' | 'cost_usd' | 'started_at';
type SortDir = 'asc' | 'desc';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type ScanStatus = 'idle' | 'scanning' | 'complete';

export default function CodeSessionsView(): React.JSX.Element {
  const [rangeLabel, setRangeLabel] = useState('30d');
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [lastScanSummary, setLastScanSummary] = useState<ImportSummary | null>(null);
  const [scanFading, setScanFading] = useState(false);
  const [cleanupWarning, setCleanupWarning] = useState<CleanupWarning | null>(null);

  const { setRangeControls, clearRangeControls } = useTopbar();
  const days = rangeDays(rangeLabel);

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
  } = useApi(() => {
    const from = daysAgo(days);
    const to = new Date().toISOString();
    return window.api.codeSessions.getByDateRange({ from, to });
  }, [days]);
  const sessions = fetched ?? [];

  useEffect(() => {
    window.api.codeSessions.getCleanupWarning?.()
      ?.then(setCleanupWarning)
      ?.catch((err: unknown) => console.error('[CodeSessionsView] cleanup warning check failed:', err));
  }, []);

  // Fade timers are tracked so they can be cancelled. Previously they were
  // fire-and-forget: they leaked past unmount, and a timer from an earlier
  // scan would hide the status of a scan that had just started (CGUI-70).
  const fadeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearFadeTimers = useCallback(() => {
    fadeTimers.current.forEach(clearTimeout);
    fadeTimers.current = [];
  }, []);

  useEffect(() => clearFadeTimers, [clearFadeTimers]);

  useEffect(() => {
    const unsubStarted = window.api.onScanStarted?.(() => {
      clearFadeTimers();
      setScanStatus('scanning');
      setScanFading(false);
    });
    const unsubComplete = window.api.onImportComplete?.((summary) => {
      clearFadeTimers();
      setScanStatus('complete');
      setLastScanSummary(summary);
      setScanFading(false);
      if (summary.newRecords > 0 || summary.updatedRecords > 0) refetch();
      fadeTimers.current.push(setTimeout(() => {
        setScanFading(true);
        fadeTimers.current.push(setTimeout(() => setScanStatus('idle'), 500));
      }, 5000));
    });
    return () => { unsubStarted?.(); unsubComplete?.(); };
  }, [refetch, clearFadeTimers]);

  const sorted = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      // localeCompare for text: a plain < comparison sorts by code point, so
      // every uppercase path sorted ahead of every lowercase one (CGUI-70).
      const cmp = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, undefined, { sensitivity: 'base', numeric: true })
        : av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [sessions, sortKey, sortDir]);

  const totals = useMemo(() => {
    let input = 0, output = 0, cache = 0, cost = 0;
    for (const s of sessions) {
      input += s.input_tokens ?? 0;
      output += s.output_tokens ?? 0;
      cache += (s.cache_creation_tokens ?? 0) + (s.cache_read_tokens ?? 0);
      cost += s.cost_usd ?? 0;
    }
    return { input, output, cache, cost, count: sessions.length };
  }, [sessions]);

  const costByProject = useMemo(() => {
    const map = new Map<string, { cost: number; count: number }>();
    for (const s of sessions) {
      const key = formatProjectName(s.project_path);
      const entry = map.get(key) ?? { cost: 0, count: 0 };
      entry.cost += s.cost_usd ?? 0;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([label, { cost }]) => ({ label, value: cost, formattedValue: formatCost(cost) }))
      .sort((a, b) => b.value - a.value);
  }, [sessions]);

  const modelDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      const key = shortenModel(s.model ?? 'unknown');
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, formattedValue: `${value}` }))
      .sort((a, b) => b.value - a.value);
  }, [sessions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Only fired when the selected range came back empty: an empty range and an
  // empty database look identical otherwise, and the old copy told people to
  // wait for an import they had already run (CGUI-70).
  const [totalOutsideRange, setTotalOutsideRange] = useState<number | null>(null);
  useEffect(() => {
    if (loading || sessions.length > 0) { setTotalOutsideRange(null); return; }
    let cancelled = false;
    window.api.codeSessions
      .getByDateRange({ from: daysAgo(ALL_RANGE_DAYS), to: new Date().toISOString() })
      .then(all => { if (!cancelled) setTotalOutsideRange(all.length); })
      .catch(() => { if (!cancelled) setTotalOutsideRange(null); });
    return () => { cancelled = true; };
  }, [loading, sessions.length]);

  if (loading && !fetched) {
    return (
      <div className="page">
        <Loading label="sessions" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState what="Code sessions" error={error} onRetry={refetch} />
      </div>
    );
  }

  const isEmpty = sessions.length === 0;
  const hasDataOutsideRange = (totalOutsideRange ?? 0) > 0;

  return (
    <div className="page">
      {cleanupWarning?.warningNeeded && (
        <StatusBanner
          variant="warning"
          message={`Claude Code cleanupPeriodDays is set to ${cleanupWarning.cleanupPeriodDays} days. JSONL files older than this are automatically deleted, limiting historical data.`}
        />
      )}

      {scanStatus !== 'idle' && (
        <div style={{
          fontSize: 12,
          fontFamily: '"JetBrains Mono", monospace',
          color: scanStatus === 'complete' ? 'var(--success)' : 'var(--text-secondary)',
          opacity: scanFading ? 0 : 1,
          transition: 'opacity 0.5s ease',
        }}>
          {scanStatus === 'scanning' ? '⟳ Scanning JSONL files...' :
            lastScanSummary ? `Scan complete: ${lastScanSummary.newRecords} new, ${lastScanSummary.updatedRecords} updated (${formatElapsed(lastScanSummary.scanDurationMs)})` : null}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Sessions" value={totals.count} icon={Icons.code} variant="minimal" />
        <StatCard label="Total Cost" value={formatCost(totals.cost)} unit="USD" icon={Icons.dollar} variant="minimal" />
        <StatCard label="I/O Tokens" value={formatTokens(totals.input + totals.output)} icon={Icons.layers} variant="minimal" />
        <StatCard label="Cache Tokens" value={formatTokens(totals.cache)} icon={Icons.bolt} variant="minimal" />
      </div>

      {isEmpty ? (
        <EmptyState
          title={hasDataOutsideRange
            ? `No Code sessions in this range`
            : 'No Code sessions yet'}
          message={hasDataOutsideRange
            ? `You have ${totalOutsideRange} session${totalOutsideRange === 1 ? '' : 's'} outside the selected range. Pick a wider range to see them.`
            : 'Claude Code session data will appear here once the JSONL importer has scanned ~/.claude/projects/.'}
        />
      ) : (
      <>
      <div className="chart-row">
        <div className="chart-row-grid">
          <div className="card">
            <div className="card-head"><h2>Cost by Project</h2></div>
            <HBar items={costByProject} />
          </div>
          <div className="card">
            <div className="card-head"><h2>Model Distribution</h2></div>
            <Donut slices={modelDist} centerLabel="sessions" centerValue={String(totals.count)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div className="summary-row" style={{ padding: '10px 22px', borderBottom: '1px solid var(--border-soft)' }}>
          <span><strong>{totals.count}</strong> sessions</span>
          <span className="sep">·</span>
          <span>Input: <strong>{formatTokens(totals.input)}</strong></span>
          <span className="sep">·</span>
          <span>Output: <strong>{formatTokens(totals.output)}</strong></span>
          <span className="sep">·</span>
          <span>Cache: <strong>{formatTokens(totals.cache)}</strong></span>
          <span className="sep">·</span>
          <span>Cost: <strong>{formatCost(totals.cost)}</strong></span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <SortableTh label="Project" active={sortKey === 'project_path'} dir={sortDir} onSort={() => handleSort('project_path')} />
                <SortableTh label="Model" active={sortKey === 'model'} dir={sortDir} onSort={() => handleSort('model')} />
                <SortableTh label="Input" className="num" active={sortKey === 'input_tokens'} dir={sortDir} onSort={() => handleSort('input_tokens')} />
                <SortableTh label="Output" className="num" active={sortKey === 'output_tokens'} dir={sortDir} onSort={() => handleSort('output_tokens')} />
                <SortableTh label="Cache W" className="num" active={sortKey === 'cache_creation_tokens'} dir={sortDir} onSort={() => handleSort('cache_creation_tokens')} />
                <SortableTh label="Cache R" className="num" active={sortKey === 'cache_read_tokens'} dir={sortDir} onSort={() => handleSort('cache_read_tokens')} />
                <SortableTh label="Cost" className="num" active={sortKey === 'cost_usd'} dir={sortDir} onSort={() => handleSort('cost_usd')} />
                <SortableTh label="Date" active={sortKey === 'started_at'} dir={sortDir} onSort={() => handleSort('started_at')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const name = formatProjectName(s.project_path);
                const leaf = name.includes('/') ? name.split('/').pop() : null;
                return (
                  <tr key={s.id}>
                    <td title={s.project_path ?? undefined}>
                      <span className="path">
                        {leaf ? (
                          <>{name.slice(0, name.lastIndexOf('/') + 1)}<span className="leaf">{leaf}</span></>
                        ) : name}
                      </span>
                      {s.slug && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.slug}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }} title={s.model ?? undefined}>{shortenModel(s.model)}</td>
                    <td className="num">{formatTokens(s.input_tokens)}</td>
                    <td className="num">{formatTokens(s.output_tokens)}</td>
                    <td className="num">{formatTokens(s.cache_creation_tokens)}</td>
                    <td className="num">{formatTokens(s.cache_read_tokens)}</td>
                    <td className="num">{formatCost(s.cost_usd)}</td>
                    <td>{formatDateTime(s.started_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
