import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface TopbarState {
  activeRange: string | undefined;
  onRangeChange: ((range: string) => void) | undefined;
  setRangeControls: (range: string, onChange: (range: string) => void) => void;
  clearRangeControls: () => void;
}

const TopbarContext = createContext<TopbarState | null>(null);

export function TopbarProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [activeRange, setActiveRange] = useState<string | undefined>(undefined);
  const [onRangeChange, setOnRangeChange] = useState<((range: string) => void) | undefined>(undefined);

  const setRangeControls = useCallback((range: string, onChange: (range: string) => void) => {
    setActiveRange(range);
    setOnRangeChange(() => onChange);
  }, []);

  const clearRangeControls = useCallback(() => {
    setActiveRange(undefined);
    setOnRangeChange(undefined);
  }, []);

  const value = useMemo(() => ({
    activeRange,
    onRangeChange,
    setRangeControls,
    clearRangeControls,
  }), [activeRange, onRangeChange, setRangeControls, clearRangeControls]);

  return <TopbarContext.Provider value={value}>{children}</TopbarContext.Provider>;
}

export function useTopbar(): TopbarState {
  const ctx = useContext(TopbarContext);
  if (!ctx) throw new Error('useTopbar must be used within TopbarProvider');
  return ctx;
}
