import { useHistoryStore } from "../../store/historyStore";
import { useQueryStore } from "../../store/queryStore";
import { formatElapsed, formatRowCount } from "../../lib/format";

export function RecentQueries() {
  const { entries } = useHistoryStore();
  const { tabs, activeTabId, updateTabSql } = useQueryStore();

  if (entries.length === 0) return null;

  const loadQuery = (sql: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab) updateTabSql(tab.id, sql);
  };

  return (
    <div className="recent-queries">
      <div className="recent-queries-header">RECENT</div>
      {entries.slice(0, 10).map((entry) => (
        <div
          key={entry.id}
          className="recent-query-item"
          onClick={() => loadQuery(entry.sql_text)}
          title={entry.sql_text}
        >
          <span className="recent-query-sql">
            {entry.sql_text.replace(/\s+/g, " ").slice(0, 50)}
            {entry.sql_text.length > 50 ? "…" : ""}
          </span>
          <span className="recent-query-meta">
            {entry.row_count !== null && formatRowCount(entry.row_count)}
            {entry.elapsed_ms !== null && ` · ${formatElapsed(entry.elapsed_ms)}`}
          </span>
        </div>
      ))}
    </div>
  );
}
