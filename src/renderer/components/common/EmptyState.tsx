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
          style={{
            marginTop: 16,
            padding: '8px 20px',
            backgroundColor: 'var(--purple-primary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontFamily: '"Poppins"',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
