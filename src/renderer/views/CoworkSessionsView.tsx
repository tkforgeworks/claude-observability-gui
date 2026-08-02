import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { CoworkSession, CoworkTurn } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import StatCard from '../components/common/StatCard';
import SortableTh from '../components/common/SortableTh';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';
import { useApi } from '../hooks/useApi';
import {
  formatDateTime,
  formatDuration,
  formatProjectName,
  rangeDays,
} from '../utils/format';

type SortKey = 'title' | 'started_at' | 'turn_count' | 'duration' | 'avg_turn';
type SortDir = 'asc' | 'desc';

function formatTurnTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function sessionDuration(s: CoworkSession): number | null {
  if (!s.ended_at) return null;
  return Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000);
}

function sessionAvgTurn(s: CoworkSession): number | null {
  return s.avg_turn_seconds != null ? Math.round(s.avg_turn_seconds) : null;
}

function sessionTitle(s: CoworkSession): string {
  if (s.project_path) return formatProjectName(s.project_path);
  if (s.title) return s.title;
  const d = new Date(s.started_at);
  return `Session at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// The histogram lives in a full-span <td>, which sizes to its content — so a
// long session used to widen the whole table rather than overflow its cell.
// Bars are sized against a fixed width budget instead, and the wrapper is
// capped to it, so past the 2px floor the histogram scrolls on its own and
// the table's column layout never shifts (CGUI-69).
const HISTOGRAM_MAX_WIDTH = 560;
const HISTOGRAM_BAR_GAP = 2;

function TurnHistogram({ turns }: { turns: CoworkTurn[] }): React.JSX.Element | null {
  const durations = turns
    .map(t => t.duration_seconds)
    .filter((d): d is number => d != null && d > 0);
  if (durations.length === 0) return null;
  const maxDur = Math.max(...durations);

  const gapTotal = (durations.length - 1) * HISTOGRAM_BAR_GAP;
  const barWidth = Math.max(2, Math.min(20, Math.floor((HISTOGRAM_MAX_WIDTH - gapTotal) / durations.length)));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: '"Poppins"', fontWeight: 600 }}>
        Turn Duration Distribution
      </div>
      {/* Overflow lives on the wrapper, not the 40px bar row, so the
          scrollbar doesn't eat bar height. */}
      <div style={{ maxWidth: HISTOGRAM_MAX_WIDTH, overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: HISTOGRAM_BAR_GAP, height: 40 }}>
          {durations.map((dur, i) => {
            const heightPct = Math.max(8, (dur / maxDur) * 100);
            return (
              <div
                key={i}
                title={`Turn ${i + 1}: ${formatDuration(dur)}`}
                style={{
                  width: barWidth,
                  flexShrink: 0,
                  height: `${heightPct}%`,
                  backgroundColor: 'var(--chart-5)',
                  borderRadius: '2px 2px 0 0',
                  opacity: 0.8,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CoworkSessionsView(): React.JSX.Element {
  const [rangeLabel, setRangeLabel] = useState('30d');
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTurns, setExpandedTurns] = useState<CoworkTurn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [turnsError, setTurnsError] = useState<Error | null>(null);

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
    return window.api.coworkSessions.getAll({ from, to });
  }, [days]);
  const sessions = fetched ?? [];

  const loadTurns = useCallback((sessionId: string) => {
    setTurnsLoading(true);
    setTurnsError(null);
    window.api.coworkSessions.getTurns(sessionId)
      .then(setExpandedTurns)
      .catch((err: unknown) => {
        setExpandedTurns([]);
        setTurnsError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setTurnsLoading(false));
  }, []);

  // A live event refreshes the session list; the expanded row's turns have to
  // come along or the open detail keeps showing pre-event data while the row
  // above it updates (CGUI-70).
  useEffect(() => {
    const unsub = window.api.onLogWatcherEvent?.(() => {
      refetch();
      if (expandedId) loadTurns(expandedId);
    });
    return () => { unsub?.(); };
  }, [refetch, expandedId, loadTurns]);

  const getSortValue = useCallback((s: CoworkSession, key: SortKey): string | number | null => {
    switch (key) {
      case 'title': return sessionTitle(s).toLowerCase();
      case 'started_at': return s.started_at;
      case 'turn_count': return s.turn_count;
      case 'duration': return sessionDuration(s);
      case 'avg_turn': return sessionAvgTurn(s);
    }
  }, []);

  const sorted = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [sessions, sortKey, sortDir, getSortValue]);

  const totals = useMemo(() => {
    let turns = 0, totalDuration = 0, sessionsWithDuration = 0;
    for (const s of sessions) {
      turns += s.turn_count;
      const dur = sessionDuration(s);
      if (dur != null) { totalDuration += dur; sessionsWithDuration++; }
    }
    return {
      count: sessions.length,
      turns,
      totalDuration,
      avgDuration: sessionsWithDuration > 0 ? Math.round(totalDuration / sessionsWithDuration) : null,
    };
  }, [sessions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleExpand = (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setExpandedTurns([]);
      return;
    }
    setExpandedId(sessionId);
    loadTurns(sessionId);
  };

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
        <ErrorState what="Cowork sessions" error={error} onRetry={refetch} />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="No Cowork sessions yet"
          message="Cowork session data is collected from the Claude Desktop log file. Ensure Claude Desktop is running and the log watcher is connected."
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <StatCard label="Sessions" value={totals.count} icon={Icons.layers} variant="minimal" />
        <StatCard label="Total Turns" value={totals.turns} icon={Icons.hash} variant="minimal" />
        <StatCard label="Total Time" value={formatDuration(totals.totalDuration)} icon={Icons.clock} variant="minimal" />
        <StatCard label="Avg Session" value={formatDuration(totals.avgDuration)} icon={Icons.bolt} variant="minimal" />
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 28 }}><span className="visually-hidden">Expand</span></th>
                <SortableTh label="Title" active={sortKey === 'title'} dir={sortDir} onSort={() => handleSort('title')} />
                <SortableTh label="Date" active={sortKey === 'started_at'} dir={sortDir} onSort={() => handleSort('started_at')} />
                <SortableTh label="Turns" className="num" active={sortKey === 'turn_count'} dir={sortDir} onSort={() => handleSort('turn_count')} />
                <SortableTh label="Duration" className="num" active={sortKey === 'duration'} dir={sortDir} onSort={() => handleSort('duration')} />
                <SortableTh label="Avg Turn" className="num" active={sortKey === 'avg_turn'} dir={sortDir} onSort={() => handleSort('avg_turn')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const isExpanded = expandedId === s.session_id;
                const dur = sessionDuration(s);
                const avg = sessionAvgTurn(s);
                const title = sessionTitle(s);
                const leaf = title.includes('/') ? title.split('/').pop() : null;
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      className={isExpanded ? 'active' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleExpand(s.session_id)}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExpand(s.session_id);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: 11 }}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      </td>
                      <td>
                        <span className="path">
                          {leaf ? (
                            <>
                              {title.slice(0, title.lastIndexOf('/') + 1)}
                              <span className="leaf">{leaf}</span>
                            </>
                          ) : title}
                        </span>
                        {s.cli_session_id && (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                            {s.cli_session_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td>{formatDateTime(s.started_at)}</td>
                      <td className="num">{s.turn_count}</td>
                      <td className="num">{formatDuration(dur)}</td>
                      <td className="num">{formatDuration(avg)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="detail-row">
                        <td colSpan={6} style={{ backgroundColor: 'var(--background-light)', padding: '12px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                          {turnsLoading ? (
                            <span role="status" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Loading turns...</span>
                          ) : turnsError ? (
                            <span role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>
                              Couldn&apos;t load turns: {turnsError.message}
                            </span>
                          ) : expandedTurns.length === 0 ? (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No completed turns recorded</span>
                          ) : (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: '"Poppins"', fontWeight: 600 }}>
                                Turns ({expandedTurns.length})
                              </div>
                              {expandedTurns.map((t, i) => (
                                <div key={t.id} style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', fontFamily: '"JetBrains Mono", monospace' }}>
                                  <span style={{ color: 'var(--text-tertiary)', width: 24 }}>#{i + 1}</span>
                                  <span>{formatTurnTime(t.started_at)} → {t.ended_at ? formatTurnTime(t.ended_at) : '...'}</span>
                                  <span style={{ color: t.duration_seconds ? 'var(--chart-5)' : 'var(--text-tertiary)' }}>
                                    {formatDuration(t.duration_seconds)}
                                  </span>
                                </div>
                              ))}
                              <TurnHistogram turns={expandedTurns} />
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
