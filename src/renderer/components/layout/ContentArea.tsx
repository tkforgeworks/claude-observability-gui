/**
 * Right content area that renders the active view.
 * @see §Application Shell wireframe in 04-wireframes.md
 */

import React from 'react';

interface ContentAreaProps {
  children: React.ReactNode;
}

const contentAreaStyles: React.CSSProperties = {
  flex: 1,
  height: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#1a1a2e',
};

export default function ContentArea({ children }: ContentAreaProps): React.JSX.Element {
  return (
    <main style={contentAreaStyles} role="main">
      {children}
    </main>
  );
}
