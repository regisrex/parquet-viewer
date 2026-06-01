import { useQueryStore } from "../../store/queryStore";
import { StatsBar } from "./StatsBar";
import { DataGrid } from "./DataGrid";

export function ResultsPanel() {
  const { tabs, activeTabId } = useQueryStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab?.result) {
    return (
      <div className="results-panel results-panel--empty">
        {activeTab?.isRunning ? (
          <span className="results-empty-text">Running query…</span>
        ) : activeTab?.error ? (
          <div className="results-error">
            <span className="results-error-label">Error</span>
            <pre className="results-error-message">{activeTab.error}</pre>
          </div>
        ) : (
          <span className="results-empty-text">Run a query to see results</span>
        )}
      </div>
    );
  }

  return (
    <div className="results-panel">
      <StatsBar result={activeTab.result} />
      <DataGrid result={activeTab.result} />
    </div>
  );
}
