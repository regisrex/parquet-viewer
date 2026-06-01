import { useState } from "react";
import { X, FileText, AlertCircle } from "lucide-react";
import { useParquetStore } from "../../store/parquetStore";
import { DataGrid } from "../Results/DataGrid";
import type { ParquetMeta, SchemaColumnInfo, RowGroupInfo } from "../../types";

type Tab = "data" | "schema" | "fileinfo";

const TABS: { id: Tab; label: string }[] = [
  { id: "data",     label: "Data" },
  { id: "schema",   label: "Schema" },
  { id: "fileinfo", label: "File Info" },
];

function fmt_bytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(2) + " GB";
  if (n >= 1_048_576)     return (n / 1_048_576).toFixed(2) + " MB";
  if (n >= 1_024)         return (n / 1_024).toFixed(1) + " KB";
  return n + " B";
}

function SchemaTab({ cols }: { cols: SchemaColumnInfo[] }) {
  return (
    <div className="pq-table-wrap">
      <table className="pq-table">
        <thead>
          <tr>
            <th className="pq-th">#</th>
            <th className="pq-th">Column</th>
            <th className="pq-th">Physical type</th>
            <th className="pq-th">Logical type</th>
          </tr>
        </thead>
        <tbody>
          {cols.map((col, i) => (
            <tr key={col.name} className="pq-tr">
              <td className="pq-td pq-td--muted">{i + 1}</td>
              <td className="pq-td pq-td--name">{col.name}</td>
              <td className="pq-td pq-td--type">{col.physical_type}</td>
              <td className="pq-td pq-td--muted">{col.logical_type ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileInfoTab({ meta }: { meta: ParquetMeta }) {
  const [expandedRg, setExpandedRg] = useState<number | null>(null);

  return (
    <div className="pq-fileinfo">
      {/* Top stats */}
      <div className="pq-stats-grid">
        <div className="pq-stat">
          <span className="pq-stat-label">Total rows</span>
          <span className="pq-stat-value">{meta.num_rows.toLocaleString()}</span>
        </div>
        <div className="pq-stat">
          <span className="pq-stat-label">Row groups</span>
          <span className="pq-stat-value">{meta.num_row_groups}</span>
        </div>
        <div className="pq-stat">
          <span className="pq-stat-label">File size</span>
          <span className="pq-stat-value">{fmt_bytes(meta.file_size_bytes)}</span>
        </div>
        <div className="pq-stat">
          <span className="pq-stat-label">Columns</span>
          <span className="pq-stat-value">{meta.schema_columns.length}</span>
        </div>
        {meta.created_by && (
          <div className="pq-stat pq-stat--wide">
            <span className="pq-stat-label">Created by</span>
            <span className="pq-stat-value pq-stat-value--mono">{meta.created_by}</span>
          </div>
        )}
      </div>

      {/* Row groups */}
      <div className="pq-section-title">Row Groups</div>
      {meta.row_groups.map((rg: RowGroupInfo, i) => (
        <div key={i} className="pq-rg">
          <button
            className="pq-rg-header"
            onClick={() => setExpandedRg(expandedRg === i ? null : i)}
          >
            <span className="pq-rg-index">RG {i}</span>
            <span className="pq-rg-rows">{rg.num_rows.toLocaleString()} rows</span>
            <span className="pq-rg-size">{fmt_bytes(rg.total_size_bytes)}</span>
            <span className="pq-rg-chevron">{expandedRg === i ? "▾" : "▸"}</span>
          </button>
          {expandedRg === i && (
            <div className="pq-rg-body">
              <table className="pq-table">
                <thead>
                  <tr>
                    <th className="pq-th">Column</th>
                    <th className="pq-th">Compression</th>
                    <th className="pq-th">Values</th>
                    <th className="pq-th">Nulls</th>
                    <th className="pq-th">Compressed</th>
                    <th className="pq-th">Uncompressed</th>
                    <th className="pq-th">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {rg.columns.map((col) => {
                    const ratio = col.uncompressed_bytes > 0
                      ? ((1 - col.compressed_bytes / col.uncompressed_bytes) * 100).toFixed(1)
                      : null;
                    return (
                      <tr key={col.name} className="pq-tr">
                        <td className="pq-td pq-td--name">{col.name}</td>
                        <td className="pq-td">
                          <span className="pq-badge">{col.compression}</span>
                        </td>
                        <td className="pq-td pq-td--num">{col.num_values.toLocaleString()}</td>
                        <td className="pq-td pq-td--num">
                          {col.null_count != null ? col.null_count.toLocaleString() : "—"}
                        </td>
                        <td className="pq-td pq-td--num">{fmt_bytes(col.compressed_bytes)}</td>
                        <td className="pq-td pq-td--num">{fmt_bytes(col.uncompressed_bytes)}</td>
                        <td className="pq-td pq-td--num pq-td--ratio">
                          {ratio != null ? `${ratio}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ParquetViewer() {
  const { openFile, isLoading, error, close } = useParquetStore();
  const [activeTab, setActiveTab] = useState<Tab>("data");

  if (isLoading) {
    return (
      <div className="pq-viewer pq-viewer--loading">
        <span className="spinner" />
        <span>Reading Parquet file…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pq-viewer pq-viewer--error">
        <AlertCircle size={18} />
        <div>
          <div className="pq-error-title">Failed to open file</div>
          <pre className="pq-error-body">{error}</pre>
        </div>
        <button className="iceberg-close-btn" onClick={close}><X size={14} /></button>
      </div>
    );
  }

  if (!openFile) return null;

  const { result, meta } = openFile;

  return (
    <div className="pq-viewer">
      {/* Header */}
      <div className="iceberg-header">
        <div className="iceberg-breadcrumb">
          <FileText size={13} className="tree-icon tree-icon--table" />
          <span className="iceberg-crumb iceberg-crumb--table" title={meta.path}>
            {meta.file_name}
          </span>
          <span className="iceberg-sep">·</span>
          <span className="iceberg-crumb iceberg-crumb--catalog">
            {fmt_bytes(meta.file_size_bytes)}
          </span>
          <span className="iceberg-sep">·</span>
          <span className="iceberg-crumb iceberg-crumb--catalog">
            {meta.num_rows.toLocaleString()} rows
          </span>
          <span className="iceberg-sep">·</span>
          <span className="iceberg-crumb iceberg-crumb--catalog">
            {result.elapsed_ms}ms
          </span>
        </div>
        <button className="iceberg-close-btn" onClick={close} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="iceberg-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`iceberg-tab${activeTab === t.id ? " iceberg-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.id === "data" && (
              <span className="pq-tab-count">
                {result.row_count < meta.num_rows
                  ? `${result.row_count.toLocaleString()} / ${meta.num_rows.toLocaleString()}`
                  : result.row_count.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pq-content">
        {activeTab === "data" && (
          result.rows.length > 0
            ? <DataGrid result={result} />
            : <div className="iceberg-empty">No rows in this file</div>
        )}
        {activeTab === "schema" && <SchemaTab cols={meta.schema_columns} />}
        {activeTab === "fileinfo" && <FileInfoTab meta={meta} />}
      </div>
    </div>
  );
}
