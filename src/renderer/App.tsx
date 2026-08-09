/**
 * Main application shell.
 * Fixed left sidebar + right content area layout.
 * @see §Application Shell wireframe in 04-wireframes.md
 */

import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import TitleBar from './components/layout/TitleBar';
import Sidebar from './components/layout/Sidebar';
import ContentArea from './components/layout/ContentArea';
import Topbar from './components/layout/Topbar';
import GlobalBanners from './components/common/GlobalBanners';
import TodayView from './views/TodayView';
import CoworkSessionsView from './views/CoworkSessionsView';
import CodeSessionsView from './views/CodeSessionsView';
import ChatHistoryView from './views/ChatHistoryView';
import TrendsView from './views/TrendsView';
import ProjectsView from './views/ProjectsView';
import HeatmapView from './views/HeatmapView';
import UsageView from './views/UsageView';
import SettingsView from './views/SettingsView';
import { DashboardConfigProvider, useDashboardConfig } from './contexts/DashboardConfigContext';
import { TopbarProvider, useTopbar } from './contexts/TopbarContext';
import { useCoworkAvailability } from './hooks/useCoworkAvailability';

const appStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  backgroundColor: 'var(--background)',
  color: 'var(--text-primary)',
};

const bodyStyles: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
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

const pageScrollStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
};

function TopbarBridge(): React.JSX.Element | null {
  const { activeRange, onRangeChange } = useTopbar();
  return <Topbar activeRange={activeRange} onRangeChange={onRangeChange} />;
}

function DefaultRedirect(): React.JSX.Element {
  const { config } = useDashboardConfig();
  const availability = useCoworkAvailability();
  // Cowork can be the configured landing view via a dashboard.json imported
  // from Windows. Skipping it here (not just in CoworkRoute) matters: "/" →
  // "/cowork" → back to "/" would otherwise loop forever (CGUI-82).
  const coworkUnavailable = availability !== null && !availability.available;
  const landing = config?.views.find(
    v => v.defaultLanding && v.visible && !(coworkUnavailable && v.id === 'cowork')
  );
  const target = landing ? `/${landing.id}` : '/today';
  return <Navigate to={target} replace />;
}

/**
 * Gates /cowork on the availability model (CGUI-82): deep links, onNavigate
 * pushes, and stale location.state all funnel through the route, so one gate
 * covers every entry path. While availability is unknown (null) the view
 * renders as before — hiding-then-showing would flicker on Windows.
 */
function CoworkRoute(): React.JSX.Element {
  const availability = useCoworkAvailability();
  if (availability !== null && !availability.available) {
    return <Navigate to="/" replace />;
  }
  return <CoworkSessionsView />;
}

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <DashboardConfigProvider>
        <TopbarProvider>
          <NavigationListener />
          <div style={appStyles}>
            <TitleBar />
            <div style={bodyStyles}>
              <Sidebar />
              <ContentArea>
                <TopbarBridge />
                {/* Outside the scroll container: the LogWatcher banner is
                    meant to be persistent and non-dismissible, but inside it
                    scrolled out of view with the page content (CGUI-70). */}
                <GlobalBanners />
                <div style={pageScrollStyles}>
                  <Routes>
                    <Route path="/" element={<DefaultRedirect />} />
                    <Route path="/today" element={<TodayView />} />
                    <Route path="/cowork" element={<CoworkRoute />} />
                    <Route path="/code" element={<CodeSessionsView />} />
                    <Route path="/chat" element={<ChatHistoryView />} />
                    <Route path="/projects" element={<ProjectsView />} />
                    <Route path="/trends" element={<TrendsView />} />
                    <Route path="/heatmap" element={<HeatmapView />} />
                    <Route path="/usage" element={<UsageView />} />
                    <Route path="/settings" element={<SettingsView />} />
                  </Routes>
                </div>
              </ContentArea>
            </div>
          </div>
        </TopbarProvider>
      </DashboardConfigProvider>
    </HashRouter>
  );
}
