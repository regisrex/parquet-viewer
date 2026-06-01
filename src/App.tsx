import { useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { EditorPanel } from "./components/Editor/EditorPanel";
import { ResultsPanel } from "./components/Results/ResultsPanel";
import { IcebergExplorer } from "./components/Iceberg/IcebergExplorer";
import { ParquetViewer } from "./components/ParquetViewer/ParquetViewer";
import { ConnectionModal } from "./components/Modals/ConnectionModal";
import { useConnectionStore } from "./store/connectionStore";
import { useSchemaStore } from "./store/schemaStore";
import { useHistoryStore } from "./store/historyStore";
import { useQueryStore } from "./store/queryStore";
import { useIcebergStore } from "./store/icebergStore";
import { useParquetStore } from "./store/parquetStore";

export default function App() {
  const { connections, activeConnectionId, loadConnections } = useConnectionStore();
  const { loadCatalogs } = useSchemaStore();
  const { loadHistory } = useHistoryStore();
  const { addTab } = useQueryStore();
  const { exploredTable } = useIcebergStore();
  const { openFile, isLoading: parquetLoading } = useParquetStore();
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  // Show modal when no connections
  useEffect(() => {
    if (connections.length === 0) {
      setShowConnectionModal(true);
    } else {
      setShowConnectionModal(false);
    }
  }, [connections.length]);

  // Load schema tree and history when active connection changes
  useEffect(() => {
    if (activeConnectionId) {
      const conn = connections.find((c) => c.id === activeConnectionId);
      loadCatalogs(activeConnectionId, conn?.catalog);
      loadHistory(activeConnectionId);
    }
  }, [activeConnectionId]);

  // Cmd+T: new tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        e.preventDefault();
        addTab();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addTab]);

  return (
    <>
      <div className="app-root">
        <PanelGroup direction="horizontal" className="panel-group">
          <Panel defaultSize={22} minSize={15} maxSize={35} className="sidebar-panel-wrapper">
            <Sidebar />
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel className="main-panel">
            {(openFile || parquetLoading) ? (
              <ParquetViewer />
            ) : exploredTable ? (
              <IcebergExplorer />
            ) : (
              <PanelGroup direction="vertical">
                <Panel defaultSize={55} minSize={25} className="editor-panel-wrapper">
                  <EditorPanel />
                </Panel>
                <PanelResizeHandle className="resize-handle resize-handle--h" />
                <Panel defaultSize={45} minSize={15} className="results-panel-wrapper">
                  <ResultsPanel />
                </Panel>
              </PanelGroup>
            )}

          </Panel>
        </PanelGroup>
      </div>

      {showConnectionModal && (
        <ConnectionModal
          onClose={() => {
            if (connections.length > 0) setShowConnectionModal(false);
          }}
        />
      )}
    </>
  );
}
