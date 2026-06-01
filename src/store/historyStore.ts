import { create } from "zustand";
import type { QueryHistoryEntry } from "../types";
import { tauriInvoke } from "../lib/tauri";

interface HistoryState {
  entries: QueryHistoryEntry[];
  loadHistory: (connectionId: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: [],

  loadHistory: async (connectionId) => {
    try {
      const entries = await tauriInvoke<QueryHistoryEntry[]>("get_history", {
        connectionId,
        limit: 50,
      });
      set({ entries });
    } catch {
      // silently ignore
    }
  },
}));
