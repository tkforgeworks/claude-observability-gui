/**
 * Trends view — scrollable page with time range selector and widget cards.
 * @see §7 "Trends View" in 04-wireframes.md
 */

import React from 'react';
import EmptyState from '../components/common/EmptyState';
import CacheEfficiencyChart from '../components/common/CacheEfficiencyChart';
import { useApi } from '../hooks/useApi';

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

export default function TrendsView(): React.JSX.Element {
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');

  const days = TIME_RANGE_DAYS[timeRange as keyof typeof TIME_RANGE_DAYS] ?? 30;

  const { data: cacheData, loading } = useApi(
    () => window.api.analytics.getCacheEfficiency(days),
    [days]
  );

  // TODO: implement remaining 6 trend widgets per wireframe §7:
  //   7.2 Turn Duration Trend — line chart with 7-day moving average
  //   7.3 Cost Velocity — headline + daily cost bar chart
  //   7.4 Session Density — sessions per hour line chart
  //   7.5 Model Migration Tracking — stacked area chart
  //   7.6 Project Activity Timeline — Gantt-style chart
  //   7.7 Usage Patterns Summary — metric card grid + hourly distribution bar

  const hasData = cacheData && cacheData.length > 0;

  return (
    <div style={viewStyles}>
      <div style={headerRowStyles}>
        <h1 style={headerStyles}>Trends</h1>
        <div style={timeRangeSelectorStyles}>
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              style={rangeButtonStyles(timeRange === value)}
              onClick={() => setTimeRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#666688', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : hasData ? (
        <CacheEfficiencyChart data={cacheData} />
      ) : (
        <EmptyState
          title="No trend data available"
          message="Trends will appear here once session data has been collected. Import Claude Code JSONL data or connect the log watcher to begin."
        />
      )}
    </div>
  );
}
