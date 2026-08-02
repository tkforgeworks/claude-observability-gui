import React, { useState } from 'react';

interface DonutSlice {
  label: string;
  value: number;
  formattedValue?: string;
}

interface DonutProps {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-3)',
  'var(--chart-2)',
  'var(--chart-6)',
];

export default function Donut({
  slices,
  centerLabel,
  centerValue,
  size = 140,
}: DonutProps): React.JSX.Element | null {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (slices.length === 0) return null;

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const r = size / 2;
  const strokeWidth = 20;
  const innerR = r - strokeWidth;
  const circumference = 2 * Math.PI * innerR;

  let cumOffset = 0;
  const arcs = slices.map((sl, i) => {
    const pct = sl.value / total;
    const dashLen = pct * circumference;
    const dashGap = circumference - dashLen;
    const offset = cumOffset;
    cumOffset += dashLen;
    return { ...sl, pct, dashLen, dashGap, offset, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  const displayLabel = activeIndex !== null ? arcs[activeIndex].label : centerLabel;
  const displayValue = activeIndex !== null
    ? (arcs[activeIndex].formattedValue ?? `${Math.round(arcs[activeIndex].pct * 100)}%`)
    : (centerValue ?? String(total));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {arcs.map((arc, i) => (
          <circle
            key={arc.label}
            cx={r}
            cy={r}
            r={innerR}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dashLen} ${arc.dashGap}`}
            strokeDashoffset={-arc.offset}
            opacity={activeIndex !== null && activeIndex !== i ? 0.3 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 200ms ease' }}
            transform={`rotate(-90 ${r} ${r})`}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          />
        ))}
        <text
          x={r}
          y={r - 6}
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize={18}
          fontWeight={500}
          fontFamily='"JetBrains Mono", monospace'
        >
          {displayValue}
        </text>
        {displayLabel && (
          <text
            x={r}
            y={r + 12}
            textAnchor="middle"
            fill="var(--text-tertiary)"
            fontSize={10}
            fontFamily="Poppins"
          >
            {displayLabel}
          </text>
        )}
      </svg>
      {/* minWidth: 0 + ellipsis — long model names would otherwise set the
          legend's min-content width and push the donut out of its column
          in a narrow layout (CGUI-69). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: 1 }}>
        {arcs.map((arc, i) => (
          <div
            key={arc.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              cursor: 'pointer',
              opacity: activeIndex !== null && activeIndex !== i ? 0.4 : 1,
              transition: 'opacity 200ms ease',
              minWidth: 0,
            }}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: arc.color, flexShrink: 0 }} />
            <span
              title={arc.label}
              style={{
                color: 'var(--text-primary)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {arc.label}
            </span>
            <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>{Math.round(arc.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
