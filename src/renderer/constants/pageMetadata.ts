import type { ViewId } from '../../shared/ipc-types';

export interface PageMeta {
  title: string;
  subtitle: string | (() => string);
  ranges: string[] | null;
  defaultRange?: string;
}

function todaySubtitle(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  return `${weekday} · ${date} · LAST 24 HOURS`;
}

export const PAGE_META: Record<string, PageMeta> = {
  today:    { title: 'Today',            subtitle: todaySubtitle,                          ranges: null },
  trends:   { title: 'Trends',           subtitle: 'ROLLING 30-DAY WINDOW',               ranges: ['7d', '30d', '90d', '1y'],             defaultRange: '30d' },
  cowork:   { title: 'Cowork sessions',  subtitle: 'INTERACTIVE PAIR SESSIONS',            ranges: ['7d', '30d', '90d', 'All'],            defaultRange: '30d' },
  chat:     { title: 'Chat history',     subtitle: 'CLAUDE.AI CONVERSATIONS',              ranges: ['Monthly', 'Weekly'],                  defaultRange: 'Monthly' },
  code:     { title: 'Claude Code',      subtitle: 'AGENTIC CODING SESSIONS',              ranges: ['7d', '30d', '90d', 'All'],            defaultRange: '30d' },
  projects: { title: 'Projects',          subtitle: 'AGGREGATE PROJECT METRICS',             ranges: ['7d', '30d', '90d', '1y', 'All'],     defaultRange: '90d' },
  heatmap:  { title: 'Usage heatmap',    subtitle: 'CALENDAR-LEVEL ACTIVITY',              ranges: ['3 months', '6 months', '12 months'],  defaultRange: '12 months' },
  settings: { title: 'Settings',         subtitle: 'APPLICATION CONFIGURATION',             ranges: null },
};

export function getPageMeta(routeKey: string): PageMeta | null {
  return PAGE_META[routeKey] ?? null;
}

export function resolveSubtitle(meta: PageMeta): string {
  return typeof meta.subtitle === 'function' ? meta.subtitle() : meta.subtitle;
}
