import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import type { TrinoColumn } from "../../types";
import { tryParseJson } from "../../lib/format";

interface RowDetailPanelProps {
  row: Array<string | number | boolean | null>;
  columns: TrinoColumn[];
  onClose: () => void;
}

export function RowDetailPanel({ row, columns, onClose }: RowDetailPanelProps) {
  return (
    <div className="row-detail-panel">
      <div className="row-detail-header">
        <span className="row-detail-title">Row detail</span>
        <button className="icon-btn" onClick={onClose} title="Close (Esc)">
          <X size={14} />
        </button>
      </div>
      <div className="row-detail-body">
        {columns.map((col, i) => {
          const value = row[i];
          const parsed = value !== null ? tryParseJson(value) : null;
          return (
            <div key={col.name} className="row-detail-field">
              <div className="row-detail-key">
                <span className="row-detail-col-name">{col.name}</span>
                <span className="row-detail-col-type">{col.type_name}</span>
              </div>
              <div className="row-detail-value">
                {value === null ? (
                  <span className="null-value">NULL</span>
                ) : parsed !== null ? (
                  <JsonViewer data={parsed} raw={String(value)} />
                ) : (
                  <span className="row-detail-scalar">{String(value)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JsonViewer({ data, raw }: { data: unknown; raw: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = (() => {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    })();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="json-viewer-wrap">
      <button className="json-copy-btn" onClick={handleCopy} title="Copy JSON">
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="json-viewer">
        <JsonNode data={data} depth={0} />
      </pre>
    </div>
  );
}

function JsonNode({ data, depth }: { data: unknown; depth: number }) {
  if (data === null) return <span className="json-null">null</span>;
  if (typeof data === "boolean")
    return <span className="json-bool">{String(data)}</span>;
  if (typeof data === "number")
    return <span className="json-number">{data}</span>;
  if (typeof data === "string")
    return <span className="json-string">"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>[]</span>;
    const indent = "  ".repeat(depth + 1);
    const closeIndent = "  ".repeat(depth);
    return (
      <>
        {"[\n"}
        {data.map((item, i) => (
          <span key={i}>
            {indent}
            <JsonNode data={item} depth={depth + 1} />
            {i < data.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {closeIndent}
        {"]"}
      </>
    );
  }

  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    const indent = "  ".repeat(depth + 1);
    const closeIndent = "  ".repeat(depth);
    return (
      <>
        {"{\n"}
        {entries.map(([key, val], i) => (
          <span key={key}>
            {indent}
            <span className="json-key">"{key}"</span>
            {": "}
            <JsonNode data={val} depth={depth + 1} />
            {i < entries.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {closeIndent}
        {"}"}
      </>
    );
  }

  return <span>{String(data)}</span>;
}
