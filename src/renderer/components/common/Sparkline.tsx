import React, { useId } from 'react';

function buildSparkPath(values: number[], w: number, h: number, pad = 2): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  filled?: boolean;
}

export default function Sparkline({
  values,
  color = 'var(--purple-primary)',
  width = 240,
  height = 36,
  filled = true,
}: SparklineProps): React.JSX.Element | null {
  // Hooks must run unconditionally — calling useId after the early return
  // throws "Rendered more hooks" when values crosses the threshold (CGUI-68)
  const gradientId = useId();
  if (values.length < 2) return null;
  const path = buildSparkPath(values, width, height, 2);
  const area = path + ` L${width - 2},${height} L2,${height} Z`;
  return (
    <svg className="stat-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && <path d={area} fill={`url(#${gradientId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

export { buildSparkPath };
