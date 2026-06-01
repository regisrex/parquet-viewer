import { Play } from "lucide-react";
import { QueryTabs } from "./QueryTabs";
import { SqlEditor } from "./SqlEditor";
import { InlineStats } from "./InlineStats";
import { useQueryStore } from "../../store/queryStore";
import { useConnectionStore } from "../../store/connectionStore";
import { useHistoryStore } from "../../store/historyStore";
import { tauriInvoke } from "../../lib/tauri";
import type { QueryResult } from "../../types";

export function EditorPanel() {
  const { tabs, activeTabId, updateTabSql, setTabResult, setTabError, setTabRunning } =
    useQueryStore();
  const { activeConnectionId } = useConnectionStore();
  const { loadHistory } = useHistoryStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const runQuery = async () => {
    if (!activeTab || !activeConnectionId || activeTab.isRunning) return;
    const sql = activeTab.sql.trim();
    if (!sql) return;

    setTabRunning(activeTab.id, true);
    try {
      const result = await tauriInvoke<QueryResult>("run_query", {
        sql,
        connectionId: activeConnectionId,
      });
      setTabResult(activeTab.id, result);
      loadHistory(activeConnectionId);
    } catch (err) {
      setTabError(activeTab.id, err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="editor-panel">
      <div className="editor-toolbar">
        <QueryTabs />
        <button
          className="run-button"
          onClick={runQuery}
          disabled={!activeTab || activeTab.isRunning || !activeConnectionId}
          title="Run (⌘↩)"
        >
          <Play size={12} />
          Run
          <span className="run-shortcut">⌘↩</span>
        </button>
      </div>
      <SqlEditor
        value={activeTab?.sql ?? ""}
        onChange={(sql) => activeTab && updateTabSql(activeTab.id, sql)}
        onRun={runQuery}
      />
      <InlineStats
        result={activeTab?.result ?? null}
        isRunning={activeTab?.isRunning ?? false}
        error={activeTab?.error ?? null}
      />
    </div>
  );
}
