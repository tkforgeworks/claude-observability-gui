import React, { useState, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import StatusBanner from '../components/common/StatusBanner';
import StatCard from '../components/common/StatCard';
import HBar from '../components/charts/HBar';
import HeatmapChart from '../components/charts/HeatmapChart';
import { Icons } from '../components/common/Icons';
import { useApi } from '../hooks/useApi';
import type {
  ImportSummary,
  ChatConversationCount,
  ChatProject,
  ChatMemoryEntry,
  ChatDayCount,
} from '../../shared/ipc-types';

function formatPeriodLabel(period: string, groupBy: 'week' | 'month'): string {
  const d = new Date(period + 'T00:00:00');
  if (groupBy === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStaleness(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border-soft)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
      color: 'var(--text-primary)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{payload[0].value} conversation{payload[0].value !== 1 ? 's' : ''}</div>
    </div>
  );
}

const COLLAPSED_LIMIT = 5;

type ProjectSortKey = 'name' | 'doc_count' | 'created_at' | 'lifespan_days';
type SortDir = 'asc' | 'desc';

function ProjectsTable({ projects }: { projects: ChatProject[] }) {
  const [sortKey, setSortKey] = useState<ProjectSortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState(false);

  const handleSort = (key: ProjectSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [projects, sortKey, sortDir]);

  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_LIMIT);
  const hasMore = sorted.length > COLLAPSED_LIMIT;
  const arrow = (key: ProjectSortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Name{arrow('name')}</th>
            <th className="num" onClick={() => handleSort('doc_count')} style={{ cursor: 'pointer' }}>Docs{arrow('doc_count')}</th>
            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>Created{arrow('created_at')}</th>
            <th className="num" onClick={() => handleSort('lifespan_days')} style={{ cursor: 'pointer' }}>Lifespan{arrow('lifespan_days')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.project_id}>
              <td>
                {p.name || 'Untitled'}
                {p.is_private && <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 11, fontFamily: '"Poppins", sans-serif' }}>private</span>}
              </td>
              <td className="num">{p.doc_count}</td>
              <td>{formatDate(p.created_at)}</td>
              <td className="num">{p.lifespan_days}d</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--purple-primary)',
            fontSize: 12,
            fontFamily: '"JetBrains Mono", monospace',
            cursor: 'pointer',
            padding: '8px 0',
            textAlign: 'center',
            width: '100%',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show fewer ▲' : `Show all ${sorted.length} projects ▼`}
        </button>
      )}
    </div>
  );
}

function MemorySection({ memories }: { memories: ChatMemoryEntry[] }) {
  const items = useMemo(() => {
    return memories.map(m => ({
      label: m.type === 'conversation'
        ? 'Global conversation memory'
        : (m.project_name || m.project_id || 'Unknown project'),
      value: m.content_length,
      formattedValue: formatBytes(m.content_length),
    }));
  }, [memories]);

  return (
    <div className="card">
      <div className="card-head"><h2>Memory Sizes</h2></div>
      <HBar items={items} color="var(--chart-1)" altColor="var(--chart-5)" maxItems={12} />
    </div>
  );
}

export default function ChatHistoryView(): React.JSX.Element {
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const { data: counts, loading: countsLoading, error: countsError, refetch: refetchCounts } = useApi(
    () => window.api.chat.getConversationCounts(groupBy),
    [groupBy]
  );
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useApi(
    () => window.api.chat.getStats(),
    [lastSummary]
  );
  const { data: projects, error: projectsError, refetch: refetchProjects } = useApi(
    () => window.api.chat.getProjects(),
    [lastSummary]
  );
  const { data: memories, error: memoriesError, refetch: refetchMemories } = useApi(
    () => window.api.chat.getMemories(),
    [lastSummary]
  );
  const { data: convHeatmap, error: convHeatmapError, refetch: refetchConvHeatmap } = useApi(
    () => window.api.chat.getConversationHeatmap(365),
    [lastSummary]
  );
  const { data: projHeatmap, error: projHeatmapError, refetch: refetchProjHeatmap } = useApi(
    () => window.api.chat.getProjectHeatmap(365),
    [lastSummary]
  );
  const { data: settings } = useApi(() => window.api.settings.get(), [lastSummary]);

  const lastImportAt = settings?.lastChatImportAt ?? null;
  const hasData = stats != null && stats.totalConversations > 0;

  const staleThreshold = settings?.chatStalenessDays ?? 14;
  const isStale = useMemo(() => {
    if (!lastImportAt) return false;
    const daysSince = (Date.now() - new Date(lastImportAt).getTime()) / 86_400_000;
    return daysSince > staleThreshold;
  }, [lastImportAt, staleThreshold]);

  const chartData = useMemo(() => {
    if (!counts) return [];
    return counts.map((c: ChatConversationCount) => ({
      ...c,
      label: formatPeriodLabel(c.period, groupBy),
    }));
  }, [counts, groupBy]);

  const currentPeriodIndex = chartData.length > 0 ? chartData.length - 1 : -1;

  const convHeatmapData = useMemo(() => {
    if (!convHeatmap) return [];
    return convHeatmap.map(d => ({ date: d.date, value: d.count }));
  }, [convHeatmap]);

  const projHeatmapData = useMemo(() => {
    if (!projHeatmap) return [];
    return projHeatmap.map(d => ({ date: d.date, value: d.count }));
  }, [projHeatmap]);

  const refetchAll = useCallback(() => {
    refetchCounts();
    refetchStats();
    refetchProjects();
    refetchMemories();
    refetchConvHeatmap();
    refetchProjHeatmap();
  }, [refetchCounts, refetchStats, refetchProjects, refetchMemories, refetchConvHeatmap, refetchProjHeatmap]);

  const runImport = useCallback(async (filePath: string) => {
    setImporting(true);
    setImportError(null);
    setLastSummary(null);
    try {
      const summary = await window.api.chatImport.start(filePath);
      setLastSummary(summary);
      refetchAll();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }, [refetchAll]);

  const handleDropZoneClick = useCallback(async () => {
    if (importing) return;
    const filePath = await window.api.dialog.openFile([
      { name: 'ZIP Archives', extensions: ['zip'] },
    ]);
    if (filePath) runImport(filePath);
  }, [importing, runImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (importing) return;
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      const filePath = window.api.dialog.getFilePath(file);
      runImport(filePath);
    } else {
      setImportError('Please drop a .zip file exported from claude.ai');
    }
  }, [importing, runImport]);

  const scrollToDropZone = useCallback(() => {
    document.getElementById('chat-drop-zone')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Gate on both queries that decide between empty and populated states, so a
  // slow getStats doesn't flash the empty state before data arrives (CGUI-66)
  if (countsLoading || statsLoading) {
    return (
      <div className="page">
        <Loading label="chat history" />
      </div>
    );
  }

  // A failed stats/counts fetch must not masquerade as "no chat history"
  if (statsError || countsError) {
    return (
      <div className="page">
        <ErrorState
          what="chat history"
          error={statsError ?? countsError}
          onRetry={refetchAll}
        />
      </div>
    );
  }

  const sectionErrors: { label: string; error: Error }[] = [
    projectsError && { label: 'projects', error: projectsError },
    memoriesError && { label: 'memories', error: memoriesError },
    convHeatmapError && { label: 'conversation heatmap', error: convHeatmapError },
    projHeatmapError && { label: 'project heatmap', error: projHeatmapError },
  ].filter((e): e is { label: string; error: Error } => Boolean(e));

  if (!hasData) {
    return (
      <div className="page">
        <EmptyState
          title="No chat history imported"
          message="Drop your claude.ai data export ZIP below, or request an export from claude.ai > Settings > Privacy > Export data."
        />
        <div style={{ marginTop: 16 }}>
          <DropZone
            dragOver={dragOver}
            importing={importing}
            onClick={handleDropZoneClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        </div>
        {importError && <ImportError message={importError} />}
      </div>
    );
  }

  return (
    <div className="page">
      {sectionErrors.length > 0 && (
        <StatusBanner
          variant="error"
          message={`Some sections failed to load: ${sectionErrors.map(e => e.label).join(', ')}.`}
          action={{ label: 'Retry', onClick: refetchAll }}
        />
      )}
      {isStale && lastImportAt && (
        <StatusBanner
          variant="warning"
          message={`Chat data was last imported ${formatStaleness(lastImportAt)}. Import a fresh export to keep your history current.`}
          action={{ label: 'Import Now', onClick: scrollToDropZone }}
        />
      )}

      {stats && (
        <div className="stats-grid">
          <StatCard label="Conversations" value={stats.totalConversations} icon={Icons.chat} variant="minimal" />
          <StatCard label="Projects" value={stats.totalProjects} icon={Icons.layers} variant="minimal" />
          <StatCard label="Avg Msgs / Conv" value={stats.avgMessagesPerConversation} icon={Icons.hash} variant="minimal" />
          <StatCard label="Total Memory" value={formatBytes(stats.totalMemoryBytes)} icon={Icons.bolt} variant="minimal" />
        </div>
      )}

      {/* Conversations over time */}
      <div className="card">
        <div className="card-head">
          <h2>Conversations Over Time</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['week', 'month'] as const).map(g => (
              <button
                key={g}
                className={`range-tab${groupBy === g ? ' active' : ''}`}
                onClick={() => setGroupBy(g)}
              >
                {g === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-soft)' }}
              interval={chartData.length > 16 ? Math.floor(chartData.length / 10) : 0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(102, 102, 204, 0.08)' }} />
            <Bar
              dataKey="count"
              radius={[3, 3, 0, 0]}
              fill="var(--chart-1)"
              shape={(props: unknown) => {
                const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                const isCurrentPeriod = index === currentPeriodIndex;
                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={3}
                    ry={3}
                    fill={isCurrentPeriod ? 'var(--chart-4)' : 'var(--chart-1)'}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
        {lastImportAt && (
          <div className="summary-row" style={{ marginTop: 8 }}>
            <span>{stats?.totalConversations} total conversation{stats?.totalConversations !== 1 ? 's' : ''}</span>
            <span className="sep">&middot;</span>
            <span>Last import: {formatStaleness(lastImportAt)}</span>
          </div>
        )}
      </div>

      {/* Projects table */}
      {projects && projects.length > 0 && (
        <div>
          <div className="card-head" style={{ paddingLeft: 0 }}><h2>Projects</h2></div>
          <ProjectsTable projects={projects} />
        </div>
      )}

      {/* Memory breakdown */}
      {memories && memories.length > 0 && (
        <MemorySection memories={memories} />
      )}

      {/* Heatmaps — side by side when space allows, stacked below ~680px columns.
          680px ≈ HeatmapChart's minimum 365-day grid width (10px cells × 53 weeks). */}
      {(convHeatmapData.length > 0 || projHeatmapData.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(680px, 1fr))', gap: 14 }}>
          {convHeatmapData.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Conversation Activity</h2></div>
              <HeatmapChart
                data={convHeatmapData}
                days={365}
                colorScale="indigo"
                formatValue={v => `${v} conversation${v !== 1 ? 's' : ''}`}
              />
            </div>
          )}
          {projHeatmapData.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Project Activity</h2></div>
              <HeatmapChart
                data={projHeatmapData}
                days={365}
                colorScale="teal"
                formatValue={v => `${v} project${v !== 1 ? 's' : ''}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Import summary */}
      {lastSummary && (
        <div className="card" style={{ borderColor: 'var(--success)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)', fontFamily: '"Poppins", sans-serif', fontSize: 13 }}>
            Import Complete
          </div>
          <div style={{ fontSize: 13, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)', lineHeight: 1.8 }}>
            <div>{lastSummary.newRecords} new records imported</div>
            <div>{lastSummary.updatedRecords} records updated</div>
            <div>{lastSummary.skippedRecords} records unchanged</div>
            {lastSummary.errorCount > 0 && (
              <div style={{ color: 'var(--error)' }}>{lastSummary.errorCount} errors</div>
            )}
            <div style={{ marginTop: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
              Completed in {lastSummary.scanDurationMs}ms
            </div>
          </div>
        </div>
      )}

      {importError && <ImportError message={importError} />}

      <DropZone
        dragOver={dragOver}
        importing={importing}
        onClick={handleDropZoneClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
    </div>
  );
}

function ImportError({ message }: { message: string }) {
  return (
    <div className="card" style={{ borderColor: 'var(--error)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--error)', fontFamily: '"Poppins", sans-serif', fontSize: 13 }}>Import Failed</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: '"JetBrains Mono", monospace' }}>{message}</div>
    </div>
  );
}

function DropZone({ dragOver, importing, onClick, onDragOver, onDragLeave, onDrop }: {
  dragOver: boolean;
  importing: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      id="chat-drop-zone"
      style={{
        border: `2px dashed ${dragOver ? 'var(--purple-primary)' : 'var(--border-soft)'}`,
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: 13,
        fontFamily: '"Poppins", sans-serif',
        cursor: 'pointer',
        backgroundColor: dragOver ? 'rgba(102, 102, 204, 0.08)' : 'transparent',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label="Drop claude.ai export ZIP here or click to browse"
    >
      {importing ? (
        <div style={{ color: 'var(--purple-primary)' }}>Importing...</div>
      ) : (
        <>
          <div>Drop claude.ai export ZIP here</div>
          <div style={{ marginTop: 4, color: 'var(--text-tertiary)' }}>or click to browse</div>
        </>
      )}
    </div>
  );
}
