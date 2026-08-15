import React, { useId } from 'react';

/** A sparkline value; `null` is a gap (unknown), not a zero. */
export type SparkValue = number | null;

/** True when there is enough known data to draw a line (two or more points). */
export function hasSparkData(values: SparkValue[] | undefined): values is SparkValue[] {
  if (!values) return false;
  let n = 0;
  for (const v of values) if (v !== null) n++;
  return n >= 2;
}

/**
 * Splits values into runs of consecutive known points. Each run becomes its
 * own subpath so a `null` renders as a break in the line rather than a
 * straight segment across data that was never captured (CGUI-72). x is
 * positioned by index across the full length — gaps keep their width.
 */
function sparkSegments(values: SparkValue[]): Array<Array<{ i: number; v: number }>> {
  const segments: Array<Array<{ i: number; v: number }>> = [];
  let current: Array<{ i: number; v: number }> = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ i, v });
    }
  });
  if (current.length) segments.push(current);
  return segments;
}

interface SparkGeometry {
  /** stroke path — one `M…L…` subpath per contiguous run */
  line: string;
  /** filled area under each run, closed to the baseline */
  area: string;
  /** isolated single points, drawn as dots so they aren't invisible */
  dots: Array<{ x: number; y: number }>;
}

function buildSparkGeometry(values: SparkValue[], w: number, h: number, pad = 2, baseline?: number): SparkGeometry {
  const known = values.filter((v): v is number => v !== null);
  // Default is min-max normalised (shape only). A `baseline` pins the bottom of
  // the y-scale so the line's height carries meaning — 0 for a percentage that
  // grows from nothing, so 3% reads as low and 80% as high (CGUI-72).
  const min = baseline !== undefined ? Math.min(baseline, ...known) : Math.min(...known);
  const max = Math.max(...known);
  const range = max - min || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const x = (i: number): number => pad + i * stepX;
  const y = (v: number): number => h - pad - ((v - min) / range) * (h - pad * 2);

  const lines: string[] = [];
  const areas: string[] = [];
  const dots: Array<{ x: number; y: number }> = [];
  for (const seg of sparkSegments(values)) {
    if (seg.length === 1) {
      dots.push({ x: x(seg[0].i), y: y(seg[0].v) });
      continue;
    }
    const d = seg.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    lines.push(d);
    const first = seg[0];
    const last = seg[seg.length - 1];
    areas.push(`${d} L${x(last.i).toFixed(1)},${h} L${x(first.i).toFixed(1)},${h} Z`);
  }
  return { line: lines.join(' '), area: areas.join(' '), dots };
}

/** Kept for callers that only need the stroke path (all-known values). */
function buildSparkPath(values: number[], w: number, h: number, pad = 2): string {
  return buildSparkGeometry(values, w, h, pad).line;
}

interface SparklineProps {
  values: SparkValue[];
  color?: string;
  width?: number;
  height?: number;
  filled?: boolean;
  /** Pin the bottom of the y-scale (e.g. 0) instead of the series minimum. */
  baseline?: number;
}

export default function Sparkline({
  values,
  color = 'var(--purple-primary)',
  width = 240,
  height = 36,
  filled = true,
  baseline,
}: SparklineProps): React.JSX.Element | null {
  // Hooks must run unconditionally — calling useId after the early return
  // throws "Rendered more hooks" when values crosses the threshold (CGUI-68)
  const gradientId = useId();
  if (!hasSparkData(values)) return null;
  const { line, area, dots } = buildSparkGeometry(values, width, height, 2, baseline);
  return (
    <svg className="stat-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && area && <path d={area} fill={`url(#${gradientId})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="1.4" />}
      {dots.map((d, k) => (
        <circle key={k} cx={d.x} cy={d.y} r="1.6" fill={color} />
      ))}
    </svg>
  );
}

export { buildSparkPath, buildSparkGeometry };
