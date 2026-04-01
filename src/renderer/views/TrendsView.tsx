/**
 * Trends view — scrollable page with time range selector and 7 widget cards.
 * @see §7 "Trends View" in 04-wireframes.md
 */

import React from 'react';
import EmptyState from '../components/common/EmptyState';
import CacheEfficiencyChart from '../components/common/CacheEfficiencyChart';
import TurnDurationChart from '../components/common/TurnDurationChart';
import CostVelocityChart from '../components/common/CostVelocityChart';
import SessionDensityChart from '../components/common/SessionDensityChart';
import ModelMigrationChart from '../components/common/ModelMigrationChart';
import ProjectTimelineChart from '../components/common/ProjectTimelineChart';
import UsagePatternsCard from '../components/common/UsagePatternsCard';
import { useApi } from '../hooks/useApi';
import { useDashboardConfig } from '../contexts/DashboardConfigContext';
import type { TrendsWidgetId } from '../../shared/ipc-types';

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'custom';

const TIME_RANGE_DAYS: Record<Exclude<TimeRange, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const viewStyles: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
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

const timeRangeSelectorStyles: React.CSSProperties = {
  display: 'flex',
  gap: 4,
};

const rangeButtonStyles = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  backgroundColor: active ? '#4444aa' : 'transparent',
  border: '1px solid #3333aa',
  borderRadius: 4,
  color: active ? '#ffffff' : '#8888aa',
  fontSize: 13,
  cursor: 'pointer',
});

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d',  label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y',  label: '1y' },
];

const VALID_RANGES = new Set<string>(['7d', '30d', '90d', '1y']);

function isTimeRange(value: unknown): value is TimeRange {
  return typeof value === 'string' && VALID_RANGES.has(value);
}

export default function TrendsView(): React.JSX.Element {
  const { config: dashConfig, refreshConfig } = useDashboardConfig();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');
  const [timeRangeInitialized, setTimeRangeInitialized] = React.useState(false);

  // Initialize time range from dashboard config when context loads
  React.useEffect(() => {
    if (dashConfig && !timeRangeInitialized) {
      const trendsView = dashConfig.views?.find((v) => v.id === 'trends');
      if (trendsView?.defaultTimeRange && isTimeRange(trendsView.defaultTimeRange)) {
        setTimeRange(trendsView.defaultTimeRange);
      }
      setTimeRangeInitialized(true);
    }
  }, [dashConfig, timeRangeInitialized]);

  // Persist time range selection to dashboard config
  const handleTimeRangeChange = React.useCallback((range: TimeRange) => {
    setTimeRange(range);
    window.api.dashboard.get().then((config) => {
      const views = (config.views ?? []).map((v) =>
        v.id === 'trends' ? { ...v, defaultTimeRange: range } : v
      );
      window.api.dashboard.save({ ...config, views }).then(refreshConfig);
    }).catch(() => { /* persistence is best-effort */ });
  }, [refreshConfig]);

  const days = TIME_RANGE_DAYS[timeRange as keyof typeof TIME_RANGE_DAYS] ?? 30;

  const { data: cacheData, loading: cacheLoading } = useApi(
    () => window.api.analytics.getCacheEfficiency(days),
    [days]
  );

  const { data: turnData, loading: turnLoading } = useApi(
    () => window.api.analytics.getTurnDurationTrend(days),
    [days]
  );

  const { data: costData, loading: costLoading } = useApi(
    () => window.api.analytics.getDailyCosts(days),
    [days]
  );

  const { data: densityData, loading: densityLoading } = useApi(
    () => window.api.analytics.getSessionDensity(days),
    [days]
  );

  const { data: modelMixData, loading: modelMixLoading } = useApi(
    () => window.api.analytics.getModelMix(days),
    [days]
  );

  const { data: timelineData, loading: timelineLoading } = useApi(
    () => window.api.analytics.getProjectTimeline(days),
    [days]
  );

  const { data: patternsData, loading: patternsLoading } = useApi(
    () => window.api.analytics.getUsagePatterns(days),
    [days]
  );

  const loading = !dashConfig || !timeRangeInitialized || cacheLoading || turnLoading || costLoading
    || densityLoading || modelMixLoading || timelineLoading || patternsLoading;

  // Widget registry: maps widget IDs to their rendered component and data availability
  const widgetRegistry: Record<TrendsWidgetId, { node: React.ReactNode; hasData: boolean }> = {
    usagePatternsSummary: {
      node: patternsData ? <UsagePatternsCard data={patternsData} /> : null,
      hasData: !!(patternsData && patternsData.totalSessions > 0),
    },
    costVelocity: {
      node: costData ? <CostVelocityChart data={costData} /> : null,
      hasData: !!(costData && costData.some(d => d.costUsd > 0)),
    },
    cacheEfficiency: {
      node: cacheData ? <CacheEfficiencyChart data={cacheData} /> : null,
      hasData: !!(cacheData && cacheData.length > 0),
    },
    turnDurationTrend: {
      node: turnData ? <TurnDurationChart data={turnData} /> : null,
      hasData: !!(turnData && turnData.some(d => d.turnCount > 0)),
    },
    sessionDensity: {
      node: densityData ? <SessionDensityChart data={densityData} /> : null,
      hasData: !!(densityData && densityData.some(d => d.sessionCount > 0)),
    },
    projectActivityTimeline: {
      node: timelineData ? <ProjectTimelineChart rows={timelineData.rows} dateRange={timelineData.dateRange} /> : null,
      hasData: !!(timelineData && timelineData.rows.length > 0),
    },
    modelMigration: {
      node: modelMixData ? <ModelMigrationChart data={modelMixData.days} models={modelMixData.models} /> : null,
      hasData: !!(modelMixData && modelMixData.models.length > 0),
    },
  };

  // Build ordered, visible widget list from config
  const orderedWidgets = dashConfig
    ? [...dashConfig.trendsWidgets]
        .filter(w => w.visible)
        .sort((a, b) => a.order - b.order)
        .map(w => ({ id: w.id, ...widgetRegistry[w.id] }))
        .filter(w => w.hasData)
    : [];

  const hasAnyData = orderedWidgets.length > 0;

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Trends</h1>
        <div style={timeRangeSelectorStyles}>
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              style={rangeButtonStyles(timeRange === value)}
              onClick={() => handleTimeRangeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#666688', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : hasAnyData ? (
        <>
          {orderedWidgets.map(w => (
            <React.Fragment key={w.id}>{w.node}</React.Fragment>
          ))}
        </>
      ) : (
        <EmptyState
          title="No trend data available"
          message="Trends will appear here once session data has been collected. Import Claude Code JSONL data or connect the log watcher to begin."
        />
      )}
    </div>
  );
}
