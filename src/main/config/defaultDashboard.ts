import { DashboardConfig } from '../../shared/ipc-types';

/**
 * Default DashboardConfig written on first run when dashboard.json does not exist.
 * All views and trend widgets are visible by default.
 * Today is the default landing view.
 */
export const DEFAULT_DASHBOARD: DashboardConfig = {
  views: [
    {
      id: 'today',
      visible: true,
      defaultLanding: true,
    },
    {
      id: 'cowork',
      visible: true,
      defaultLanding: false,
      defaultSortColumn: 'started_at',
      defaultSortDirection: 'desc',
    },
    {
      id: 'code',
      visible: true,
      defaultLanding: false,
      defaultTimeRange: '7d',
      defaultSortColumn: 'started_at',
      defaultSortDirection: 'desc',
    },
    {
      id: 'chat',
      visible: true,
      defaultLanding: false,
      defaultTimeRange: 'week',
    },
    {
      id: 'heatmap',
      visible: true,
      defaultLanding: false,
      defaultTimeRange: '12mo',
    },
    {
      id: 'trends',
      visible: true,
      defaultLanding: false,
      defaultTimeRange: '30d',
    },
  ],
  trendsWidgets: [
    { id: 'cacheEfficiency',          visible: true, order: 0, defaultTimeRange: '30d' },
    { id: 'turnDurationTrend',        visible: true, order: 1, defaultTimeRange: '30d', defaultGranularity: 'daily' },
    { id: 'costVelocity',             visible: true, order: 2, defaultTimeRange: '30d' },
    { id: 'sessionDensity',           visible: true, order: 3, defaultTimeRange: '30d' },
    { id: 'modelMigration',           visible: true, order: 4, defaultTimeRange: '90d' },
    { id: 'projectActivityTimeline',  visible: true, order: 5, defaultTimeRange: '30d' },
    { id: 'usagePatternsSummary',     visible: true, order: 6, defaultTimeRange: '30d' },
  ],
};
