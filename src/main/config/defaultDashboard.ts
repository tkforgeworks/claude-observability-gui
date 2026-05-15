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
      id: 'projects',
      visible: true,
      defaultLanding: false,
      defaultTimeRange: '90d',
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
    { id: 'cacheEfficiency',          visible: true, order: 0 },
    { id: 'turnDurationTrend',        visible: true, order: 1, defaultGranularity: 'daily' },
    { id: 'costVelocity',             visible: true, order: 2 },
    { id: 'sessionDensity',           visible: true, order: 3 },
    { id: 'modelMigration',           visible: true, order: 4 },
    { id: 'projectActivityTimeline',  visible: true, order: 5 },
    { id: 'usagePatternsSummary',     visible: true, order: 6 },
  ],
};
