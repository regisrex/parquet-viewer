import { create } from "zustand";
import type { SchemaNode } from "../types";
import { tauriInvoke } from "../lib/tauri";

interface SchemaState {
  tree: SchemaNode[];
  search: string;
  setSearch: (s: string) => void;
  loadCatalogs: (connectionId: string, defaultCatalog?: string) => Promise<void>;
  expandNode: (connectionId: string, path: string) => Promise<void>;
  collapseNode: (path: string) => void;
}

function updateNode(
  nodes: SchemaNode[],
  path: string,
  updater: (n: SchemaNode) => SchemaNode
): SchemaNode[] {
  return nodes.map((n) => {
    if (n.path === path) return updater(n);
    if (n.children) return { ...n, children: updateNode(n.children, path, updater) };
    return n;
  });
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  tree: [],
  search: "",

  setSearch: (search) => set({ search }),

  loadCatalogs: async (connectionId, defaultCatalog) => {
    set({ tree: [] });
    try {
      const catalogs = await tauriInvoke<string[]>("list_catalogs", { connectionId });
      set({
        tree: catalogs.map((name) => ({
          type: "catalog",
          name,
          path: name,
          children: undefined,
          isExpanded: false,
          isLoading: false,
        })),
      });

      // Auto-expand the default catalog if specified
      if (defaultCatalog) {
        const match = catalogs.find(
          (c) => c.toLowerCase() === defaultCatalog.toLowerCase()
        );
        if (match) {
          await get().expandNode(connectionId, match);
        }
      }
    } catch {
      // silently fail
    }
  },

  expandNode: async (connectionId, path) => {
    const parts = path.split(".");
    const { tree } = get();

    set({ tree: updateNode(tree, path, (n) => ({ ...n, isLoading: true })) });

    try {
      if (parts.length === 1) {
        const catalog = parts[0];
        const schemas = await tauriInvoke<string[]>("list_schemas", { connectionId, catalog });
        const children: SchemaNode[] = schemas.map((name) => ({
          type: "schema",
          name,
          path: `${catalog}.${name}`,
          children: undefined,
          isExpanded: false,
          isLoading: false,
        }));
        set({
          tree: updateNode(get().tree, path, (n) => ({
            ...n,
            children,
            isExpanded: true,
            isLoading: false,
          })),
        });
      } else if (parts.length === 2) {
        const [catalog, schema] = parts;
        const tables = await tauriInvoke<string[]>("list_tables", { connectionId, catalog, schema });
        const children: SchemaNode[] = tables.map((name) => ({
          type: "table",
          name,
          path: `${catalog}.${schema}.${name}`,
          children: undefined,
          isExpanded: false,
          isLoading: false,
        }));
        set({
          tree: updateNode(get().tree, path, (n) => ({
            ...n,
            children,
            isExpanded: true,
            isLoading: false,
          })),
        });
      }
    } catch {
      set({ tree: updateNode(get().tree, path, (n) => ({ ...n, isLoading: false })) });
    }
  },

  collapseNode: (path) => {
    set({
      tree: updateNode(get().tree, path, (n) => ({ ...n, isExpanded: false })),
    });
  },
}));
