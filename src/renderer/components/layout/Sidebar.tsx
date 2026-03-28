/**
 * Fixed left sidebar with navigation items.
 * Settings is pinned to the bottom.
 * @see §Application Shell wireframe in 04-wireframes.md
 */

import React from 'react';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/today',  label: 'Today',   icon: '◉' },
  { to: '/cowork', label: 'Cowork',  icon: '⟳' },
  { to: '/code',   label: 'Code',    icon: '<>' },
  { to: '/chat',   label: 'Chat',    icon: '💬' },
  { to: '/trends', label: 'Trends',  icon: '⤴' },
  { to: '/heatmap',label: 'Heatmap', icon: '▦' },
];

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
  return (
    <nav style={sidebarStyles} aria-label="Main navigation">
      <div style={navStyles}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => navLinkStyle(isActive)}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
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
