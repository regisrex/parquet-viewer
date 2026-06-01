import { ChevronRight, ChevronDown, Database, Table, Layers, FileText, Play, Snowflake } from "lucide-react";
import { useSchemaStore } from "../../store/schemaStore";
import { useConnectionStore } from "../../store/connectionStore";
import type { SchemaNode } from "../../types";
import { useQueryStore } from "../../store/queryStore";
import { useIcebergStore } from "../../store/icebergStore";

/** Returns true if this node or any descendant matches the search term */
function nodeMatchesSearch(node: SchemaNode, term: string): boolean {
  if (node.name.toLowerCase().includes(term)) return true;
  if (node.children) return node.children.some((c) => nodeMatchesSearch(c, term));
  return false;
}

export function SchemaTree() {
  const { tree, search } = useSchemaStore();
  const term = search.trim().toLowerCase();

  const visibleNodes = term
    ? tree.filter((node) => nodeMatchesSearch(node, term))
    : tree;

  return (
    <div className="schema-tree">
      {visibleNodes.map((node) => (
        <SchemaTreeNode key={node.path} node={node} depth={0} searchTerm={term} />
      ))}
    </div>
  );
}

function SchemaTreeNode({ node, depth, searchTerm }: { node: SchemaNode; depth: number; searchTerm: string }) {
  const { expandNode, collapseNode } = useSchemaStore();
  const { activeConnectionId } = useConnectionStore();
  const { tabs, activeTabId, addTab, updateTabSql } = useQueryStore();
  const { setExploredTable } = useIcebergStore();

  const toggle = () => {
    if (node.type === "table") return;
    if (node.isExpanded) {
      collapseNode(node.path);
    } else {
      if (activeConnectionId) {
        expandNode(activeConnectionId, node.path);
      }
    }
  };

  const loadSql = (sql: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab && tab.sql.trim() === "") {
      updateTabSql(tab.id, sql);
    } else {
      // Open in new tab
      addTab();
      // The new tab becomes active — update it on next tick
      setTimeout(() => {
        const store = useQueryStore.getState();
        updateTabSql(store.activeTabId, sql);
      }, 0);
    }
  };

  const handlePreviewData = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parts = node.path.split(".");
    const [catalog, schema, table] = parts;
    loadSql(`SELECT *\nFROM "${catalog}"."${schema}"."${table}"\nLIMIT 100`);
  };

  const handleOpenIceberg = (e: React.MouseEvent) => {
    e.stopPropagation();
    const [catalog, schema, table] = node.path.split(".");
    setExploredTable({ catalog, schema, table });
  };

  const handlePreviewFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parts = node.path.split(".");
    const [catalog, schema, table] = parts;
    loadSql(
      `-- Parquet files backing ${table}\n` +
      `SELECT\n` +
      `  file_path,\n` +
      `  file_format,\n` +
      `  record_count,\n` +
      `  ROUND(file_size_in_bytes / 1024.0 / 1024.0, 2) AS size_mb,\n` +
      `  readable_metrics\n` +
      `FROM "${catalog}"."${schema}"."${table}$files"\n` +
      `ORDER BY file_size_in_bytes DESC`
    );
  };

  const Icon =
    node.type === "catalog" ? Database : node.type === "schema" ? Layers : Table;

  return (
    <>
      <div
        className={`schema-tree-node schema-tree-node--${node.type}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={node.type === "table" ? handlePreviewData : toggle}
        title={node.type === "table" ? node.path : undefined}
      >
        {node.type !== "table" && (
          <span className="tree-chevron">
            {node.isLoading ? (
              <span className="spinner" />
            ) : node.isExpanded ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )}
          </span>
        )}
        <Icon size={13} className={`tree-icon tree-icon--${node.type}`} />
        <span className="tree-label">{node.name}</span>

        {node.type === "table" && (
          <span className="tree-actions">
            <button
              className="tree-action-btn"
              onClick={handlePreviewData}
              title="Preview data (SELECT * LIMIT 100)"
            >
              <Play size={10} />
            </button>
            <button
              className="tree-action-btn tree-action-btn--files"
              onClick={handlePreviewFiles}
              title="View Parquet files ($files metadata)"
            >
              <FileText size={10} />
            </button>
            <button
              className="tree-action-btn tree-action-btn--iceberg"
              onClick={handleOpenIceberg}
              title="Open Iceberg Explorer"
            >
              <Snowflake size={10} />
            </button>
          </span>
        )}
      </div>
      {(node.isExpanded || searchTerm) && node.children && (
        <>
          {node.children
            .filter((child) => !searchTerm || nodeMatchesSearch(child, searchTerm))
            .map((child) => (
              <SchemaTreeNode key={child.path} node={child} depth={depth + 1} searchTerm={searchTerm} />
            ))}
        </>
      )}
    </>
  );
}
