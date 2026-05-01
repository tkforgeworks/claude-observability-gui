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
  action?: BannerAction;
  actions?: BannerAction[];
  onDismiss?: () => void;
}

const VARIANT_STYLES: Record<BannerVariant, React.CSSProperties> = {
  info: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    color: 'var(--info)',
  },
  warning: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    color: 'var(--warning)',
  },
  error: {
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
    color: 'var(--error)',
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
  fontSize: 13,
  fontFamily: '"Poppins", sans-serif',
  lineHeight: 1.5,
};

const actionButtonStyles: React.CSSProperties = {
  flexShrink: 0,
  padding: '4px 12px',
  backgroundColor: 'transparent',
  border: '1px solid currentColor',
  borderRadius: 4,
  color: 'inherit',
  fontSize: 12,
  fontFamily: '"Poppins", sans-serif',
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
      <span style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
        {VARIANT_ICONS[variant]}
      </span>
      <span style={{ flex: 1 }}>{message}</span>
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
