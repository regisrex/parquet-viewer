import { useState } from "react";
import { Search, Table2, RefreshCw, FolderOpen } from "lucide-react";
import { ConnectionPicker } from "./ConnectionPicker";
import { SchemaTree } from "./SchemaTree";
import { RecentQueries } from "./RecentQueries";
import { useSchemaStore } from "../../store/schemaStore";
import { useQueryStore } from "../../store/queryStore";
import { useConnectionStore } from "../../store/connectionStore";
import { useParquetStore } from "../../store/parquetStore";
import { tauriInvoke } from "../../lib/tauri";
import type { QueryResult } from "../../types";

export function Sidebar() {
  const { search, setSearch, loadCatalogs } = useSchemaStore();
  const { activeConnectionId, connections } = useConnectionStore();
  const { tabs, activeTabId, addTab, updateTabSql } = useQueryStore();
  const { pickAndOpen } = useParquetStore();
  const [flushing, setFlushing] = useState(false);
  const [flushDone, setFlushDone] = useState(false);

  const loadSql = (sql: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab && tab.sql.trim() === "") {
      updateTabSql(tab.id, sql);
    } else {
      addTab();
      setTimeout(() => {
        const store = useQueryStore.getState();
        updateTabSql(store.activeTabId, sql);
      }, 0);
    }
  };

  const handleAllTables = () => {
    const conn = activeConnectionId
      ? connections.find((c) => c.id === activeConnectionId)
      : null;
    const catalog = conn?.catalog ?? "iceberg";
    loadSql(
      `-- All tables visible to Trino in ${catalog}\n` +
      `SELECT\n` +
      `  table_schema,\n` +
      `  table_name,\n` +
      `  table_type\n` +
      `FROM "${catalog}"."information_schema"."tables"\n` +
      `WHERE table_schema NOT IN ('information_schema')\n` +
      `ORDER BY table_schema, table_name`
    );
  };

  const handleFlushCatalog = async () => {
    if (!activeConnectionId || flushing) return;
    const conn = connections.find((c) => c.id === activeConnectionId);
    const catalog = conn?.catalog ?? "iceberg";
    setFlushing(true);
    setFlushDone(false);
    try {
      await tauriInvoke<QueryResult>("run_query", {
        sql: `CALL "${catalog}".system.flush_metadata_cache()`,
        connectionId: activeConnectionId,
      });
      setFlushDone(true);
      setTimeout(() => setFlushDone(false), 2500);
      // Reload the schema tree so newly visible tables appear
      loadCatalogs(activeConnectionId, conn?.catalog ?? undefined);
    } catch {
      // If flush_metadata_cache isn't supported, still reload
      loadCatalogs(activeConnectionId, conn?.catalog ?? undefined);
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="sidebar">
      <ConnectionPicker />
      <button className="pq-open-btn" onClick={pickAndOpen} title="Open a local .parquet file">
        <FolderOpen size={12} />
        Open .parquet file
      </button>
      <div className="schema-search-bar">
        <div className="schema-search-input-wrap">
          <Search size={12} className="schema-search-icon" />
          <input
            className="schema-search-input"
            type="text"
            placeholder="Filter tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="schema-search-clear" onClick={() => setSearch("")}>×</button>
          )}
        </div>
        <div className="schema-search-actions">
          <button
            className="schema-all-tables-btn"
            onClick={handleAllTables}
            title="List all tables Trino can see via information_schema"
            disabled={!activeConnectionId}
          >
            <Table2 size={12} />
            All tables
          </button>
          <button
            className={`schema-flush-btn${flushDone ? " schema-flush-btn--done" : ""}`}
            onClick={handleFlushCatalog}
            title="Flush Trino metadata cache + reload schema tree"
            disabled={!activeConnectionId || flushing}
          >
            <RefreshCw size={12} className={flushing ? "spinning" : ""} />
            {flushDone ? "Synced!" : "Sync"}
          </button>
        </div>
      </div>
      <SchemaTree />
      <RecentQueries />
    </div>
  );
}
