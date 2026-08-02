import React from 'react';
import { formatHour } from '../../utils/format';

const formatHourCompact = (h: number) => formatHour(h, { style: 'compact' });

interface HourStripProps {
  data: number[];
  color?: string;
  height?: number;
}

export default function HourStrip({
  data,
  color = 'var(--chart-1)',
  height = 32,
}: HourStripProps): React.JSX.Element | null {
  if (!data || data.length !== 24) return null;
  const max = Math.max(...data, 1);

  return (
    <div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height }}>
        {data.map((v, i) => (
          <div
            key={i}
            title={`${formatHourCompact(i)}: ${v} sessions`}
            style={{
              flex: 1,
              height: `${Math.max((v / max) * 100, v > 0 ? 8 : 3)}%`,
              backgroundColor: color,
              opacity: v > 0 ? 0.3 + 0.7 * (v / max) : 0.1,
              borderRadius: 2,
              transition: 'height 200ms ease',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {data.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              fontSize: 8,
              fontFamily: '"JetBrains Mono", monospace',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}
          >
            {i % 3 === 0 ? formatHourCompact(i) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
