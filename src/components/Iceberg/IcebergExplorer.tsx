import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check, RefreshCw, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { useIcebergStore } from "../../store/icebergStore";
import { useConnectionStore } from "../../store/connectionStore";
import { useSchemaStore } from "../../store/schemaStore";
import { tauriInvoke } from "../../lib/tauri";
import { DataGrid } from "../Results/DataGrid";
import type { QueryResult } from "../../types";

type Tab = "data" | "schema" | "snapshots" | "files" | "partitions" | "history" | "sync";

const TABS: { id: Tab; label: string }[] = [
  { id: "data",       label: "Data" },
  { id: "schema",     label: "Schema" },
  { id: "snapshots",  label: "Snapshots" },
  { id: "files",      label: "Files" },
  { id: "partitions", label: "Partitions" },
  { id: "history",    label: "History" },
  { id: "sync",       label: "Sync" },
];

function buildQuery(tab: Tab, catalog: string, schema: string, table: string): string {
  const q = (suffix: string) => `"${catalog}"."${schema}"."${table}${suffix}"`;
  switch (tab) {
    case "data":
      return `SELECT *\nFROM ${q("")}\nLIMIT 1000`;
    case "schema":
      return `DESCRIBE ${q("")}`;
    case "snapshots":
      return (
        `SELECT\n` +
        `  snapshot_id,\n` +
        `  committed_at,\n` +
        `  parent_id,\n` +
        `  operation,\n` +
        `  manifest_list,\n` +
        `  summary\n` +
        `FROM ${q("$snapshots")}\n` +
        `ORDER BY committed_at DESC`
      );
    case "files":
      return (
        `SELECT\n` +
        `  file_path,\n` +
        `  file_format,\n` +
        `  record_count,\n` +
        `  ROUND(file_size_in_bytes / 1024.0 / 1024.0, 2) AS size_mb,\n` +
        `  "partition",\n` +
        `  readable_metrics\n` +
        `FROM ${q("$files")}\n` +
        `ORDER BY file_size_in_bytes DESC`
      );
    case "partitions":
      return `SELECT * FROM ${q("$partitions")}`;
    case "history":
      return (
        `SELECT\n` +
        `  made_current_at,\n` +
        `  snapshot_id,\n` +
        `  parent_id,\n` +
        `  is_current_ancestor\n` +
        `FROM ${q("$history")}\n` +
        `ORDER BY made_current_at DESC`
      );
    default:
      return "";
  }
}

/* ── status badge ── */
type ActionStatus = "idle" | "loading" | "success" | "error";

function StatusBadge({ status, error, elapsed }: { status: ActionStatus; error?: string; elapsed?: number }) {
  if (status === "idle") return null;
  if (status === "loading") return (
    <span className="sync-status sync-status--loading">
      <Loader size={11} className="spinning" /> Running…
    </span>
  );
  if (status === "success") return (
    <span className="sync-status sync-status--success">
      <CheckCircle size={11} /> Done{elapsed != null ? ` · ${elapsed}ms` : ""}
    </span>
  );
  return (
    <span className="sync-status sync-status--error" title={error}>
      <AlertCircle size={11} /> {error?.slice(0, 120)}
    </span>
  );
}

/* ── sync tab ── */
function SyncTab({
  catalog, schema, table, connectionId,
}: {
  catalog: string; schema: string; table: string; connectionId: string;
}) {
  const { loadCatalogs } = useSchemaStore();
  const { connections } = useConnectionStore();

  const [flushTableStatus, setFlushTableStatus] = useState<ActionStatus>("idle");
  const [flushTableErr, setFlushTableErr] = useState("");
  const [flushTableMs, setFlushTableMs] = useState<number | undefined>();

  const [flushCatalogStatus, setFlushCatalogStatus] = useState<ActionStatus>("idle");
  const [flushCatalogErr, setFlushCatalogErr] = useState("");
  const [flushCatalogMs, setFlushCatalogMs] = useState<number | undefined>();

  const [syncMode, setSyncMode] = useState<"FULL" | "ADD" | "DELETE">("FULL");
  const [syncStatus, setSyncStatus] = useState<ActionStatus>("idle");
  const [syncErr, setSyncErr] = useState("");
  const [syncMs, setSyncMs] = useState<number | undefined>();

  const [regSchema, setRegSchema] = useState(schema);
  const [regTable, setRegTable] = useState(table);
  const [regLocation, setRegLocation] = useState("");
  const [regStatus, setRegStatus] = useState<ActionStatus>("idle");
  const [regErr, setRegErr] = useState("");
  const [regMs, setRegMs] = useState<number | undefined>();

  const run = async (sql: string): Promise<{ elapsed: number }> => {
    const result = await tauriInvoke<QueryResult>("run_query", { sql, connectionId });
    return { elapsed: result.elapsed_ms };
  };

  const handleFlushTable = async () => {
    setFlushTableStatus("loading");
    setFlushTableErr("");
    try {
      const { elapsed } = await run(
        `CALL "${catalog}".system.flush_metadata_cache(\n` +
        `  schema_name => '${schema}',\n` +
        `  table_name  => '${table}'\n` +
        `)`
      );
      setFlushTableMs(elapsed);
      setFlushTableStatus("success");
    } catch (e) {
      setFlushTableErr(e instanceof Error ? e.message : String(e));
      setFlushTableStatus("error");
    }
  };

  const handleFlushCatalog = async () => {
    setFlushCatalogStatus("loading");
    setFlushCatalogErr("");
    try {
      const { elapsed } = await run(`CALL "${catalog}".system.flush_metadata_cache()`);
      setFlushCatalogMs(elapsed);
      setFlushCatalogStatus("success");
      // Reload schema tree so newly visible tables appear
      const conn = connections.find((c) => c.id === connectionId);
      loadCatalogs(connectionId, conn?.catalog ?? undefined);
    } catch (e) {
      setFlushCatalogErr(e instanceof Error ? e.message : String(e));
      setFlushCatalogStatus("error");
    }
  };

  const handleSyncPartitions = async () => {
    setSyncStatus("loading");
    setSyncErr("");
    try {
      const { elapsed } = await run(
        `CALL "${catalog}".system.sync_partition_metadata(\n` +
        `  '${schema}',\n` +
        `  '${table}',\n` +
        `  '${syncMode}'\n` +
        `)`
      );
      setSyncMs(elapsed);
      setSyncStatus("success");
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : String(e));
      setSyncStatus("error");
    }
  };

  const handleRegister = async () => {
    if (!regLocation.trim()) return;
    setRegStatus("loading");
    setRegErr("");
    try {
      const { elapsed } = await run(
        `CALL "${catalog}".system.register_table(\n` +
        `  schema_name    => '${regSchema}',\n` +
        `  table_name     => '${regTable}',\n` +
        `  table_location => '${regLocation.trim()}'\n` +
        `)`
      );
      setRegMs(elapsed);
      setRegStatus("success");
      // Reload schema so newly registered table appears
      const conn = connections.find((c) => c.id === connectionId);
      loadCatalogs(connectionId, conn?.catalog ?? undefined);
    } catch (e) {
      setRegErr(e instanceof Error ? e.message : String(e));
      setRegStatus("error");
    }
  };

  return (
    <div className="sync-panel">

      {/* ── Flush cache ── */}
      <div className="sync-section">
        <div className="sync-section-title">Flush Metadata Cache</div>
        <p className="sync-section-desc">
          Force Trino to re-read Iceberg metadata from the catalog. Run this when tables
          exist in Iceberg but aren't visible in Trino, or after external writes.
        </p>
        <div className="sync-actions">
          <button
            className="sync-btn"
            onClick={handleFlushTable}
            disabled={flushTableStatus === "loading"}
          >
            Flush this table
          </button>
          <StatusBadge status={flushTableStatus} error={flushTableErr} elapsed={flushTableMs} />
        </div>
        <div className="sync-actions" style={{ marginTop: 6 }}>
          <button
            className="sync-btn sync-btn--primary"
            onClick={handleFlushCatalog}
            disabled={flushCatalogStatus === "loading"}
          >
            Flush entire catalog + reload tree
          </button>
          <StatusBadge status={flushCatalogStatus} error={flushCatalogErr} elapsed={flushCatalogMs} />
        </div>
        <div className="sync-sql-preview">
          {`CALL "${catalog}".system.flush_metadata_cache()`}
        </div>
      </div>

      {/* ── Sync partitions ── */}
      <div className="sync-section">
        <div className="sync-section-title">Sync Partition Metadata</div>
        <p className="sync-section-desc">
          Re-scan actual data files to update partition statistics. Use <strong>FULL</strong> to
          reconcile all partitions, <strong>ADD</strong> for new ones only, <strong>DELETE</strong>
          to remove stale entries.
        </p>
        <div className="sync-actions">
          <select
            className="sync-select"
            value={syncMode}
            onChange={(e) => setSyncMode(e.target.value as typeof syncMode)}
          >
            <option value="FULL">FULL</option>
            <option value="ADD">ADD</option>
            <option value="DELETE">DELETE</option>
          </select>
          <button
            className="sync-btn"
            onClick={handleSyncPartitions}
            disabled={syncStatus === "loading"}
          >
            Run sync
          </button>
          <StatusBadge status={syncStatus} error={syncErr} elapsed={syncMs} />
        </div>
        <div className="sync-sql-preview">
          {`CALL "${catalog}".system.sync_partition_metadata('${schema}', '${table}', '${syncMode}')`}
        </div>
      </div>

      {/* ── Register table ── */}
      <div className="sync-section">
        <div className="sync-section-title">Register Table</div>
        <p className="sync-section-desc">
          Register an Iceberg table by its storage location. Use this to make a table that
          exists in S3/GCS/HDFS visible to Trino without recreating it.
        </p>
        <div className="sync-form">
          <label className="sync-label">Schema</label>
          <input
            className="sync-input"
            value={regSchema}
            onChange={(e) => setRegSchema(e.target.value)}
            placeholder="schema name"
          />
          <label className="sync-label">Table name</label>
          <input
            className="sync-input"
            value={regTable}
            onChange={(e) => setRegTable(e.target.value)}
            placeholder="table name"
          />
          <label className="sync-label">Table location</label>
          <input
            className="sync-input sync-input--location"
            value={regLocation}
            onChange={(e) => setRegLocation(e.target.value)}
            placeholder="s3://bucket/path/to/table"
          />
        </div>
        <div className="sync-actions" style={{ marginTop: 8 }}>
          <button
            className="sync-btn sync-btn--primary"
            onClick={handleRegister}
            disabled={regStatus === "loading" || !regLocation.trim()}
          >
            Register
          </button>
          <StatusBadge status={regStatus} error={regErr} elapsed={regMs} />
        </div>
        <div className="sync-sql-preview">
          {`CALL "${catalog}".system.register_table(\n  schema_name => '${regSchema}',\n  table_name => '${regTable}',\n  table_location => '${regLocation || "…"}'\n)`}
        </div>
      </div>

    </div>
  );
}

/* ── tiny clipboard hook ── */
function useCopy() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);
  return { copiedIdx, copy };
}

/* ── cell renderer ── */
function Cell({ value, colIdx, rowIdx, onCopy, copiedIdx, isFilePath }: {
  value: string | number | boolean | null;
  colIdx: number;
  rowIdx: number;
  onCopy: (text: string, idx: number) => void;
  copiedIdx: number | null;
  isFilePath: boolean;
}) {
  const key = rowIdx * 1000 + colIdx;
  if (value === null || value === undefined) {
    return <td className="iceberg-cell iceberg-cell--null"><em>NULL</em></td>;
  }
  const str = String(value);
  if (isFilePath) {
    return (
      <td className="iceberg-cell iceberg-cell--path">
        <span className="iceberg-path-text" title={str}>{str}</span>
        <button
          className="iceberg-copy-btn"
          onClick={() => onCopy(str, key)}
          title="Copy path"
        >
          {copiedIdx === key ? <Check size={10} /> : <Copy size={10} />}
        </button>
      </td>
    );
  }
  return (
    <td className="iceberg-cell">
      <span title={str}>{str}</span>
    </td>
  );
}

/* ── results table ── */
function MetaTable({ result }: { result: QueryResult }) {
  const { copiedIdx, copy } = useCopy();
  const filePathColIndices = new Set(
    result.columns
      .map((c, i) => ({ name: c.name.toLowerCase(), i }))
      .filter(({ name }) => name.includes("path") || name.includes("manifest"))
      .map(({ i }) => i)
  );

  return (
    <div className="iceberg-table-wrap">
      <table className="iceberg-table">
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th key={col.name} className="iceberg-th">{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr key={ri} className="iceberg-tr">
              {row.map((cell, ci) => (
                <Cell
                  key={ci}
                  value={cell}
                  colIdx={ci}
                  rowIdx={ri}
                  onCopy={copy}
                  copiedIdx={copiedIdx}
                  isFilePath={filePathColIndices.has(ci)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length === 0 && (
        <div className="iceberg-empty">No rows returned</div>
      )}
    </div>
  );
}

/* ── main explorer ── */
export function IcebergExplorer() {
  const { exploredTable, setExploredTable } = useIcebergStore();
  const { activeConnectionId } = useConnectionStore();
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [results, setResults] = useState<Partial<Record<Tab, QueryResult>>>({});
  const [loading, setLoading] = useState<Tab | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Tab, string>>>({});

  const table = exploredTable;

  const fetchTab = useCallback(async (tab: Tab) => {
    if (!table || !activeConnectionId || tab === "sync") return;
    setLoading(tab);
    setErrors((e) => ({ ...e, [tab]: undefined }));
    try {
      const sql = buildQuery(tab, table.catalog, table.schema, table.table);
      const result = await tauriInvoke<QueryResult>("run_query", {
        sql,
        connectionId: activeConnectionId,
      });
      setResults((r) => ({ ...r, [tab]: result }));
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [tab]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setLoading(null);
    }
  }, [table, activeConnectionId]);

  useEffect(() => {
    if (activeTab !== "sync" && !results[activeTab] && !errors[activeTab]) {
      fetchTab(activeTab);
    }
  }, [activeTab, table]);

  useEffect(() => {
    setResults({});
    setErrors({});
    setActiveTab("data");
  }, [table?.catalog, table?.schema, table?.table]);

  if (!table) return null;

  const currentResult = results[activeTab];
  const currentError = errors[activeTab];
  const isLoading = loading === activeTab;

  return (
    <div className="iceberg-explorer">
      {/* Header */}
      <div className="iceberg-header">
        <div className="iceberg-breadcrumb">
          <span className="iceberg-crumb iceberg-crumb--catalog">{table.catalog}</span>
          <span className="iceberg-sep">›</span>
          <span className="iceberg-crumb iceberg-crumb--schema">{table.schema}</span>
          <span className="iceberg-sep">›</span>
          <span className="iceberg-crumb iceberg-crumb--table">{table.table}</span>
        </div>
        <button
          className="iceberg-close-btn"
          onClick={() => setExploredTable(null)}
          title="Close Iceberg Explorer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="iceberg-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`iceberg-tab${activeTab === t.id ? " iceberg-tab--active" : ""}${t.id === "sync" ? " iceberg-tab--sync" : ""}${errors[t.id] ? " iceberg-tab--error" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {errors[t.id] && <AlertCircle size={10} className="iceberg-tab-err-dot" />}
          </button>
        ))}
        {activeTab !== "sync" && (
          <button
            className="iceberg-refresh-btn"
            onClick={() => {
              setResults((r) => ({ ...r, [activeTab]: undefined }));
              setErrors((e) => ({ ...e, [activeTab]: undefined }));
              fetchTab(activeTab);
            }}
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshCw size={12} className={isLoading ? "spinning" : ""} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="iceberg-content">
        {activeTab === "sync" ? (
          <div className="iceberg-table-wrap">
            <SyncTab
              catalog={table.catalog}
              schema={table.schema}
              table={table.table}
              connectionId={activeConnectionId!}
            />
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="iceberg-loading">
                <span className="spinner" />
                <span>Querying Trino…</span>
              </div>
            )}
            {!isLoading && currentError && (
              <div className="iceberg-error">
                <AlertCircle size={16} />
                <pre>{currentError}</pre>
              </div>
            )}
            {!isLoading && !currentError && currentResult && (
              <>
                <div className="iceberg-row-count">
                  {currentResult.row_count} {currentResult.row_count === 1 ? "row" : "rows"}
                  {activeTab === "data" && currentResult.row_count >= 1000 && (
                    <span className="iceberg-elapsed"> · preview: first 1000</span>
                  )}
                  <span className="iceberg-elapsed">{currentResult.elapsed_ms}ms</span>
                </div>
                {activeTab === "data"
                  ? <DataGrid result={currentResult} />
                  : <MetaTable result={currentResult} />
                }
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
