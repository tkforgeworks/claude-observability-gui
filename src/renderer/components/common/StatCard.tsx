import React from 'react';
import Sparkline from './Sparkline';
import { DeltaChip } from './Chip';
import type { IconComponent } from './Icons';

type StatVariant = 'default' | 'minimal' | 'sparky';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  meta?: string;
  icon?: IconComponent;
  sparkData?: number[];
  sparkColor?: string;
  variant?: StatVariant;
}

export default function StatCard({
  label,
  value,
  unit,
  delta,
  meta,
  icon: Icon,
  sparkData,
  sparkColor,
  variant = 'default',
}: StatCardProps): React.JSX.Element {
  const className = 'stat' + (variant !== 'default' ? ` ${variant}` : '');
  return (
    <div className={className}>
      <div className="label">
        {Icon && <Icon />}
        {label}
      </div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {variant !== 'minimal' && (
        <div className="meta">
          {delta !== undefined && <DeltaChip value={delta} />}
          {meta && <span>{meta}</span>}
        </div>
      )}
      {sparkData && sparkData.length >= 2 && (
        <Sparkline values={sparkData} color={sparkColor} />
      )}
    </div>
  );
}
