import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ProjectAggregate } from '../../shared/ipc-types';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import StatCard from '../components/common/StatCard';
import SortableTh from '../components/common/SortableTh';
import { Icons } from '../components/common/Icons';
import { useTopbar } from '../contexts/TopbarContext';
import { useApi } from '../hooks/useApi';
import {
  formatCost,
  formatDateFull,
  formatTokens,
  rangeDays,
  shortenModel,
} from '../utils/format';

type SortKey = 'displayName' | 'totalCostUsd' | 'codeSessionCount' | 'coworkSessionCount' | 'lastActiveAt' | 'activeDays';
type SortDir = 'asc' | 'desc';

export default function ProjectsView(): React.JSX.Element {
  const [rangeLabel, setRangeLabel] = useState('90d');
  const [sortKey, setSortKey] = useState<SortKey>('totalCostUsd');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

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
  } = useApi(() => window.api.projects.getAggregates(days), [days]);
  const projects = fetched ?? [];

  const totals = useMemo(() => {
    let cost = 0, input = 0, output = 0, codeSessions = 0, coworkSessions = 0;
    for (const p of projects) {
      cost += p.totalCostUsd;
      input += p.inputTokens;
      output += p.outputTokens;
      codeSessions += p.codeSessionCount;
      coworkSessions += p.coworkSessionCount;
    }
    return { cost, input, output, codeSessions, coworkSessions, projectCount: projects.length };
  }, [projects]);

  const sorted = useMemo(() => {
    const copy = [...projects];
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
  }, [projects, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (loading && !fetched) {
    return (
      <div className="page">
        <Loading label="projects" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState what="project aggregates" error={error} onRetry={refetch} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="No projects found"
          message="Project aggregates will appear here once Claude Code sessions or Cowork sessions are imported with a project path."
        />
      </div>
    );
  }

  return (
    <div className="page">
      {/* Summary stats — 6-up at the default window, wrapping to 3×2 at the
          900px minimum rather than squeezing six ~100px cards (CGUI-69).
          158px is the only track minimum that holds both ends: 6 columns
          still fit the ~1036px column at 1280px wide, and a 4th column no
          longer fits the ~656px column at 900px. */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(158px, 100%), 1fr))' }}>
        <StatCard label="Projects" value={totals.projectCount} icon={Icons.projects} variant="minimal" />
        <StatCard label="Total Cost" value={formatCost(totals.cost)} icon={Icons.dollar} variant="minimal" />
        <StatCard label="Code Sessions" value={totals.codeSessions.toLocaleString()} icon={Icons.code} variant="minimal" />
        <StatCard label="Cowork Sessions" value={totals.coworkSessions.toLocaleString()} icon={Icons.cowork} variant="minimal" />
        <StatCard label="Input Tokens" value={formatTokens(totals.input)} icon={Icons.arrowUp} variant="minimal" />
        <StatCard label="Output Tokens" value={formatTokens(totals.output)} icon={Icons.arrowDown} variant="minimal" />
      </div>

      {/* Projects table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="summary-row" style={{ padding: '10px 22px', borderBottom: '1px solid var(--border-soft)' }}>
          <span><strong>{totals.projectCount}</strong> projects</span>
          <span className="sep">·</span>
          <span>Cost: <strong>{formatCost(totals.cost)}</strong></span>
          <span className="sep">·</span>
          <span>Sessions: <strong>{(totals.codeSessions + totals.coworkSessions).toLocaleString()}</strong></span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th aria-hidden="true" style={{ width: 24 }} />
                <SortableTh label="Project" active={sortKey === 'displayName'} dir={sortDir} onSort={() => handleSort('displayName')} />
                <SortableTh label="Cost" className="num" active={sortKey === 'totalCostUsd'} dir={sortDir} onSort={() => handleSort('totalCostUsd')} />
                <SortableTh label="Code" className="num" active={sortKey === 'codeSessionCount'} dir={sortDir} onSort={() => handleSort('codeSessionCount')} />
                <SortableTh label="Cowork" className="num" active={sortKey === 'coworkSessionCount'} dir={sortDir} onSort={() => handleSort('coworkSessionCount')} />
                <th className="num">Tokens (in/out)</th>
                <SortableTh label="Active Days" className="num" active={sortKey === 'activeDays'} dir={sortDir} onSort={() => handleSort('activeDays')} />
                <SortableTh label="Last Active" active={sortKey === 'lastActiveAt'} dir={sortDir} onSort={() => handleSort('lastActiveAt')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const leaf = p.displayName.includes('/') ? p.displayName.split('/').pop() : null;
                return (
                  <React.Fragment key={p.projectPath}>
                    <tr
                      className={expandedProject === p.projectPath ? 'active' : undefined}
                      onClick={() => setExpandedProject(expandedProject === p.projectPath ? null : p.projectPath)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ width: 24, textAlign: 'center' }}>
                        <button
                          aria-expanded={expandedProject === p.projectPath}
                          aria-label={`${expandedProject === p.projectPath ? 'Collapse' : 'Expand'} ${p.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedProject(expandedProject === p.projectPath ? null : p.projectPath);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: 11 }}
                        >
                          {expandedProject === p.projectPath ? '▾' : '▸'}
                        </button>
                      </td>
                      <td>
                        <span className="path">
                          {leaf ? (
                            <>{p.displayName.slice(0, p.displayName.lastIndexOf('/') + 1)}<span className="leaf">{leaf}</span></>
                          ) : p.displayName}
                        </span>
                      </td>
                      <td className="num" style={{ color: p.totalCostUsd > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                        {formatCost(p.totalCostUsd)}
                      </td>
                      <td className="num">{p.codeSessionCount || '—'}</td>
                      <td className="num">{p.coworkSessionCount || '—'}</td>
                      {/* Token counts are only meaningful for Code sessions.
                          A Cowork-only project reports 0, which under the
                          null-vs-zero convention would read as a measured
                          zero — it's actually "not applicable" (CGUI-70). */}
                      <td className="num">
                        {formatTokens(p.codeSessionCount > 0 ? p.inputTokens : null)}
                        {' / '}
                        {formatTokens(p.codeSessionCount > 0 ? p.outputTokens : null)}
                      </td>
                      <td className="num">{p.activeDays}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatDateFull(p.lastActiveAt)}
                      </td>
                    </tr>
                    {expandedProject === p.projectPath && (
                      <tr className="detail-row">
                        <td colSpan={8} style={{ padding: '16px 20px', background: 'var(--surface-sunken)' }}>
                          <ProjectDetail project={p} />
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

function ProjectDetail({ project }: { project: ProjectAggregate }): React.JSX.Element {
  const modelEntries = Object.entries(project.models).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Left: Token breakdown */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, fontFamily: '"Poppins"', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Token Breakdown
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Input</span>
          <span style={{ textAlign: 'right' }}>{formatTokens(project.inputTokens)}</span>
          <span style={{ color: 'var(--text-secondary)' }}>Output</span>
          <span style={{ textAlign: 'right' }}>{formatTokens(project.outputTokens)}</span>
          <span style={{ color: 'var(--text-secondary)' }}>Cache Read</span>
          <span style={{ textAlign: 'right' }}>{formatTokens(project.cacheReadTokens)}</span>
          <span style={{ color: 'var(--text-secondary)' }}>Cache Write</span>
          <span style={{ textAlign: 'right' }}>{formatTokens(project.cacheWriteTokens)}</span>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>
          {project.projectPath}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
          First seen: {formatDateFull(project.firstSeenAt)} · Cowork turns: {project.coworkTurnCount || '—'}
        </div>
      </div>

      {/* Right: Model usage */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, fontFamily: '"Poppins"', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Model Usage
        </div>
        {modelEntries.length === 0 ? (
          <span className="muted" style={{ fontSize: 12 }}>No code sessions</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {modelEntries.map(([model, count]) => {
              // Guard the divisor: a project can carry model rows with a zero
              // session count, which rendered width: Infinity% (CGUI-70).
              const pct = project.codeSessionCount > 0
                ? Math.round((count / project.codeSessionCount) * 100)
                : 0;
              return (
                <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'var(--border-soft)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: 'var(--purple-primary)',
                      borderRadius: 3,
                    }} />
                  </div>
                  <span className="mono" style={{ minWidth: 90, fontSize: 11 }}>
                    {shortenModel(model)}
                  </span>
                  <span className="mono muted" style={{ minWidth: 28, textAlign: 'right' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
