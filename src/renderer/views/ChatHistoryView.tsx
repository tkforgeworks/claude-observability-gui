/**
 * Chat history view — metric cards, conversation chart, projects table,
 * memory breakdown, import status, staleness warning, drop zone.
 * @see CGUI-37
 */

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
import StatusBanner from '../components/common/StatusBanner';
import MetricCard from '../components/common/MetricCard';
import { useApi } from '../hooks/useApi';
import type {
  ImportSummary,
  ChatConversationCount,
  ChatProject,
  ChatMemoryEntry,
  ChatDayCount,
} from '../../shared/ipc-types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  height: '100%',
  overflowY: 'auto',
};

const headerRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const headerStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ccccdd',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const metricsRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
};

const sectionHeaderStyles: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#8888aa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 8,
};

const toggleContainerStyles: React.CSSProperties = {
  display: 'flex',
  gap: 4,
};

const toggleButtonBase: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 12,
  border: '1px solid #3344aa',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#8888aa',
  backgroundColor: 'transparent',
  transition: 'background-color 0.15s, color 0.15s',
};

const toggleButtonActive: React.CSSProperties = {
  ...toggleButtonBase,
  backgroundColor: '#3344aa',
  color: '#ccccdd',
};

const chartContainerStyles: React.CSSProperties = {
  backgroundColor: 'rgba(20, 20, 40, 0.4)',
  borderRadius: 8,
  padding: '16px 8px 8px 8px',
  border: '1px solid rgba(51, 68, 170, 0.2)',
};

const tableContainerStyles: React.CSSProperties = {
  backgroundColor: 'rgba(20, 20, 40, 0.4)',
  borderRadius: 8,
  border: '1px solid rgba(51, 68, 170, 0.2)',
  overflowX: 'auto',
};

const tableStyles: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyles: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#8888aa',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid rgba(51, 68, 170, 0.2)',
  cursor: 'pointer',
  userSelect: 'none',
};

const tdStyles: React.CSSProperties = {
  padding: '8px 12px',
  color: '#ccccdd',
  borderBottom: '1px solid rgba(51, 68, 170, 0.1)',
};

const memoryBarContainerStyles: React.CSSProperties = {
  backgroundColor: 'rgba(20, 20, 40, 0.4)',
  borderRadius: 8,
  padding: 16,
  border: '1px solid rgba(51, 68, 170, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const memoryRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 13,
};

const memoryLabelStyles: React.CSSProperties = {
  width: 180,
  color: '#aaaacc',
  flexShrink: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const memoryBarBgStyles: React.CSSProperties = {
  flex: 1,
  height: 16,
  backgroundColor: 'rgba(51, 68, 170, 0.15)',
  borderRadius: 3,
  overflow: 'hidden',
};

const memorySizeStyles: React.CSSProperties = {
  width: 60,
  textAlign: 'right',
  color: '#666688',
  fontSize: 12,
  flexShrink: 0,
};

const metaRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  color: '#666688',
};

const dropZoneBaseStyles: React.CSSProperties = {
  border: '2px dashed #3344aa',
  borderRadius: 8,
  padding: 24,
  textAlign: 'center',
  color: '#8888aa',
  fontSize: 13,
  cursor: 'pointer',
  backgroundColor: 'rgba(51, 68, 170, 0.05)',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const dropZoneActiveStyles: React.CSSProperties = {
  ...dropZoneBaseStyles,
  borderColor: '#6666cc',
  backgroundColor: 'rgba(102, 102, 204, 0.12)',
};

const summaryStyles: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  backgroundColor: 'rgba(51, 68, 170, 0.1)',
  border: '1px solid #3344aa',
  color: '#ccccdd',
  fontSize: 13,
  lineHeight: 1.6,
};

const errorStyles: React.CSSProperties = {
  ...summaryStyles,
  backgroundColor: 'rgba(170, 51, 51, 0.1)',
  borderColor: '#aa3333',
  color: '#dd8888',
};

const emptyContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
};

const CHART_COLORS = {
  bar: '#6666cc',
  grid: 'rgba(102, 102, 204, 0.15)',
  axis: '#555577',
  tooltipBg: '#1a1a2e',
  tooltipBorder: '#3344aa',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriodLabel(period: string, groupBy: 'week' | 'month'): string {
  const d = new Date(period + 'T00:00:00');
  if (groupBy === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: CHART_COLORS.tooltipBg,
      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      color: '#ccccdd',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{payload[0].value} conversation{payload[0].value !== 1 ? 's' : ''}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const COLLAPSED_LIMIT = 5;

const showMoreButtonStyles: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6666cc',
  fontSize: 12,
  cursor: 'pointer',
  padding: '8px 0',
  textAlign: 'center',
  width: '100%',
};

type SortKey = 'name' | 'doc_count' | 'created_at' | 'lifespan_days';
type SortDir = 'asc' | 'desc';

function ProjectsTable({ projects }: { projects: ChatProject[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
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
  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div style={tableContainerStyles}>
      <table style={tableStyles}>
        <thead>
          <tr>
            <th style={thStyles} onClick={() => handleSort('name')}>Name{arrow('name')}</th>
            <th style={{ ...thStyles, textAlign: 'right' }} onClick={() => handleSort('doc_count')}>Docs{arrow('doc_count')}</th>
            <th style={thStyles} onClick={() => handleSort('created_at')}>Created{arrow('created_at')}</th>
            <th style={{ ...thStyles, textAlign: 'right' }} onClick={() => handleSort('lifespan_days')}>Lifespan{arrow('lifespan_days')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.project_id}>
              <td style={tdStyles}>
                {p.name || 'Untitled'}
                {p.is_private ? <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 11 }}>private</span> : ''}
              </td>
              <td style={{ ...tdStyles, textAlign: 'right' }}>{p.doc_count}</td>
              <td style={tdStyles}>{formatDate(p.created_at)}</td>
              <td style={{ ...tdStyles, textAlign: 'right' }}>{p.lifespan_days}d</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button style={showMoreButtonStyles} onClick={() => setExpanded(!expanded)}>
          {expanded ? `Show fewer ▲` : `Show all ${sorted.length} projects ▼`}
        </button>
      )}
    </div>
  );
}

function MemoryBreakdown({ memories }: { memories: ChatMemoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = useMemo(
    () => Math.max(...memories.map((m) => m.content_length), 1),
    [memories]
  );

  const visible = expanded ? memories : memories.slice(0, COLLAPSED_LIMIT);
  const hasMore = memories.length > COLLAPSED_LIMIT;

  return (
    <div style={memoryBarContainerStyles}>
      {visible.map((m, i) => {
        const label = m.type === 'conversation'
          ? 'Global conversation memory'
          : (m.project_name || m.project_id || 'Unknown project');
        const pct = (m.content_length / maxLength) * 100;

        return (
          <div key={`${m.type}-${m.project_id ?? i}`} style={memoryRowStyles}>
            <div style={memoryLabelStyles} title={label}>{label}</div>
            <div style={memoryBarBgStyles}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                backgroundColor: m.type === 'conversation' ? '#6666cc' : '#4488aa',
                borderRadius: 3,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={memorySizeStyles}>{formatBytes(m.content_length)}</div>
          </div>
        );
      })}
      {hasMore && (
        <button style={showMoreButtonStyles} onClick={() => setExpanded(!expanded)}>
          {expanded ? `Show fewer ▲` : `Show all ${memories.length} memories ▼`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini Heatmap
// ---------------------------------------------------------------------------

const HEATMAP_CELL = 12;
const HEATMAP_GAP = 2;
const HEATMAP_RADIUS = 2;
const HEATMAP_DAY_LABEL_W = 24;
const HEATMAP_MONTH_H = 16;
const HEATMAP_DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];
const HEATMAP_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HEATMAP_RAMPS = {
  conversations: ['#1a1a2e', '#1e2a5a', '#224488', '#3366bb', '#5588ee'],
  projects: ['#1a1a2e', '#1e2a2a', '#204848', '#308080', '#44aaaa'],
};

const heatmapSectionStyles: React.CSSProperties = {
  padding: 16,
  backgroundColor: '#12122a',
  borderRadius: 8,
  border: '1px solid #2a2a4a',
};

const heatmapLegendStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: '#8888aa',
  marginTop: 8,
};

interface HeatmapCell {
  date: string;
  weekIndex: number;
  dayIndex: number;
  count: number;
}

interface HeatmapLayout {
  cells: HeatmapCell[];
  monthLabels: { label: string; weekIndex: number }[];
  weeksCount: number;
}

function buildHeatmapGrid(data: ChatDayCount[], days: number): HeatmapLayout {
  const dataMap = new Map(data.map(d => [d.date, d.count]));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(12, 0, 0, 0);

  // Align to Sunday
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const cells: HeatmapCell[] = [];
  const monthLabels: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;
  let weekIndex = 0;

  const current = new Date(gridStart);
  while (current <= today) {
    const dayIndex = current.getDay();
    if (dayIndex === 0 && cells.length > 0) weekIndex++;

    const dateStr = current.toISOString().slice(0, 10);

    if (current.getMonth() !== lastMonth) {
      lastMonth = current.getMonth();
      if (dayIndex <= 3) {
        monthLabels.push({ label: HEATMAP_MONTH_NAMES[lastMonth], weekIndex });
      }
    }

    cells.push({ date: dateStr, weekIndex, dayIndex, count: dataMap.get(dateStr) ?? 0 });
    current.setDate(current.getDate() + 1);
  }

  return { cells, monthLabels, weeksCount: weekIndex + 1 };
}

function computeLevels(values: number[]): number[] {
  const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return values.map(() => 0);
  const p25 = nonZero[Math.floor(nonZero.length * 0.25)] ?? 1;
  const p50 = nonZero[Math.floor(nonZero.length * 0.50)] ?? p25;
  const p75 = nonZero[Math.floor(nonZero.length * 0.75)] ?? p50;
  return values.map(v => {
    if (v === 0) return 0;
    if (v <= p25) return 1;
    if (v <= p50) return 2;
    if (v <= p75) return 3;
    return 4;
  });
}

function MiniHeatmap({ title, data, days, colorRamp, itemLabel }: {
  title: string;
  data: ChatDayCount[];
  days: number;
  colorRamp: string[];
  itemLabel: string;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const grid = useMemo(() => buildHeatmapGrid(data, days), [data, days]);
  const levels = useMemo(() => computeLevels(grid.cells.map(c => c.count)), [grid]);

  const gridWidth = HEATMAP_DAY_LABEL_W + grid.weeksCount * (HEATMAP_CELL + HEATMAP_GAP);
  const gridHeight = HEATMAP_MONTH_H + 7 * (HEATMAP_CELL + HEATMAP_GAP);

  return (
    <div style={heatmapSectionStyles}>
      <div style={sectionHeaderStyles}>{title}</div>
      <div style={{ overflow: 'auto' }}>
        <svg width={gridWidth} height={gridHeight} style={{ display: 'block' }}>
          {grid.monthLabels.map((m, i) => (
            <text
              key={i}
              x={HEATMAP_DAY_LABEL_W + m.weekIndex * (HEATMAP_CELL + HEATMAP_GAP)}
              y={HEATMAP_MONTH_H - 4}
              fill="#6666aa"
              fontSize={9}
            >
              {m.label}
            </text>
          ))}
          {HEATMAP_DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={i}
                x={0}
                y={HEATMAP_MONTH_H + i * (HEATMAP_CELL + HEATMAP_GAP) + HEATMAP_CELL - 2}
                fill="#6666aa"
                fontSize={9}
              >
                {label}
              </text>
            ) : null
          )}
          {grid.cells.map((cell, i) => {
            const x = HEATMAP_DAY_LABEL_W + cell.weekIndex * (HEATMAP_CELL + HEATMAP_GAP);
            const y = HEATMAP_MONTH_H + cell.dayIndex * (HEATMAP_CELL + HEATMAP_GAP);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={HEATMAP_CELL}
                height={HEATMAP_CELL}
                rx={HEATMAP_RADIUS}
                ry={HEATMAP_RADIUS}
                fill={colorRamp[levels[i]]}
                stroke={levels[i] > 0 ? colorRamp[levels[i]] : '#2a2a4a'}
                strokeWidth={0.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const d = new Date(cell.date + 'T12:00:00');
                  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                  setTooltip({
                    x: e.clientX + 12,
                    y: e.clientY - 10,
                    text: `${label}: ${cell.count} ${itemLabel}${cell.count !== 1 ? 's' : ''}`,
                  });
                }}
                onMouseMove={(e) => {
                  setTooltip(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 10 } : null);
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </svg>
      </div>
      <div style={heatmapLegendStyles}>
        <span>Less</span>
        {colorRamp.map((color, i) => (
          <div
            key={i}
            style={{
              width: HEATMAP_CELL,
              height: HEATMAP_CELL,
              backgroundColor: color,
              borderRadius: HEATMAP_RADIUS,
              border: i === 0 ? '0.5px solid #2a2a4a' : 'none',
            }}
          />
        ))}
        <span>More</span>
      </div>
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          padding: '5px 8px',
          backgroundColor: '#2a2a4a',
          border: '1px solid #3a3a6a',
          borderRadius: 6,
          fontSize: 11,
          color: '#ccccdd',
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatHistoryView(): React.JSX.Element {
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Fetch data
  const { data: counts, loading: countsLoading, refetch: refetchCounts } = useApi(
    () => window.api.chat.getConversationCounts(groupBy),
    [groupBy]
  );
  const { data: stats, refetch: refetchStats } = useApi(
    () => window.api.chat.getStats(),
    [lastSummary]
  );
  const { data: projects, refetch: refetchProjects } = useApi(
    () => window.api.chat.getProjects(),
    [lastSummary]
  );
  const { data: memories, refetch: refetchMemories } = useApi(
    () => window.api.chat.getMemories(),
    [lastSummary]
  );
  const { data: convHeatmap, refetch: refetchConvHeatmap } = useApi(
    () => window.api.chat.getConversationHeatmap(365),
    [lastSummary]
  );
  const { data: projHeatmap, refetch: refetchProjHeatmap } = useApi(
    () => window.api.chat.getProjectHeatmap(365),
    [lastSummary]
  );
  const { data: settings } = useApi(() => window.api.settings.get(), [lastSummary]);

  const lastImportAt = settings?.lastChatImportAt ?? null;
  const hasData = stats != null && stats.totalConversations > 0;

  // Check staleness (configurable via settings, default 14 days)
  const staleThreshold = settings?.chatStalenessDays ?? 14;
  const isStale = useMemo(() => {
    if (!lastImportAt) return false;
    const daysSince = (Date.now() - new Date(lastImportAt).getTime()) / 86_400_000;
    return daysSince > staleThreshold;
  }, [lastImportAt, staleThreshold]);

  // Chart data with formatted labels
  const chartData = useMemo(() => {
    if (!counts) return [];
    return counts.map((c: ChatConversationCount) => ({
      ...c,
      label: formatPeriodLabel(c.period, groupBy),
    }));
  }, [counts, groupBy]);

  // Import handlers
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
    if (filePath) {
      runImport(filePath);
    }
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

  return (
    <div style={viewStyles}>
      {/* Staleness warning */}
      {isStale && lastImportAt && (
        <StatusBanner
          variant="warning"
          message={`Chat data was last imported ${formatStaleness(lastImportAt)}. Import a fresh export to keep your history current.`}
          action={{ label: 'Import Now', onClick: scrollToDropZone }}
        />
      )}

      {/* Header */}
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Chat History</h1>
        {hasData && (
          <div style={toggleContainerStyles}>
            <button
              style={groupBy === 'week' ? toggleButtonActive : toggleButtonBase}
              onClick={() => setGroupBy('week')}
            >
              Weekly
            </button>
            <button
              style={groupBy === 'month' ? toggleButtonActive : toggleButtonBase}
              onClick={() => setGroupBy('month')}
            >
              Monthly
            </button>
          </div>
        )}
      </div>

      {countsLoading ? (
        <div style={{ color: '#666688', fontSize: 13, padding: 24 }}>Loading...</div>
      ) : hasData ? (
        <>
          {/* Metric cards */}
          {stats && (
            <div style={metricsRowStyles}>
              <MetricCard
                value={String(stats.totalConversations)}
                label="Conversations"
              />
              <MetricCard
                value={String(stats.totalProjects)}
                label="Projects"
              />
              <MetricCard
                value={String(stats.avgMessagesPerConversation)}
                label="Avg Messages / Conv"
              />
              <MetricCard
                value={formatBytes(stats.totalMemoryBytes)}
                label="Total Memory Size"
              />
            </div>
          )}

          {/* Conversation count chart */}
          <div>
            <div style={sectionHeaderStyles}>Conversations Over Time</div>
            <div style={chartContainerStyles}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    interval={chartData.length > 16 ? Math.floor(chartData.length / 10) : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(102, 102, 204, 0.08)' }} />
                  <Bar dataKey="count" fill={CHART_COLORS.bar} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {lastImportAt && (
              <div style={{ ...metaRowStyles, marginTop: 8 }}>
                <span>{stats?.totalConversations} total conversation{stats?.totalConversations !== 1 ? 's' : ''}</span>
                <span>Last import: {formatStaleness(lastImportAt)}</span>
              </div>
            )}
          </div>

          {/* Projects table */}
          {projects && projects.length > 0 && (
            <div>
              <div style={sectionHeaderStyles}>Projects</div>
              <ProjectsTable projects={projects} />
            </div>
          )}

          {/* Memory breakdown */}
          {memories && memories.length > 0 && (
            <div>
              <div style={sectionHeaderStyles}>Memory Sizes</div>
              <MemoryBreakdown memories={memories} />
            </div>
          )}

          {/* Heatmaps */}
          {convHeatmap && convHeatmap.length > 0 && (
            <MiniHeatmap
              title="Conversation Activity"
              data={convHeatmap}
              days={365}
              colorRamp={HEATMAP_RAMPS.conversations}
              itemLabel="conversation"
            />
          )}
          {projHeatmap && projHeatmap.length > 0 && (
            <MiniHeatmap
              title="Project Activity"
              data={projHeatmap}
              days={365}
              colorRamp={HEATMAP_RAMPS.projects}
              itemLabel="project"
            />
          )}
        </>
      ) : (
        <div style={emptyContainerStyles}>
          <EmptyState
            title="No chat history imported"
            message="Drop your claude.ai data export ZIP below, or request an export from claude.ai > Settings > Privacy > Export data."
          />
        </div>
      )}

      {/* Import summary */}
      {lastSummary && (
        <div style={summaryStyles}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#aaaacc' }}>
            Import Complete
          </div>
          <div>{lastSummary.newRecords} new records imported</div>
          <div>{lastSummary.updatedRecords} records updated</div>
          <div>{lastSummary.skippedRecords} records unchanged</div>
          {lastSummary.errorCount > 0 && (
            <div style={{ color: '#dd8888' }}>{lastSummary.errorCount} errors</div>
          )}
          <div style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>
            Completed in {lastSummary.scanDurationMs}ms
          </div>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div style={errorStyles}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Import Failed</div>
          <div>{importError}</div>
        </div>
      )}

      {/* Drop zone */}
      <div
        id="chat-drop-zone"
        style={dragOver ? dropZoneActiveStyles : dropZoneBaseStyles}
        onClick={handleDropZoneClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Drop claude.ai export ZIP here or click to browse"
      >
        {importing ? (
          <div style={{ color: '#6666cc' }}>Importing...</div>
        ) : (
          <>
            <div>Drop claude.ai export ZIP here</div>
            <div style={{ marginTop: 4, opacity: 0.7 }}>or click to browse</div>
          </>
        )}
      </div>
    </div>
  );
}
