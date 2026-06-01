import { create } from "zustand";
import type { ConnectionRecord } from "../types";
import { tauriInvoke } from "../lib/tauri";
import { v4 as uuidv4 } from "uuid";

interface ConnectionState {
  connections: ConnectionRecord[];
  activeConnectionId: string | null;
  loadConnections: () => Promise<void>;
  saveConnection: (
    data: Omit<ConnectionRecord, "id" | "created_at" | "last_used">
  ) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  setActiveConnection: (id: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,

  loadConnections: async () => {
    const connections = await tauriInvoke<ConnectionRecord[]>("get_connections");
    set({ connections });
    if (!get().activeConnectionId && connections.length > 0) {
      set({ activeConnectionId: connections[0].id });
    }
  },

  saveConnection: async (data) => {
    const record: ConnectionRecord = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      last_used: null,
    };
    await tauriInvoke("save_connection", { record });
    await get().loadConnections();
    set({ activeConnectionId: record.id });
  },

  deleteConnection: async (id) => {
    await tauriInvoke("delete_connection", { id });
    const { activeConnectionId } = get();
    await get().loadConnections();
    if (activeConnectionId === id) {
      const remaining = get().connections;
      set({ activeConnectionId: remaining[0]?.id ?? null });
    }
  },

  setActiveConnection: (id) => set({ activeConnectionId: id }),
}));
