import type { TrendsWidgetId } from '../../shared/ipc-types';

// Widgets fed exclusively by Cowork tables (cowork_sessions/cowork_turns).
// Session Density and Usage Patterns blend code+cowork via UNION, so with no
// cowork rows they render from the code side alone and stay visible (CGUI-84).
// Shared between TrendsView (render-time filter) and the Settings Dashboard
// tab (disabled toggle rows) so the two surfaces can't drift.
export const COWORK_ONLY_WIDGETS: ReadonlySet<TrendsWidgetId> = new Set(['turnDurationTrend']);
