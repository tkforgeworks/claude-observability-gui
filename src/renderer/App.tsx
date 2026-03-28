/**
 * Main application shell.
 * Fixed left sidebar + right content area layout.
 * @see §Application Shell wireframe in 04-wireframes.md
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import ContentArea from './components/layout/ContentArea';
import TodayView from './views/TodayView';
import CoworkSessionsView from './views/CoworkSessionsView';
import CodeSessionsView from './views/CodeSessionsView';
import ChatHistoryView from './views/ChatHistoryView';
import TrendsView from './views/TrendsView';
import HeatmapView from './views/HeatmapView';
import SettingsView from './views/SettingsView';

const appStyles: React.CSSProperties = {
  display: 'flex',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  backgroundColor: '#1a1a2e',
  color: '#e0e0e0',
};

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div style={appStyles}>
        <Sidebar />
        <ContentArea>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayView />} />
            <Route path="/cowork" element={<CoworkSessionsView />} />
            <Route path="/code" element={<CodeSessionsView />} />
            <Route path="/chat" element={<ChatHistoryView />} />
            <Route path="/trends" element={<TrendsView />} />
            <Route path="/heatmap" element={<HeatmapView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </ContentArea>
      </div>
    </HashRouter>
  );
}
