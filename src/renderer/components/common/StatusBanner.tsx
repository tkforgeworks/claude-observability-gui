/**
 * Reusable warning/status banner component.
 * Shown at the top of the content area when conditions are met (log path missing,
 * stale import, sync offline, etc.).
 * @see §10 "Warning / Status Banners" in 04-wireframes.md
 */

import React from 'react';

type BannerVariant = 'info' | 'warning' | 'error';

export interface BannerAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface StatusBannerProps {
  variant: BannerVariant;
  message: string;
  /** Single call-to-action button displayed on the right */
  action?: BannerAction;
  /** Multiple call-to-action buttons, rendered left-to-right before the dismiss button */
  actions?: BannerAction[];
  /** Optional dismiss handler — renders an X button */
  onDismiss?: () => void;
}

const VARIANT_STYLES: Record<BannerVariant, React.CSSProperties> = {
  info: {
    backgroundColor: '#1a2a4a',
    borderColor: '#3355aa',
    color: '#aabbdd',
  },
  warning: {
    backgroundColor: '#2a2010',
    borderColor: '#aa8833',
    color: '#ddcc88',
  },
  error: {
    backgroundColor: '#2a1010',
    borderColor: '#aa3333',
    color: '#ddaaaa',
  },
};

const VARIANT_ICONS: Record<BannerVariant, string> = {
  info: 'ⓘ',
  warning: '⚠',
  error: '✕',
};

const bannerBaseStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '12px 16px',
  borderWidth: 1,
  borderStyle: 'solid',
  borderRadius: 6,
  margin: '12px 16px 0',
  fontSize: 13,
  lineHeight: 1.5,
};

const iconStyles: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 1,
};

const textStyles: React.CSSProperties = {
  flex: 1,
};

const actionButtonStyles: React.CSSProperties = {
  flexShrink: 0,
  padding: '4px 12px',
  backgroundColor: 'transparent',
  border: '1px solid currentColor',
  borderRadius: 4,
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  alignSelf: 'center',
};

const dismissButtonStyles: React.CSSProperties = {
  flexShrink: 0,
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 14,
  padding: 2,
  opacity: 0.7,
  alignSelf: 'flex-start',
};

export default function StatusBanner({
  variant,
  message,
  action,
  actions,
  onDismiss,
}: StatusBannerProps): React.JSX.Element {
  const combinedStyles: React.CSSProperties = {
    ...bannerBaseStyles,
    ...VARIANT_STYLES[variant],
  };

  const allActions: BannerAction[] = actions ?? (action ? [action] : []);

  return (
    <div style={combinedStyles} role="alert">
      <span style={iconStyles} aria-hidden="true">
        {VARIANT_ICONS[variant]}
      </span>
      <span style={textStyles}>{message}</span>
      {allActions.map((a) => (
        <button
          key={a.label}
          style={{ ...actionButtonStyles, opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? 'default' : 'pointer' }}
          onClick={a.onClick}
          disabled={a.disabled}
        >
          {a.label}
        </button>
      ))}
      {onDismiss && (
        <button
          style={dismissButtonStyles}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
