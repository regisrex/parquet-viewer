import type { QueryResult } from "../../types";
import { formatElapsed, formatRowCount } from "../../lib/format";

interface InlineStatsProps {
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
}

export function InlineStats({ result, isRunning, error }: InlineStatsProps) {
  if (isRunning) {
    return <div className="inline-stats inline-stats--running">Running…</div>;
  }
  if (error) {
    return <div className="inline-stats inline-stats--error">{error}</div>;
  }
  if (!result) return <div className="inline-stats" />;
  return (
    <div className="inline-stats">
      — {formatRowCount(result.row_count)} · {formatElapsed(result.elapsed_ms)}
    </div>
  );
}
