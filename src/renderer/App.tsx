/**
 * Main application shell.
 * Fixed left sidebar + right content area layout.
 * @see §Application Shell wireframe in 04-wireframes.md
 */

import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import ContentArea from './components/layout/ContentArea';
import GlobalBanners from './components/common/GlobalBanners';
import TodayView from './views/TodayView';
import CoworkSessionsView from './views/CoworkSessionsView';
import CodeSessionsView from './views/CodeSessionsView';
import ChatHistoryView from './views/ChatHistoryView';
import TrendsView from './views/TrendsView';
import HeatmapView from './views/HeatmapView';
import SettingsView from './views/SettingsView';
import { DashboardConfigProvider, useDashboardConfig } from './contexts/DashboardConfigContext';

const appStyles: React.CSSProperties = {
  display: 'flex',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  backgroundColor: '#1a1a2e',
  color: '#e0e0e0',
};

/** Listens for main-process navigation commands and routes accordingly. */
function NavigationListener(): null {
  const navigate = useNavigate();
  useEffect(() => {
    return window.api.onNavigate((path: string) => {
      navigate(path);
    });
  }, [navigate]);
  return null;
}

function DefaultRedirect(): React.JSX.Element {
  const { config } = useDashboardConfig();
  const landing = config?.views.find(v => v.defaultLanding && v.visible);
  const target = landing ? `/${landing.id}` : '/today';
  return <Navigate to={target} replace />;
}

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <DashboardConfigProvider>
        <NavigationListener />
        <div style={appStyles}>
          <Sidebar />
          <ContentArea>
            <GlobalBanners />
            <Routes>
              <Route path="/" element={<DefaultRedirect />} />
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
      </DashboardConfigProvider>
    </HashRouter>
  );
}
