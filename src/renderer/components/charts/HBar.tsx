import React from 'react';

interface HBarItem {
  label: string;
  value: number;
  formattedValue?: string;
}

interface HBarProps {
  items: HBarItem[];
  color?: string;
  altColor?: string;
  maxItems?: number;
}

export default function HBar({
  items,
  color = 'var(--chart-1)',
  altColor = 'var(--chart-2)',
  maxItems = 8,
}: HBarProps): React.JSX.Element | null {
  if (items.length === 0) return null;
  const visible = items.slice(0, maxItems);
  const max = Math.max(...visible.map(i => i.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {visible.map((item, i) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 180,
              flexShrink: 0,
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item.label}
          >
            {item.label}
          </div>
          <div style={{ flex: 1, height: 18, backgroundColor: 'var(--background-light)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                backgroundColor: i % 2 === 0 ? color : altColor,
                borderRadius: 3,
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <div
            style={{
              width: 70,
              flexShrink: 0,
              textAlign: 'right',
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {item.formattedValue ?? String(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
