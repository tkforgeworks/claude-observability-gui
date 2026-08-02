import React from 'react';
import EmptyState from '../components/common/EmptyState';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
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

/** Card shell for widget loading/error/empty placeholders (CGUI-66) */
function WidgetPlaceholder({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-head"><h2>{title}</h2></div>
      {children}
    </div>
  );
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
    }).catch((err: unknown) => {
      console.error('[TrendsView] failed to persist range selection:', err);
    });
  }, [refreshConfig]);

  React.useEffect(() => {
    setRangeControls(timeRange, handleTimeRangeChange);
    return clearRangeControls;
  }, [timeRange, handleTimeRangeChange, setRangeControls, clearRangeControls]);

  const days = TIME_RANGE_DAYS[timeRange as keyof typeof TIME_RANGE_DAYS] ?? 30;

  const cache = useApi(() => window.api.analytics.getCacheEfficiency(days), [days]);
  const turn = useApi(() => window.api.analytics.getTurnDurationTrend(days), [days]);
  const cost = useApi(() => window.api.analytics.getDailyCosts(days), [days]);
  const density = useApi(() => window.api.analytics.getSessionDensity(days), [days]);
  const modelMix = useApi(() => window.api.analytics.getModelMix(days), [days]);
  const timeline = useApi(() => window.api.analytics.getProjectTimeline(days), [days]);
  const patterns = useApi(() => window.api.analytics.getUsagePatterns(days), [days]);

  // Only the dashboard config gates the whole page — each widget carries its
  // own loading/error/empty state so one slow or failed endpoint no longer
  // blanks or silently drops anything (CGUI-66)
  const configLoading = !dashConfig || !timeRangeInitialized;

  interface WidgetEntry {
    title: string;
    node: React.ReactNode;
    hasData: boolean;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  }

  const widgetRegistry: Record<TrendsWidgetId, WidgetEntry> = {
    usagePatternsSummary: {
      title: 'Usage Patterns',
      node: patterns.data ? <UsagePatternsCard data={patterns.data} /> : null,
      hasData: !!(patterns.data && patterns.data.totalSessions > 0),
      loading: patterns.loading, error: patterns.error, refetch: patterns.refetch,
    },
    costVelocity: {
      title: 'Cost Velocity',
      node: cost.data ? <CostVelocityChart data={cost.data} /> : null,
      hasData: !!(cost.data && cost.data.some(d => d.costUsd > 0)),
      loading: cost.loading, error: cost.error, refetch: cost.refetch,
    },
    cacheEfficiency: {
      title: 'Cache Efficiency',
      node: cache.data ? <CacheEfficiencyChart data={cache.data} /> : null,
      hasData: !!(cache.data && cache.data.length > 0),
      loading: cache.loading, error: cache.error, refetch: cache.refetch,
    },
    turnDurationTrend: {
      title: 'Turn Duration Trend',
      node: turn.data ? <TurnDurationChart data={turn.data} /> : null,
      hasData: !!(turn.data && turn.data.some(d => d.turnCount > 0)),
      loading: turn.loading, error: turn.error, refetch: turn.refetch,
    },
    sessionDensity: {
      title: 'Session Density',
      node: density.data ? <SessionDensityChart data={density.data} /> : null,
      hasData: !!(density.data && density.data.some(d => d.sessionCount > 0)),
      loading: density.loading, error: density.error, refetch: density.refetch,
    },
    projectActivityTimeline: {
      title: 'Project Activity Timeline',
      node: timeline.data ? <ProjectTimelineChart rows={timeline.data.rows} dateRange={timeline.data.dateRange} /> : null,
      hasData: !!(timeline.data && timeline.data.rows.length > 0),
      loading: timeline.loading, error: timeline.error, refetch: timeline.refetch,
    },
    modelMigration: {
      title: 'Model Migration',
      node: modelMix.data ? <ModelMigrationChart data={modelMix.data.days} models={modelMix.data.models} /> : null,
      hasData: !!(modelMix.data && modelMix.data.models.length > 0),
      loading: modelMix.loading, error: modelMix.error, refetch: modelMix.refetch,
    },
  };

  // Ordered, visible widgets — empty/loading/error widgets stay in the list
  // and render placeholder cards instead of vanishing
  const orderedWidgets = dashConfig
    ? [...dashConfig.trendsWidgets]
        .filter(w => w.visible)
        .sort((a, b) => a.order - b.order)
        .map(w => ({ id: w.id, ...widgetRegistry[w.id] }))
    : [];

  const allSettledEmpty =
    orderedWidgets.length > 0 &&
    orderedWidgets.every(w => !w.loading && !w.error && !w.hasData);

  return (
    <div className="page">
      {configLoading ? (
        <Loading />
      ) : allSettledEmpty ? (
        <EmptyState
          title="No trend data available"
          message="Trends will appear here once session data has been collected. Import Claude Code JSONL data or connect the log watcher to begin."
        />
      ) : (
        <>
          {orderedWidgets.map(w => {
            if (w.error) {
              return (
                <WidgetPlaceholder key={w.id} title={w.title}>
                  <ErrorState what={w.title.toLowerCase()} error={w.error} onRetry={w.refetch} compact />
                </WidgetPlaceholder>
              );
            }
            if (w.loading && !w.hasData) {
              return (
                <WidgetPlaceholder key={w.id} title={w.title}>
                  <Loading compact />
                </WidgetPlaceholder>
              );
            }
            if (!w.hasData) {
              return (
                <WidgetPlaceholder key={w.id} title={w.title}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: '"Poppins", sans-serif', padding: '8px 0' }}>
                    No data in this range yet
                  </div>
                </WidgetPlaceholder>
              );
            }
            return <React.Fragment key={w.id}>{w.node}</React.Fragment>;
          })}
        </>
      )}
    </div>
  );
}
