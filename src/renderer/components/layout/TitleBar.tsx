import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ViewId } from '../../../shared/ipc-types';
import { useDashboardConfig } from '../../contexts/DashboardConfigContext';

const TITLE_BAR_HEIGHT = 32;

const VIEW_LABELS: Partial<Record<ViewId, string>> = {
  today: 'Today',
  cowork: 'Cowork',
  code: 'Code',
  chat: 'Chat',
  trends: 'Trends',
  heatmap: 'Heatmap',
  usage: 'Usage',
};

interface MenuItem {
  label: string;
  action: () => void;
  separator?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

// ---------------------------------------------------------------------------
// Window control SVG icons (10×10 viewBox, Windows 11 style)
// ---------------------------------------------------------------------------

function MinimizeIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaximizeIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function RestoreIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <rect x="2.5" y="0.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="var(--background)" />
    </svg>
  );
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
      <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Dropdown menu component
// ---------------------------------------------------------------------------

function DropdownMenu({
  menu,
  isOpen,
  onToggle,
  onClose,
  menuBarHover,
}: {
  menu: MenuDef;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  menuBarHover: boolean;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Escape closes and returns focus; arrows move through the items (CGUI-68)
  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      buttonRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = popupRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!items?.length) return;
      const focused = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = (focused + delta + items.length) % items.length;
      items[next].focus();
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as React.CSSProperties} onKeyDown={handleMenuKeyDown}>
      <button
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
        onMouseEnter={(e) => {
          // Only hand off when hovering a DIFFERENT menu's label — re-entering
          // the open menu's own button must not toggle it closed (CGUI-68)
          if (menuBarHover && !isOpen) onToggle();
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border-soft)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
        style={{
          background: isOpen ? 'var(--border-soft)' : 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 12,
          padding: '0 8px',
          height: TITLE_BAR_HEIGHT,
          cursor: 'default',
        }}
      >
        {menu.label}
      </button>
      {isOpen && (
        <div
          ref={popupRef}
          role="menu"
          aria-label={menu.label}
          style={{
            position: 'absolute',
            top: TITLE_BAR_HEIGHT,
            left: 0,
            minWidth: 180,
            backgroundColor: 'var(--background-light)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 9999,
            padding: '4px 0',
          }}
        >
          {menu.items.map((item, i) => (
            <React.Fragment key={i}>
              {item.separator && (
                <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }} />
              )}
              <button
                role="menuitem"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(-1)}
                style={{
                  display: 'block',
                  width: '100%',
                  background: hoveredIndex === i ? 'var(--border)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  padding: '6px 24px',
                  textAlign: 'left',
                  cursor: 'default',
                }}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Window control button
// ---------------------------------------------------------------------------

function WindowButton({
  onClick,
  hoverBg,
  hoverColor,
  children,
  label,
}: {
  onClick: () => void;
  hoverBg?: string;
  hoverColor?: string;
  children: React.ReactNode;
  label: string;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        WebkitAppRegion: 'no-drag',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 46,
        height: TITLE_BAR_HEIGHT,
        background: hovered ? (hoverBg ?? 'var(--border)') : 'transparent',
        color: hovered && hoverColor ? hoverColor : 'var(--text-secondary)',
        border: 'none',
        cursor: 'default',
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TitleBar
// ---------------------------------------------------------------------------

export default function TitleBar(): React.JSX.Element {
  const navigate = useNavigate();
  const { config } = useDashboardConfig();
  const [isMaximized, setIsMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    window.api.windowControls.isMaximized().then(setIsMaximized);
    return window.api.onMaximizeChange(setIsMaximized);
  }, []);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  const visibleViews = config
    ? config.views.filter(v => v.visible && v.id !== 'settings').map(v => v.id)
    : (['today', 'cowork', 'code', 'chat', 'trends', 'heatmap'] as ViewId[]);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'Settings', action: () => navigate('/settings') },
        { label: 'Close Window', action: () => window.api.windowControls.close(), separator: true },
        { label: 'Quit', action: () => window.api.windowControls.quit() },
      ],
    },
    {
      label: 'View',
      items: visibleViews.map(id => ({
        label: VIEW_LABELS[id] ?? id,
        action: () => navigate(`/${id}`),
      })),
    },
  ];

  const menuBarHasOpen = openMenu !== null;

  return (
    <div
      style={{
        WebkitAppRegion: 'drag',
        display: 'flex',
        alignItems: 'center',
        height: TITLE_BAR_HEIGHT,
        minHeight: TITLE_BAR_HEIGHT,
        backgroundColor: 'var(--background)',
        borderBottom: '1px solid var(--border-soft)',
        userSelect: 'none',
        fontSize: 12,
      } as React.CSSProperties}
    >
      {/* App icon + menus */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span
          aria-hidden="true"
          style={{
            padding: '0 10px',
            fontSize: 14,
            color: 'var(--text-tertiary)',
          }}
        >
          ◈
        </span>
        {menus.map(menu => (
          <DropdownMenu
            key={menu.label}
            menu={menu}
            isOpen={openMenu === menu.label}
            onToggle={() =>
              setOpenMenu(prev => (prev === menu.label ? null : menu.label))
            }
            onClose={closeMenu}
            menuBarHover={menuBarHasOpen}
          />
        ))}
      </div>

      {/* Centered title — fills remaining space */}
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 12,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        Claude Usage Monitor
      </div>

      {/* Window controls */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <WindowButton onClick={() => window.api.windowControls.minimize()} label="Minimize">
          <MinimizeIcon />
        </WindowButton>
        <WindowButton onClick={() => window.api.windowControls.maximize()} label={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </WindowButton>
        <WindowButton
          onClick={() => window.api.windowControls.close()}
          hoverBg="#e81123"
          hoverColor="#ffffff"
          label="Close"
        >
          <CloseIcon />
        </WindowButton>
      </div>
    </div>
  );
}
