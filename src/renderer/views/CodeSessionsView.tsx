/**
 * Claude Code sessions view — sortable table with real session data.
 * @see §4 "Claude Code Sessions List" in 04-wireframes.md
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { CodeSession } from '../../shared/ipc-types';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = 'project_path' | 'model' | 'input_tokens' | 'output_tokens' | 'cache_creation_tokens' | 'cache_read_tokens' | 'cost_usd' | 'started_at';
type SortDir = 'asc' | 'desc';

function formatTokens(n: number | null): string {
  if (n == null || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatCost(n: number | null): string {
  if (n == null) return '—';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatProjectName(p: string | null): string {
  if (!p) return '—';
  // Show last 2 path segments for brevity
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length <= 2 ? parts.join('/') : parts.slice(-2).join('/');
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 3650 },
];

export default function CodeSessionsView(): React.JSX.Element {
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    const from = daysAgo(rangeDays);
    const to = new Date().toISOString();
    window.api.codeSessions.getByDateRange({ from, to })
      .then(setSessions)
      .catch(err => {
        console.error('[CodeSessionsView] fetch failed:', err);
        setSessions([]);
      })
      .finally(() => setLoading(false));
  }, [rangeDays]);

  const sorted = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
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

  if (loading) {
    return (
      <div style={viewStyles}>
        <div style={headerRowStyles}>
          <h1 style={headerStyles}>Claude Code</h1>
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
          <h1 style={headerStyles}>Claude Code</h1>
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
            title="No Code sessions yet"
            message="Claude Code session data will appear here once the JSONL importer has scanned ~/.claude/projects/. Check Settings > General for import status."
          />
        </div>
      </div>
    );
  }

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Claude Code</h1>
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
        <span>Input: <span style={summaryValueStyles}>{formatTokens(totals.input)}</span></span>
        <span>Output: <span style={summaryValueStyles}>{formatTokens(totals.output)}</span></span>
        <span>Cache: <span style={summaryValueStyles}>{formatTokens(totals.cache)}</span></span>
        <span>Total cost: <span style={summaryValueStyles}>{formatCost(totals.cost)}</span></span>
      </div>

      <div style={tableContainerStyles}>
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={thStyles(true)} onClick={() => handleSort('project_path')}>Project{sortIndicator('project_path')}</th>
              <th style={thStyles(true)} onClick={() => handleSort('model')}>Model{sortIndicator('model')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('input_tokens')}>Input{sortIndicator('input_tokens')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('output_tokens')}>Output{sortIndicator('output_tokens')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('cache_creation_tokens')}>Cache Write{sortIndicator('cache_creation_tokens')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('cache_read_tokens')}>Cache Read{sortIndicator('cache_read_tokens')}</th>
              <th style={{ ...thStyles(true), textAlign: 'right' }} onClick={() => handleSort('cost_usd')}>Cost{sortIndicator('cost_usd')}</th>
              <th style={thStyles(true)} onClick={() => handleSort('started_at')}>Date{sortIndicator('started_at')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.id} style={{ backgroundColor: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a1a3e')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <td style={tdStyles} title={s.project_path ?? undefined}>
                  <div>{formatProjectName(s.project_path)}</div>
                  {s.slug && <div style={{ fontSize: 11, color: '#6666aa', marginTop: 2 }}>{s.slug}</div>}
                </td>
                <td style={{ ...tdStyles, color: '#8888cc', fontSize: 12 }}>{s.model ?? '—'}</td>
                <td style={numericTdStyles}>{formatTokens(s.input_tokens)}</td>
                <td style={numericTdStyles}>{formatTokens(s.output_tokens)}</td>
                <td style={numericTdStyles}>{formatTokens(s.cache_creation_tokens)}</td>
                <td style={numericTdStyles}>{formatTokens(s.cache_read_tokens)}</td>
                <td style={{ ...numericTdStyles, color: s.cost_usd != null ? '#66cc88' : '#666' }}>{formatCost(s.cost_usd)}</td>
                <td style={{ ...tdStyles, fontSize: 12, color: '#8888aa' }}>{formatDate(s.started_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
