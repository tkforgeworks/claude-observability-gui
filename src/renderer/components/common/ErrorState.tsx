import React from 'react';

interface ErrorStateProps {
  /** What failed to load, e.g. "sessions" */
  what: string;
  /** The underlying error, if available — message shown in mono detail line */
  error?: Error | null;
  /** Retry callback — renders a Retry button when provided */
  onRetry?: () => void;
  /** Compact variant for in-card/section use */
  compact?: boolean;
}

/**
 * Standard error presentation (CGUI-66) — visually distinct from EmptyState
 * so an IPC failure never masquerades as "no data yet".
 */
export default function ErrorState({ what, error, onRetry, compact }: ErrorStateProps): React.JSX.Element {
  return (
    <div
      role="alert"
      style={{
        padding: compact ? '14px 16px' : '32px 20px',
        textAlign: compact ? 'left' : 'center',
        border: '1px solid rgba(248, 113, 113, 0.3)',
        borderRadius: 8,
        backgroundColor: 'rgba(248, 113, 113, 0.06)',
      }}
    >
      <div
        style={{
          color: 'var(--error)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: '"Poppins", sans-serif',
          marginBottom: error?.message ? 6 : 0,
        }}
      >
        Couldn&apos;t load {what}
      </div>
      {error?.message && (
        <div
          style={{
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontFamily: '"JetBrains Mono", monospace',
            wordBreak: 'break-word',
            marginBottom: onRetry ? 10 : 0,
          }}
        >
          {error.message}
        </div>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '5px 16px',
            backgroundColor: 'transparent',
            border: '1px solid var(--error)',
            borderRadius: 4,
            color: 'var(--error)',
            fontSize: 12,
            fontFamily: '"Poppins", sans-serif',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
