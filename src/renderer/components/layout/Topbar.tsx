import React from 'react';
import { useLocation } from 'react-router-dom';
import { getPageMeta, resolveSubtitle } from '../../constants/pageMetadata';
import RangeTabs from '../common/RangeTabs';

interface TopbarProps {
  activeRange?: string;
  onRangeChange?: (range: string) => void;
}

export default function Topbar({ activeRange, onRangeChange }: TopbarProps): React.JSX.Element | null {
  const location = useLocation();
  const routeKey = location.pathname.replace('/', '') || 'today';
  const meta = getPageMeta(routeKey);

  if (!meta) return null;

  const subtitle = resolveSubtitle(meta);

  return (
    <div className="topbar">
      <div className="topbar-title">
        <h1>{meta.title}</h1>
        <span className="sub">{subtitle}</span>
      </div>
      <div className="topbar-right">
        {meta.ranges && activeRange && onRangeChange && (
          <RangeTabs ranges={meta.ranges} active={activeRange} onChange={onRangeChange} />
        )}
      </div>
    </div>
  );
}
