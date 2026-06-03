import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { tauriInvoke } from "../lib/tauri";
import type { ParquetPreview } from "../types";

export interface ParquetTab {
  id: string;
  path: string;
  fileName: string;
  preview: ParquetPreview | null;
  isLoading: boolean;
  error: string | null;
}

interface ParquetState {
  tabs: ParquetTab[];
  activeTabId: string | null;
  pickAndOpen: () => Promise<void>;
  openPath: (path: string) => Promise<void>;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function loadTab(id: string, path: string, set: (fn: (s: ParquetState) => Partial<ParquetState>) => void) {
  tauriInvoke<ParquetPreview>("read_parquet_file", { path, limit: 2000 })
    .then((preview) =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, preview, isLoading: false } : t)) }))
    )
    .catch((err) => {
      const error = err instanceof Error ? err.message : String(err);
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, error, isLoading: false } : t)) }));
    });
}

export const useParquetStore = create<ParquetState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  pickAndOpen: async () => {
    const result = await open({
      multiple: true,
      filters: [{ name: "Parquet files", extensions: ["parquet", "parq"] }],
    });
    if (!result) return;
    const paths = Array.isArray(result) ? result : [result];
    for (const path of paths) {
      // Dedup: focus existing tab instead of reopening
      const existing = get().tabs.find((t) => t.path === path);
      if (existing) {
        set({ activeTabId: existing.id });
        continue;
      }
      const id = crypto.randomUUID();
      const fileName = fileNameFromPath(path);
      set((s) => ({
        tabs: [...s.tabs, { id, path, fileName, preview: null, isLoading: true, error: null }],
        activeTabId: id,
      }));
      loadTab(id, path, set);
    }
  },

  openPath: async (path: string) => {
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const id = crypto.randomUUID();
    const fileName = fileNameFromPath(path);
    set((s) => ({
      tabs: [...s.tabs, { id, path, fileName, preview: null, isLoading: true, error: null }],
      activeTabId: id,
    }));
    loadTab(id, path, set);
  },

  closeTab: (id: string) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId: string | null = activeTabId;
    if (activeTabId === id) {
      newActiveId = (newTabs[idx] ?? newTabs[idx - 1])?.id ?? null;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),
}));
