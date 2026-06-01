import { useState } from "react";
import { Modal } from "./Modal";
import { useConnectionStore } from "../../store/connectionStore";

interface ConnectionModalProps {
  onClose: () => void;
}

export function ConnectionModal({ onClose }: ConnectionModalProps) {
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const [form, setForm] = useState({
    name: "prod-trino-01",
    host: "http://localhost:8080",
    username: "dbt_runner",
    catalog: "iceberg",
    schema_name: "raw",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveConnection({
        name: form.name.trim(),
        host: form.host.trim().replace(/\/$/, ""),
        username: form.username.trim() || "user",
        catalog: form.catalog.trim() || null,
        schema_name: form.schema_name.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-title">New connection</div>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Connection name</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="prod-trino-01"
            required
            autoFocus
          />
        </div>
        <div className="form-field">
          <label>Host</label>
          <input
            value={form.host}
            onChange={(e) => set("host", e.target.value)}
            placeholder="http://localhost:8080"
            required
          />
        </div>
        <div className="form-field">
          <label>Username</label>
          <input
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            placeholder="user"
          />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Default catalog</label>
            <input
              value={form.catalog}
              onChange={(e) => set("catalog", e.target.value)}
              placeholder="iceberg"
            />
          </div>
          <div className="form-field">
            <label>Default schema</label>
            <input
              value={form.schema_name}
              onChange={(e) => set("schema_name", e.target.value)}
              placeholder="raw"
            />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Connecting…" : "Save connection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
