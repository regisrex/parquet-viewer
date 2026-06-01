import { useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { QueryResult } from "../../types";
import { RowDetailPanel } from "./RowDetailPanel";
import { isJsonLike } from "../../lib/format";

interface DataGridProps {
  result: QueryResult;
}

const ROW_HEIGHT = 32;

export function DataGrid({ result }: DataGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const colCount = result.columns.length;
  const colWidth = Math.max(140, Math.min(280, Math.floor(1000 / colCount)));
  const gridCols = `repeat(${colCount}, ${colWidth}px)`;

  // Close detail panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedRow(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: result.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  return (
    <div className="data-grid-container">
      <div className="data-grid-wrapper" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="data-grid-header" style={{ gridTemplateColumns: gridCols }}>
          {result.columns.map((col) => (
            <div key={col.name} className="data-grid-header-cell">
              <span className="col-name">{col.name}</span>
              <span className="col-type">{col.type_name}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div ref={parentRef} className="data-grid-body">
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = result.rows[virtualRow.index];
              const isSelected = selectedRow === virtualRow.index;
              return (
                <div
                  key={virtualRow.key}
                  className={`data-grid-row ${isSelected ? "data-grid-row--selected" : ""}`}
                  style={{
                    gridTemplateColumns: gridCols,
                    position: "absolute",
                    top: virtualRow.start,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                  onClick={() =>
                    setSelectedRow(isSelected ? null : virtualRow.index)
                  }
                >
                  {row.map((cell, colIdx) => {
                    const isJson = cell !== null && isJsonLike(cell);
                    return (
                      <div
                        key={colIdx}
                        className={`data-grid-cell ${isJson ? "data-grid-cell--json" : ""}`}
                      >
                        {cell === null ? (
                          <span className="null-value">NULL</span>
                        ) : isJson ? (
                          <span className="json-badge">&#x7B;&#x7D; JSON</span>
                        ) : (
                          String(cell)
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row detail side panel */}
      {selectedRow !== null && result.rows[selectedRow] && (
        <RowDetailPanel
          row={result.rows[selectedRow]}
          columns={result.columns}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
