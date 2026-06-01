import { create } from "zustand";
import type { QueryResult, QueryTab } from "../types";
import { v4 as uuidv4 } from "uuid";

interface QueryState {
  tabs: QueryTab[];
  activeTabId: string;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabSql: (id: string, sql: string) => void;
  setTabResult: (id: string, result: QueryResult) => void;
  setTabError: (id: string, error: string) => void;
  setTabRunning: (id: string, running: boolean) => void;
}

function makeTab(n: number): QueryTab {
  return {
    id: uuidv4(),
    title: `Query ${n}`,
    sql: "",
    result: null,
    isRunning: false,
    error: null,
  };
}

const initialTab = makeTab(1);

export const useQueryStore = create<QueryState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  addTab: () => {
    const newTab = makeTab(get().tabs.length + 1);
    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    const newActive =
      activeTabId === id
        ? (remaining[Math.max(0, idx - 1)]?.id ?? remaining[0].id)
        : activeTabId;
    set({ tabs: remaining, activeTabId: newActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabSql: (id, sql) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, sql } : t)),
    })),

  setTabResult: (id, result) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, result, error: null, isRunning: false } : t
      ),
    })),

  setTabError: (id, error) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, error, result: null, isRunning: false } : t
      ),
    })),

  setTabRunning: (id, running) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isRunning: running } : t)),
    })),
}));
