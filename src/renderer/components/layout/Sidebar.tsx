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
      { id: 'usage', label: 'Usage', icon: 'gauge' },
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
      { id: 'projects', label: 'Projects', icon: 'projects' },
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

// App mark (CGUI-57): same wireframe-gear geometry as assets/icon.svg, inlined
// so the sidebar mark matches the installer/taskbar/tray icon exactly.
function GearMark({ size = 20 }: { size?: number }): React.JSX.Element {
  // useId keeps the gradient unique if the mark ever renders twice (CGUI-68)
  const gradientId = React.useId();
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={24}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M105.13 57.62 L109.23 23.68 L146.77 23.68 L150.87 57.62 L177.52 73.01 L208.96 59.58 L227.73 92.09 L200.38 112.61 L200.38 143.39 L227.73 163.91 L208.96 196.42 L177.52 182.99 L150.87 198.38 L146.77 232.32 L109.23 232.32 L105.13 198.38 L78.48 182.99 L47.04 196.42 L28.27 163.91 L55.62 143.39 L55.62 112.61 L28.27 92.09 L47.04 59.58 L78.48 73.01 Z" />
        <circle cx="128" cy="128" r="34" />
      </g>
    </svg>
  );
}

export default function Sidebar(): React.JSX.Element {
  const { config } = useDashboardConfig();
  const [watcherConnected, setWatcherConnected] = useState(false);
  // "n/a" rather than "offline" on platforms without Claude Desktop (CGUI-75)
  const [watcherUnsupported, setWatcherUnsupported] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  // Seed from the current status, then track pushes. Without the initial
  // fetch the dot claimed "offline" until the next connection event, which
  // may never arrive in a healthy session (CGUI-70).
  useEffect(() => {
    let cancelled = false;
    window.api.logPath.getStatus()
      .then(status => {
        if (cancelled) return;
        setWatcherConnected(status.valid);
        setWatcherUnsupported(status.source === 'unsupported-platform');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return window.api.onLogWatcherConnection((status) => {
      setWatcherConnected(status.connected);
    });
  }, []);

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const hiddenIds = new Set<ViewId>(
    config
      ? config.views.filter(v => !v.visible).map(v => v.id)
      : []
  );
  const visibleIds = new Set<ViewId>(
    NAV_SECTIONS.flatMap(s => s.items).map(i => i.id).filter(id => !hiddenIds.has(id))
  );

  return (
    <nav style={sidebarStyles} aria-label="Main navigation">
      {/* Brand block */}
      <div className="sidebar-brand">
        <div className="logo"><GearMark size={20} /></div>
        <div className="name">
          COG
          {/* The separator belongs to the version, not the line — printing it
              unconditionally left a dangling "· local" during the async
              version fetch (CGUI-70). */}
          <span className="sub">{appVersion ? `v${appVersion} · local` : 'local'}</span>
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
            animation: watcherConnected ? 'pulse 2s infinite' : 'none',
            flexShrink: 0,
          }} />
          <span>{watcherConnected ? 'watcher live' : watcherUnsupported ? 'watcher n/a' : 'watcher offline'}</span>
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
