/**
 * Reusable empty state component shown when a view has no data.
 * @see §11 "Empty & First-Run States" in 04-wireframes.md
 */

import React from 'react';

interface EmptyStateProps {
  title: string;
  message: string;
  /** Optional call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  textAlign: 'center',
  maxWidth: 400,
  margin: '0 auto',
};

const titleStyles: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: '#cccccc',
  marginBottom: 12,
};

const messageStyles: React.CSSProperties = {
  fontSize: 14,
  color: '#888899',
  lineHeight: 1.6,
  marginBottom: 24,
};

const buttonStyles: React.CSSProperties = {
  padding: '8px 20px',
  backgroundColor: '#4444aa',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
};

export default function EmptyState({
  title,
  message,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div style={containerStyles}>
      <h2 style={titleStyles}>{title}</h2>
      <p style={messageStyles}>{message}</p>
      {action && (
        <button style={buttonStyles} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
