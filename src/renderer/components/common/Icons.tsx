import React from 'react';

export type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

function icon(path: React.ReactNode): IconComponent {
  // aria-hidden by default: every icon in the app is decorative (paired with
  // text); overridable via props spread for any future standalone use (CGUI-68)
  const Component: IconComponent = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {path}
    </svg>
  );
  Component.displayName = 'Icon';
  return Component;
}

export const Icons = {
  today:    icon(<><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></>),
  code:     icon(<><path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M14 4l-4 16"/></>),
  trends:   icon(<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>),
  heatmap:  icon(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>),
  chat:     icon(<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>),
  cowork:   icon(<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 18c0-2.5 1.8-4 4-4"/></>),
  projects: icon(<><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h7v7h-7"/></>),
  settings: icon(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  search:   icon(<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>),
  filter:   icon(<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>),
  download: icon(<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>),
  sparkle:  icon(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2"/></>),
  bolt:     icon(<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>),
  arrowUp:  icon(<><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></>),
  arrowDown:icon(<><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></>),
  dot:      icon(<circle cx="12" cy="12" r="4"/>),
  clock:    icon(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  dollar:   icon(<><path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>),
  hash:     icon(<><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></>),
  layers:   icon(<><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></>),
  user:     icon(<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>),
  flame:    icon(<path d="M12 2s5 5 5 10a5 5 0 01-10 0c0-2 1-3 1-5 2 1 3 3 4 5 0-3-1-7 0-10z"/>),
  refresh:  icon(<><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></>),
  gauge:    icon(<><path d="M12 15a1 1 0 100-2 1 1 0 000 2z"/><path d="M12 12V8"/><path d="M5.6 19A9 9 0 1121 12"/><path d="M3 12a9 9 0 012.6 7"/></>),
} as const;

export type IconName = keyof typeof Icons;
