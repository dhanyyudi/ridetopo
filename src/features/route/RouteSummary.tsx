import type { RouteMetrics } from "@/domain/route";
import { formatDistance, formatDuration } from "@/lib/format-id";
import { COPY } from "@/content/id";

interface Props {
  metrics: RouteMetrics;
  roundTrip: boolean;
  limitedReturn: boolean;
}

export function RouteSummary({ metrics }: Props) {
  return (
    <div className="metrics-row">
      <div className="metric-block">
        <span className="metric-label">{COPY.routeDistance}</span>
        <span className="metric-value">{formatDistance(metrics.distanceMeters)}</span>
      </div>
      <div className="metric-block">
        <span className="metric-label">{COPY.routeDuration}</span>
        <span className="metric-value">{formatDuration(metrics.durationSeconds)}</span>
        <span className="metric-note">{COPY.durationDisclaimer}</span>
      </div>
    </div>
  );
}
