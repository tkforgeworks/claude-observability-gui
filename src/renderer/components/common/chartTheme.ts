/**
 * Shared chart styling (CGUI-67): one tooltip/axis/cursor treatment for every
 * Recharts widget so the Trends page reads as a single design generation.
 */

import type React from 'react';

/** Recharts tick style for axes */
export const chartAxisTick = { fill: 'var(--text-tertiary)', fontSize: 11 };

/** Grid/axis-line stroke */
export const chartGridStroke = 'var(--border-soft)';

/** Hover cursor tint — rgba of --purple-primary (#a855f7) */
export const chartCursorFill = 'rgba(168, 85, 247, 0.08)';

/** Container style for custom tooltip content components */
export const chartTooltipStyles: React.CSSProperties = {
  backgroundColor: 'var(--background-light)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 12,
  fontFamily: '"JetBrains Mono", monospace',
  lineHeight: 1.6,
};

/**
 * Series palette for charts needing more than the 6 chart tokens — the token
 * series first, then two derived fallbacks for 7th/8th series.
 */
export const chartSeriesColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--purple-dark)',
  'var(--info)',
];
