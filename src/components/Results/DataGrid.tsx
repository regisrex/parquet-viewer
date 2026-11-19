import { useRef, useState, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import type { QueryResult } from "../../types";
import { RowDetailPanel } from "./RowDetailPanel";
import { isJsonLike } from "../../lib/format";

interface DataGridProps {
  result: QueryResult;
}

const ROW_HEIGHT = 32;
/** Below this per-column width the grid stops shrinking and scrolls instead. */
const MIN_FIT_COL_WIDTH = 90;
/** Detail panel sizes, in percent of the grid container width. */
const DETAIL_DEFAULT_SIZE = 30;
const DETAIL_MIN_SIZE = 15;
const DETAIL_MAX_SIZE = 85;
const DETAIL_MAXIMIZED_SIZE = 80;

export function DataGrid({ result }: DataGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<ImperativePanelHandle>(null);
  const restoreSizeRef = useRef(DETAIL_DEFAULT_SIZE);

  // Selection is tied to the result it was made in, so a new result never
  // shows a stale row index.
  const [selection, setSelection] = useState<{ result: QueryResult; index: number } | null>(null);
  const selectedRow = selection?.result === result ? selection.index : null;
  const setSelectedRow = (index: number | null) =>
    setSelection(index === null ? null : { result, index });

  const [isMaximized, setIsMaximized] = useState(false);
  const [bodyWidth, setBodyWidth] = useState(0);

  const colCount = result.columns.length;
  const naturalColWidth = Math.max(140, Math.min(280, Math.floor(1000 / colCount)));
  // Shrink (or grow) columns to fill the visible width when they still stay
  // readable; otherwise fall back to fixed widths with horizontal scrolling.
  const fits = bodyWidth > 0 && bodyWidth / colCount >= MIN_FIT_COL_WIDTH;
  const colWidth = fits ? Math.floor(bodyWidth / colCount) : naturalColWidth;
  const totalWidth = colWidth * colCount;
  const gridCols = `repeat(${colCount}, ${colWidth}px)`;

  // Track the body's inner width (excludes the vertical scrollbar, so header
  // and rows stay aligned).
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: result.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  const handleBodyScroll = () => {
    if (headerRef.current && parentRef.current) {
      headerRef.current.scrollLeft = parentRef.current.scrollLeft;
    }
  };

  const toggleMaximize = () => {
    const panel = detailPanelRef.current;
    if (!panel) return;
    if (isMaximized) {
      panel.resize(restoreSizeRef.current);
    } else {
      restoreSizeRef.current = panel.getSize();
      panel.resize(DETAIL_MAXIMIZED_SIZE);
    }
  };

  const showDetail = selectedRow !== null && result.rows[selectedRow] !== undefined;

  return (
    <div
      className="data-grid-container"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && showDetail) {
          e.stopPropagation();
          setSelectedRow(null);
        }
      }}
    >
      <PanelGroup direction="horizontal" autoSaveId="row-detail-layout">
        <Panel id="grid" order={1} minSize={100 - DETAIL_MAX_SIZE}>
          <div className="data-grid-wrapper">
            {/* Header */}
            <div ref={headerRef} className="data-grid-header">
              <div className="data-grid-header-row" style={{ gridTemplateColumns: gridCols, width: totalWidth }}>
                {result.columns.map((col) => (
                  <div key={col.name} className="data-grid-header-cell" title={`${col.name} (${col.type_name})`}>
                    <span className="col-name">{col.name}</span>
                    <span className="col-type">{col.type_name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <div ref={parentRef} className="data-grid-body" onScroll={handleBodyScroll}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: totalWidth, position: "relative" }}>
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
                        width: totalWidth,
                        height: ROW_HEIGHT,
                      }}
                      onClick={() => setSelectedRow(isSelected ? null : virtualRow.index)}
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
        </Panel>

        {/* Row detail side panel — resizable, can be maximized */}
        {showDetail && (
          <>
            <PanelResizeHandle
              className="resize-handle"
              onDoubleClick={toggleMaximize}
              title="Drag to resize · double-click to expand/restore"
            />
            <Panel
              id="row-detail"
              order={2}
              ref={detailPanelRef}
              defaultSize={DETAIL_DEFAULT_SIZE}
              minSize={DETAIL_MIN_SIZE}
              maxSize={DETAIL_MAX_SIZE}
              onResize={(size) => setIsMaximized(size >= DETAIL_MAXIMIZED_SIZE - 0.5)}
            >
              <RowDetailPanel
                row={result.rows[selectedRow]}
                rowIndex={selectedRow}
                columns={result.columns}
                isMaximized={isMaximized}
                onToggleMaximize={toggleMaximize}
                onClose={() => setSelectedRow(null)}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
