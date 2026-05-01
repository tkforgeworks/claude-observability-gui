import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { CoworkSession, CoworkTurn } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';

type SortKey = 'title' | 'started_at' | 'turn_count' | 'duration' | 'avg_turn';
type SortDir = 'asc' | 'desc';

const RANGE_MAP: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, 'All': 3650 };

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatTurnTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function sessionDuration(s: CoworkSession): number | null {
  if (!s.ended_at) return null;
  return Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000);
}

function sessionAvgTurn(s: CoworkSession): number | null {
  return s.avg_turn_seconds != null ? Math.round(s.avg_turn_seconds) : null;
}

function formatProjectName(p: string | null): string {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length <= 2 ? parts.join('/') : parts.slice(-2).join('/');
}

function sessionTitle(s: CoworkSession): string {
  if (s.project_path) return formatProjectName(s.project_path);
  if (s.title) return s.title;
  const d = new Date(s.started_at);
  return `Session at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function TurnHistogram({ turns }: { turns: CoworkTurn[] }): React.JSX.Element | null {
  const durations = turns
    .map(t => t.duration_seconds)
    .filter((d): d is number => d != null && d > 0);
  if (durations.length === 0) return null;
  const maxDur = Math.max(...durations);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: '"Poppins"', fontWeight: 600 }}>
        Turn Duration Distribution
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
        {durations.map((dur, i) => {
          const heightPct = Math.max(8, (dur / maxDur) * 100);
          return (
            <div
              key={i}
              title={`Turn ${i + 1}: ${formatDuration(dur)}`}
              style={{
                width: Math.max(6, Math.min(20, 200 / durations.length)),
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
  );
}

export default function CoworkSessionsView(): React.JSX.Element {
  const [sessions, setSessions] = useState<CoworkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeLabel, setRangeLabel] = useState('30d');
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTurns, setExpandedTurns] = useState<CoworkTurn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);

  const { setRangeControls, clearRangeControls } = useTopbar();
  const rangeDays = RANGE_MAP[rangeLabel] ?? 30;

  const handleRangeChange = useCallback((label: string) => {
    setRangeLabel(label);
  }, []);

  useEffect(() => {
    setRangeControls(rangeLabel, handleRangeChange);
    return clearRangeControls;
  }, [rangeLabel, handleRangeChange, setRangeControls, clearRangeControls]);

  const fetchSessions = useCallback(() => {
    const from = daysAgo(rangeDays);
    const to = new Date().toISOString();
    return window.api.coworkSessions.getAll({ from, to })
      .then(setSessions)
      .catch(err => {
        console.error('[CoworkSessionsView] fetch failed:', err);
        setSessions([]);
      });
  }, [rangeDays]);

  useEffect(() => {
    setLoading(true);
    fetchSessions().finally(() => setLoading(false));
  }, [fetchSessions]);

  useEffect(() => {
    const unsub = window.api.onLogWatcherEvent?.(() => { fetchSessions(); });
    return () => { unsub?.(); };
  }, [fetchSessions]);

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

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const handleExpand = (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setExpandedTurns([]);
      return;
    }
    setExpandedId(sessionId);
    setTurnsLoading(true);
    window.api.coworkSessions.getTurns(sessionId)
      .then(setExpandedTurns)
      .catch(err => {
        console.error('[CoworkSessionsView] fetch turns failed:', err);
        setExpandedTurns([]);
      })
      .finally(() => setTurnsLoading(false));
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ color: 'var(--text-tertiary)', padding: 40, textAlign: 'center' }}>Loading sessions...</div>
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
                <th style={{ width: 28 }} />
                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>Title{sortIndicator('title')}</th>
                <th onClick={() => handleSort('started_at')} style={{ cursor: 'pointer' }}>Date{sortIndicator('started_at')}</th>
                <th className="num" onClick={() => handleSort('turn_count')} style={{ cursor: 'pointer' }}>Turns{sortIndicator('turn_count')}</th>
                <th className="num" onClick={() => handleSort('duration')} style={{ cursor: 'pointer' }}>Duration{sortIndicator('duration')}</th>
                <th className="num" onClick={() => handleSort('avg_turn')} style={{ cursor: 'pointer' }}>Avg Turn{sortIndicator('avg_turn')}</th>
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
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 11, textAlign: 'center' }}>
                        {isExpanded ? '▾' : '▸'}
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
                      <td>{formatDate(s.started_at)}</td>
                      <td className="num">{s.turn_count}</td>
                      <td className="num">{formatDuration(dur)}</td>
                      <td className="num">{formatDuration(avg)}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ backgroundColor: 'var(--background-light)', padding: '12px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                          {turnsLoading ? (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loading turns...</span>
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
