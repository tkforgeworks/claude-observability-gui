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
import { useTopbar } from '../contexts/TopbarContext';
import type { TrendsWidgetId } from '../../shared/ipc-types';

type TimeRange = '7d' | '30d' | '90d' | '1y';

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const VALID_RANGES = new Set<string>(['7d', '30d', '90d', '1y']);

function isTimeRange(value: unknown): value is TimeRange {
  return typeof value === 'string' && VALID_RANGES.has(value);
}

export default function TrendsView(): React.JSX.Element {
  const { config: dashConfig, refreshConfig } = useDashboardConfig();
  const { setRangeControls, clearRangeControls } = useTopbar();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');
  const [timeRangeInitialized, setTimeRangeInitialized] = React.useState(false);

  React.useEffect(() => {
    if (dashConfig && !timeRangeInitialized) {
      const trendsView = dashConfig.views?.find((v) => v.id === 'trends');
      if (trendsView?.defaultTimeRange && isTimeRange(trendsView.defaultTimeRange)) {
        setTimeRange(trendsView.defaultTimeRange);
      }
      setTimeRangeInitialized(true);
    }
  }, [dashConfig, timeRangeInitialized]);

  const handleTimeRangeChange = React.useCallback((range: string) => {
    if (!isTimeRange(range)) return;
    setTimeRange(range);
    window.api.dashboard.get().then((config) => {
      const views = (config.views ?? []).map((v) =>
        v.id === 'trends' ? { ...v, defaultTimeRange: range } : v
      );
      window.api.dashboard.save({ ...config, views }).then(refreshConfig);
    }).catch(() => {});
  }, [refreshConfig]);

  React.useEffect(() => {
    setRangeControls(timeRange, handleTimeRangeChange);
    return clearRangeControls;
  }, [timeRange, handleTimeRangeChange, setRangeControls, clearRangeControls]);

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
    <div className="page">
      {loading ? (
        <div style={{ color: 'var(--text-tertiary)', padding: 40, textAlign: 'center' }}>Loading...</div>
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
