/**
 * Fixed left sidebar with navigation items.
 * Settings is pinned to the bottom.
 * @see §Application Shell wireframe in 04-wireframes.md
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import type { ViewId } from '../../../shared/ipc-types';
import { useDashboardConfig } from '../../contexts/DashboardConfigContext';

const VIEW_META: Partial<Record<ViewId, { label: string; icon: string }>> = {
  today:   { label: 'Today',   icon: '◉' },
  cowork:  { label: 'Cowork',  icon: '⟳' },
  code:    { label: 'Code',    icon: '<>' },
  chat:    { label: 'Chat',    icon: '💬' },
  trends:  { label: 'Trends',  icon: '⤴' },
  heatmap: { label: 'Heatmap', icon: '▦' },
};

const ALL_VIEW_IDS: ViewId[] = ['today', 'cowork', 'code', 'chat', 'trends', 'heatmap'];

const sidebarStyles: React.CSSProperties = {
  width: 160,
  minWidth: 160,
  height: '100%',
  backgroundColor: '#0f0f23',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '16px 0',
  borderRight: '1px solid #2a2a4a',
  flexShrink: 0,
};

const navStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    textDecoration: 'none',
    color: isActive ? '#ffffff' : '#8888aa',
    backgroundColor: isActive ? '#2a2a4a' : 'transparent',
    borderLeft: isActive ? '3px solid #6666cc' : '3px solid transparent',
    fontSize: 14,
    fontWeight: isActive ? 600 : 400,
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  };
}

export default function Sidebar(): React.JSX.Element {
  const { config } = useDashboardConfig();

  // While config loads, show all views to prevent sidebar flash
  const visibleIds: ViewId[] = config
    ? config.views.filter(v => v.visible).map(v => v.id)
    : ALL_VIEW_IDS;

  return (
    <nav style={sidebarStyles} aria-label="Main navigation">
      <div style={navStyles}>
        {visibleIds.map((id) => {
          const meta = VIEW_META[id];
          if (!meta) return null;
          return (
            <NavLink
              key={id}
              to={`/${id}`}
              style={({ isActive }) => navLinkStyle(isActive)}
            >
              <span aria-hidden="true">{meta.icon}</span>
              <span>{meta.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Settings pinned to bottom */}
      <div>
        <NavLink
          to="/settings"
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <span aria-hidden="true">⚙</span>
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}
