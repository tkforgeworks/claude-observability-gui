import React from 'react';
import Sparkline, { hasSparkData } from './Sparkline';
import type { SparkValue } from './Sparkline';
import { DeltaChip } from './Chip';
import type { IconComponent } from './Icons';

type StatVariant = 'default' | 'minimal';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  meta?: string;
  subMeta?: string;
  icon?: IconComponent;
  /** `null` entries are gaps (unknown), not zeros — see Sparkline */
  sparkData?: SparkValue[];
  sparkColor?: string;
  /** Pin the sparkline's y-scale bottom (e.g. 0); default is min-max normalised. */
  sparkBaseline?: number;
  variant?: StatVariant;
}

export default function StatCard({
  label,
  value,
  unit,
  delta,
  meta,
  subMeta,
  icon: Icon,
  sparkData,
  sparkColor,
  sparkBaseline,
  variant = 'default',
}: StatCardProps): React.JSX.Element {
  // `.minimal` hides the sparkline entirely, so only a non-minimal card with
  // enough known points reserves the bottom padding for one (CGUI-71).
  const hasSpark = variant !== 'minimal' && hasSparkData(sparkData);
  const className = [
    'stat',
    variant !== 'default' ? variant : null,
    hasSpark ? 'has-spark' : null,
  ].filter(Boolean).join(' ');
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
      {variant !== 'minimal' && subMeta && (
        <div className="meta" style={{ marginTop: 2 }}>
          <span>{subMeta}</span>
        </div>
      )}
      {hasSpark && sparkData && (
        <Sparkline values={sparkData} color={sparkColor} baseline={sparkBaseline} />
      )}
    </div>
  );
}
