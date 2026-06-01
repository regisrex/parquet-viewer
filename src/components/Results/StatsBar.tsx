import { Clock, Hash, Download } from "lucide-react";
import type { QueryResult } from "../../types";
import { formatElapsed, formatRowCount } from "../../lib/format";
import { exportToCsv } from "../../lib/exportCsv";

interface StatsBarProps {
  result: QueryResult;
}

export function StatsBar({ result }: StatsBarProps) {
  return (
    <div className="stats-bar">
      <span className="stat">
        <Hash size={11} />
        {formatRowCount(result.row_count)}
      </span>
      <span className="stat">
        <Clock size={11} />
        {formatElapsed(result.elapsed_ms)}
      </span>
      <button
        className="export-btn"
        onClick={() => exportToCsv(result)}
        title="Export to CSV"
      >
        <Download size={11} />
        Export
      </button>
    </div>
  );
}
