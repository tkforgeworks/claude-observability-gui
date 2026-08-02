import React from 'react';
import { Icons } from './Icons';

interface EmptyStateProps {
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  title,
  message,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty">
      <div className="glyph">
        <Icons.sparkle style={{ width: 18, height: 18 }} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--purple-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--purple-primary)'; }}
          style={{
            marginTop: 16,
            padding: '8px 20px',
            backgroundColor: 'var(--purple-primary)',
            // White on purple-primary ≈ 4.7:1; --text-primary was ~3.2:1 (CGUI-68)
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontFamily: 'var(--font-header)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 200ms ease',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
