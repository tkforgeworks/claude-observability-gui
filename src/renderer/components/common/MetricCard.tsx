/**
 * Reusable metric card component.
 * Shows a headline number, a label, and an optional secondary contextual stat.
 * @see §1 "Metric Cards — Detail" in 04-wireframes.md
 */

import React from 'react';

interface MetricCardProps {
  /** Main headline value — e.g. "5", "$6.42", "~3h 20m", or "—" for no data */
  value: string;
  /** Label below the headline — e.g. "Sessions Today" */
  label: string;
  /** Secondary contextual stat below the label — e.g. "3 cowork · 2 code" */
  secondaryStat?: string;
}

const cardStyles: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#0f0f23',
  border: '1px solid #2a2a4a',
  borderRadius: 8,
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 140,
};

const valueStyles: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: '-0.5px',
};

const dividerStyles: React.CSSProperties = {
  height: 1,
  backgroundColor: '#2a2a4a',
  margin: '2px 0',
};

const labelStyles: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#8888aa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const secondaryStyles: React.CSSProperties = {
  fontSize: 12,
  color: '#666688',
};

export default function MetricCard({
  value,
  label,
  secondaryStat,
}: MetricCardProps): React.JSX.Element {
  return (
    <div style={cardStyles}>
      <div style={valueStyles}>{value}</div>
      <div style={dividerStyles} />
      <div style={labelStyles}>{label}</div>
      {secondaryStat && <div style={secondaryStyles}>{secondaryStat}</div>}
    </div>
  );
}
