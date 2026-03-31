/**
 * Cowork sessions view — sortable table with expandable rows showing
 * individual turn durations and a per-session turn duration histogram.
 * @see §3 "Cowork Sessions List" in 04-wireframes.md
 * @see CGUI-21
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { CoworkSession, CoworkTurn } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  height: '100%',
  overflow: 'hidden',
};

const headerRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const headerStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ccccdd',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const rangeButtonStyles = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  backgroundColor: active ? '#3a3a6a' : '#1a1a2e',
  border: `1px solid ${active ? '#5a5a8a' : '#2a2a4a'}`,
  borderRadius: 4,
  color: active ? '#ccccdd' : '#888899',
  fontSize: 13,
  cursor: 'pointer',
});

const summaryBarStyles: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  padding: '10px 16px',
  backgroundColor: '#1a1a2e',
  borderRadius: 6,
  border: '1px solid #2a2a4a',
  fontSize: 13,
  color: '#8888aa',
};

const summaryValueStyles: React.CSSProperties = {
  color: '#ccccdd',
  fontWeight: 600,
  fontFamily: 'monospace',
};

const tableContainerStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  borderRadius: 6,
  border: '1px solid #2a2a4a',
};

const tableStyles: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyles = (sortable: boolean): React.CSSProperties => ({
  position: 'sticky',
  top: 0,
  padding: '10px 12px',
  backgroundColor: '#1a1a2e',
  borderBottom: '2px solid #2a2a4a',
  textAlign: 'left',
  fontWeight: 600,
  color: '#8888aa',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  cursor: sortable ? 'pointer' : 'default',
  userSelect: 'none',
  whiteSpace: 'nowrap',
});

const tdStyles: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #1a1a2e',
  color: '#ccccdd',
  whiteSpace: 'nowrap',
};

const numericTdStyles: React.CSSProperties = {
  ...tdStyles,
  textAlign: 'right',
  fontFamily: 'monospace',
};

const emptyContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const expandedRowStyles: React.CSSProperties = {
  backgroundColor: '#12122a',
};

const expandedCellStyles: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #2a2a4a',
};

const turnRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  fontSize: 12,
  color: '#8888aa',
  padding: '3px 0',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = 'title' | 'started_at' | 'turn_count' | 'duration' | 'avg_turn';
type SortDir = 'asc' | 'desc';

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
  // Fallback: format as time-based label
  const d = new Date(s.started_at);
  return `Session at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Turn histogram — small inline bar chart of turn durations
// ---------------------------------------------------------------------------

function TurnHistogram({ turns }: { turns: CoworkTurn[] }): React.JSX.Element | null {
  const durations = turns
    .map(t => t.duration_seconds)
    .filter((d): d is number => d != null && d > 0);

  if (durations.length === 0) return null;

  const maxDur = Math.max(...durations);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: '#6666aa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                backgroundColor: '#6666cc',
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

// ---------------------------------------------------------------------------
// Range options
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 3650 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoworkSessionsView(): React.JSX.Element {
  const [sessions, setSessions] = useState<CoworkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTurns, setExpandedTurns] = useState<CoworkTurn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);

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

  // Auto-refresh on log watcher events
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
    let turns = 0;
    let totalDuration = 0;
    let sessionsWithDuration = 0;
    for (const s of sessions) {
      turns += s.turn_count;
      const dur = sessionDuration(s);
      if (dur != null) {
        totalDuration += dur;
        sessionsWithDuration++;
      }
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
      <div style={viewStyles}>
        <div style={headerRowStyles}>
          <h1 style={headerStyles}>Cowork Sessions</h1>
        </div>
        <div style={emptyContainerStyles}>
          <span style={{ color: '#8888aa' }}>Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={viewStyles}>
        <div style={headerRowStyles}>
          <h1 style={headerStyles}>Cowork Sessions</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {RANGE_OPTIONS.map(r => (
              <button key={r.days} style={rangeButtonStyles(rangeDays === r.days)} onClick={() => setRangeDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div style={emptyContainerStyles}>
          <EmptyState
            title="No Cowork sessions yet"
            message="Cowork session data is collected from the Claude Desktop log file. Ensure Claude Desktop is running and the log watcher is connected. Check Settings > General."
          />
        </div>
      </div>
    );
  }

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Cowork Sessions</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTIONS.map(r => (
            <button key={r.days} style={rangeButtonStyles(rangeDays === r.days)} onClick={() => setRangeDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={summaryBarStyles}>
        <span><span style={summaryValueStyles}>{totals.count}</span> sessions</span>
        <span>Total turns: <span style={summaryValueStyles}>{totals.turns}</span></span>
        <span>Total time: <span style={summaryValueStyles}>{formatDuration(totals.totalDuration)}</span></span>
        <span>Avg session: <span style={summaryValueStyles}>{formatDuration(totals.avgDuration)}</span></span>
      </div>

      <div style={tableContainerStyles}>
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thStyles(false), width: 28 }} />
              <th style={thStyles(true)} onClick={() => handleSort('title')}>Title{sortIndicator('title')}</th>
              <th style={thStyles(true)} onClick={() => handleSort('started_at')}>Date{sortIndicator('started_at')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('turn_count')}>Turns{sortIndicator('turn_count')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('duration')}>Duration{sortIndicator('duration')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('avg_turn')}>Avg Turn{sortIndicator('avg_turn')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => {
              const isExpanded = expandedId === s.session_id;
              const dur = sessionDuration(s);
              const avg = sessionAvgTurn(s);
              return (
                <React.Fragment key={s.id}>
                  <tr
                    style={{ backgroundColor: isExpanded ? '#1a1a3e' : 'transparent', cursor: 'pointer' }}
                    onClick={() => handleExpand(s.session_id)}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#1a1a3e'; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ ...tdStyles, color: '#6666aa', fontSize: 11, textAlign: 'center' }}>
                      {isExpanded ? '▾' : '▸'}
                    </td>
                    <td style={tdStyles}>
                      <span style={{ color: '#ccccdd' }}>{sessionTitle(s)}</span>
                      {s.cli_session_id && (
                        <span style={{ fontSize: 11, color: '#5555aa', marginLeft: 8 }}>
                          CLI: {s.cli_session_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyles, fontSize: 12, color: '#8888aa' }}>{formatDate(s.started_at)}</td>
                    <td style={numericTdStyles}>{s.turn_count}</td>
                    <td style={numericTdStyles}>{formatDuration(dur)}</td>
                    <td style={numericTdStyles}>{formatDuration(avg)}</td>
                  </tr>
                  {isExpanded && (
                    <tr style={expandedRowStyles}>
                      <td colSpan={6} style={expandedCellStyles}>
                        {turnsLoading ? (
                          <span style={{ color: '#8888aa', fontSize: 12 }}>Loading turns...</span>
                        ) : expandedTurns.length === 0 ? (
                          <span style={{ color: '#6666aa', fontSize: 12 }}>No completed turns recorded</span>
                        ) : (
                          <div>
                            <div style={{ fontSize: 11, color: '#6666aa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Turns ({expandedTurns.length})
                            </div>
                            {expandedTurns.map((t, i) => (
                              <div key={t.id} style={turnRowStyles}>
                                <span style={{ color: '#6666aa', width: 24 }}>#{i + 1}</span>
                                <span>{formatTurnTime(t.started_at)} → {t.ended_at ? formatTurnTime(t.ended_at) : '...'}</span>
                                <span style={{ color: t.duration_seconds ? '#6666cc' : '#555', fontFamily: 'monospace' }}>
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
  );
}
