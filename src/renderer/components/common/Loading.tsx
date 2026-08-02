import React from 'react';

interface LoadingProps {
  /** What is loading, e.g. "sessions" — renders as "Loading sessions..." */
  label?: string;
  /** Compact variant for in-card/section use (less padding, left-aligned) */
  compact?: boolean;
}

/**
 * Standard loading presentation (CGUI-66): --text-secondary for AA contrast
 * and role="status" so screen readers announce the busy state. Views should
 * use this instead of hand-rolled "Loading..." divs.
 */
export default function Loading({ label, compact }: LoadingProps): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: compact ? '12px 0' : 40,
        textAlign: compact ? 'left' : 'center',
        color: 'var(--text-secondary)',
        fontSize: 13,
        fontFamily: '"Poppins", sans-serif',
      }}
    >
      {label ? `Loading ${label}...` : 'Loading...'}
    </div>
  );
}
