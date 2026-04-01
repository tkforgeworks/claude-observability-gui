import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { DashboardConfig } from '../../shared/ipc-types';

interface DashboardConfigContextValue {
  config: DashboardConfig | null;
  refreshConfig: () => void;
}

const DashboardConfigContext = createContext<DashboardConfigContextValue>({
  config: null,
  refreshConfig: () => {},
});

export function DashboardConfigProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [config, setConfig] = useState<DashboardConfig | null>(null);

  const refreshConfig = useCallback(() => {
    window.api.dashboard.get().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  return (
    <DashboardConfigContext.Provider value={{ config, refreshConfig }}>
      {children}
    </DashboardConfigContext.Provider>
  );
}

export function useDashboardConfig(): DashboardConfigContextValue {
  return useContext(DashboardConfigContext);
}
