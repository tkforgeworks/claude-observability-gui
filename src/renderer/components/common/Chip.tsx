import React from 'react';
import { Icons } from './Icons';

type ChipVariant = 'default' | 'ok' | 'warn' | 'info' | 'muted';

interface ChipProps {
  variant?: ChipVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Chip({ variant = 'default', children, style }: ChipProps): React.JSX.Element {
  const className = 'chip' + (variant !== 'default' ? ` ${variant}` : '');
  return <span className={className} style={style}>{children}</span>;
}

type DeltaDirection = 'up' | 'down' | 'flat';

interface DeltaChipProps {
  value: number;
}

export function DeltaChip({ value }: DeltaChipProps): React.JSX.Element {
  const dir: DeltaDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const Arrow = dir === 'up' ? Icons.arrowUp : dir === 'down' ? Icons.arrowDown : null;
  return (
    <span className={`delta ${dir}`}>
      {Arrow && <Arrow style={{ width: 10, height: 10 }} />}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}
