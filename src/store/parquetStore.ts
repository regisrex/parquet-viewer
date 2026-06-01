import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { tauriInvoke } from "../lib/tauri";
import type { ParquetPreview } from "../types";

interface ParquetState {
  openFile: ParquetPreview | null;
  isLoading: boolean;
  error: string | null;
  pickAndOpen: () => Promise<void>;
  openPath: (path: string) => Promise<void>;
  close: () => void;
}

export const useParquetStore = create<ParquetState>((set) => ({
  openFile: null,
  isLoading: false,
  error: null,

  pickAndOpen: async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "Parquet files", extensions: ["parquet", "parq"] }],
    });
    if (!path || typeof path !== "string") return;
    set({ isLoading: true, error: null, openFile: null });
    try {
      const preview = await tauriInvoke<ParquetPreview>("read_parquet_file", {
        path,
        limit: 2000,
      });
      set({ openFile: preview, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  openPath: async (path: string) => {
    set({ isLoading: true, error: null, openFile: null });
    try {
      const preview = await tauriInvoke<ParquetPreview>("read_parquet_file", {
        path,
        limit: 2000,
      });
      set({ openFile: preview, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  close: () => set({ openFile: null, error: null }),
}));
