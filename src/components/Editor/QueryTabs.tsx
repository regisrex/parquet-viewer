import { Plus, X } from "lucide-react";
import { useQueryStore } from "../../store/queryStore";

export function QueryTabs() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useQueryStore();

  return (
    <div className="query-tabs">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`query-tab ${tab.id === activeTabId ? "query-tab--active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.isRunning && <span className="tab-spinner" />}
          {tab.title}
          {tabs.length > 1 && (
            <span
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X size={10} />
            </span>
          )}
        </div>
      ))}
      <button className="tab-add-btn" onClick={addTab} title="New tab (⌘T)">
        <Plus size={13} />
      </button>
    </div>
  );
}
