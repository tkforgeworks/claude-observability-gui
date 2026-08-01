import React from 'react';

interface RangeTabsProps {
  ranges: string[];
  active: string;
  onChange: (range: string) => void;
}

export default function RangeTabs({ ranges, active, onChange }: RangeTabsProps): React.JSX.Element {
  return (
    <div className="range-tabs">
      {ranges.map(r => (
        <button
          key={r}
          className={'range-tab' + (active === r ? ' active' : '')}
          aria-pressed={active === r}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
