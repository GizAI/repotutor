'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type TabType = 'browse' | 'chat';

interface TabState {
  activeTab: TabType;
  browseScrollPosition: number;
  chatInputDraft: string;
}

interface TabContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  browseScrollPosition: number;
  setBrowseScrollPosition: (position: number) => void;
  chatInputDraft: string;
  setChatInputDraft: (draft: string) => void;
}

const TabContext = createContext<TabContextType | null>(null);

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TabState>({
    activeTab: 'browse',
    browseScrollPosition: 0,
    chatInputDraft: '',
  });

  const setActiveTab = useCallback((tab: TabType) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const setBrowseScrollPosition = useCallback((position: number) => {
    setState((prev) => ({ ...prev, browseScrollPosition: position }));
  }, []);

  const setChatInputDraft = useCallback((draft: string) => {
    setState((prev) => ({ ...prev, chatInputDraft: draft }));
  }, []);

  const value = useMemo(
    () => ({
      activeTab: state.activeTab,
      setActiveTab,
      browseScrollPosition: state.browseScrollPosition,
      setBrowseScrollPosition,
      chatInputDraft: state.chatInputDraft,
      setChatInputDraft,
    }),
    [state, setActiveTab, setBrowseScrollPosition, setChatInputDraft]
  );

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

export function useTab() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTab must be used within a TabProvider');
  }
  return context;
}

export function useTabSafe() {
  return useContext(TabContext);
}
