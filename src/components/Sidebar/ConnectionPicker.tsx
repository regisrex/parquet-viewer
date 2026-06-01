import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useConnectionStore } from "../../store/connectionStore";
import { ConnectionModal } from "../Modals/ConnectionModal";

export function ConnectionPicker() {
  const { connections, activeConnectionId, setActiveConnection } =
    useConnectionStore();
  const [showModal, setShowModal] = useState(false);

  const active = connections.find((c) => c.id === activeConnectionId);

  return (
    <>
      <div className="connection-picker">
        <span className={`status-dot ${active ? "" : "status-dot--disconnected"}`} />
        <div className="connection-select-wrapper">
          <select
            value={activeConnectionId ?? ""}
            onChange={(e) => setActiveConnection(e.target.value)}
          >
            {connections.length === 0 && (
              <option value="" disabled>
                No connections
              </option>
            )}
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="select-chevron" />
        </div>
        <button
          className="icon-btn"
          title="New connection"
          onClick={() => setShowModal(true)}
        >
          <Plus size={14} />
        </button>
      </div>
      {showModal && <ConnectionModal onClose={() => setShowModal(false)} />}
    </>
  );
}
