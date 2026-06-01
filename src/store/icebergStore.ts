import { create } from "zustand";

export interface IcebergTable {
  catalog: string;
  schema: string;
  table: string;
}

interface IcebergState {
  exploredTable: IcebergTable | null;
  setExploredTable: (t: IcebergTable | null) => void;
}

export const useIcebergStore = create<IcebergState>((set) => ({
  exploredTable: null,
  setExploredTable: (exploredTable) => set({ exploredTable }),
}));
