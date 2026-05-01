import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import type { ViewId } from '../../../shared/ipc-types';
import { useDashboardConfig } from '../../contexts/DashboardConfigContext';
import { Icons } from '../common/Icons';

interface NavItem {
  id: ViewId;
  label: string;
  icon: keyof typeof Icons;
}

interface NavSection {
  name: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    name: 'Live',
    items: [
      { id: 'today', label: 'Today', icon: 'today' },
      { id: 'cowork', label: 'Cowork', icon: 'cowork' },
    ],
  },
  {
    name: 'Analytics',
    items: [
      { id: 'trends', label: 'Trends', icon: 'trends' },
      { id: 'heatmap', label: 'Heatmap', icon: 'heatmap' },
    ],
  },
  {
    name: 'History',
    items: [
      { id: 'code', label: 'Code', icon: 'code' },
      { id: 'chat', label: 'Chat', icon: 'chat' },
    ],
  },
];

const sidebarStyles: React.CSSProperties = {
  width: 180,
  minWidth: 180,
  height: '100%',
  backgroundColor: 'var(--background)',
  display: 'flex',
  flexDirection: 'column',
  padding: '18px 0 14px',
  borderRight: '1px solid var(--border-soft)',
  flexShrink: 0,
  userSelect: 'none',
};

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    textDecoration: 'none',
    color: isActive ? 'var(--purple-dark)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--purple-tint)' : 'transparent',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 200ms ease, color 200ms ease',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
  };
}

export default function Sidebar(): React.JSX.Element {
  const { config } = useDashboardConfig();
  const [watcherConnected, setWatcherConnected] = useState(false);

  useEffect(() => {
    return window.api.onLogWatcherConnection((status) => {
      setWatcherConnected(status.connected);
    });
  }, []);

  const visibleIds = new Set<ViewId>(
    config
      ? config.views.filter(v => v.visible).map(v => v.id)
      : ['today', 'cowork', 'code', 'chat', 'trends', 'heatmap']
  );

  return (
    <nav style={sidebarStyles} aria-label="Main navigation">
      {/* Brand block */}
      <div className="sidebar-brand">
        <div className="logo">TK</div>
        <div className="name">
          Claude Observe
          <span className="sub">v0.9.0 · local</span>
        </div>
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => visibleIds.has(item.id));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.name}>
              <div className="sidebar-section">{section.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px' }}>
                {visibleItems.map(item => {
                  const Icon = Icons[item.icon];
                  return (
                    <NavLink
                      key={item.id}
                      to={`/${item.id}`}
                      style={({ isActive }) => navLinkStyle(isActive)}
                    >
                      <Icon style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.85 }} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '12px 8px 0', borderTop: '1px solid var(--border-soft)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: watcherConnected ? 'var(--success)' : 'var(--text-tertiary)',
            boxShadow: watcherConnected ? undefined : 'none',
            animation: watcherConnected ? 'pulse 2s infinite' : 'none',
            flexShrink: 0,
          }} />
          <span>{watcherConnected ? 'watcher live' : 'watcher offline'}</span>
        </div>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({ ...navLinkStyle(isActive), marginTop: 4 })}
        >
          <Icons.settings style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.85 }} />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}
