import React from 'react';

interface SortableThProps {
  label: string;
  /** Whether this column is the active sort key */
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: () => void;
  /** Pass "num" for right-aligned numeric columns (matches table.data) */
  className?: string;
}

/**
 * Keyboard-operable sortable table header (CGUI-68): a real button inside the
 * th (focusable, Enter/Space) with aria-sort on the th. Replaces the
 * mouse-only `<th onClick>` pattern.
 */
export default function SortableTh({ label, active, dir, onSort, className }: SortableThProps): React.JSX.Element {
  const numeric = className?.includes('num');
  return (
    <th
      className={className}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        onClick={onSort}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          width: '100%',
          justifyContent: numeric ? 'flex-end' : 'flex-start',
        }}
      >
        {label}
        {active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
}
