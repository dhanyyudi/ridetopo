import type { RouteMetrics } from "@/domain/route";
import { formatDistance, formatElevation, formatDuration } from "@/lib/format-id";
import { COPY } from "@/content/id";

interface Props {
  metrics: RouteMetrics;
  roundTrip: boolean;
  limitedReturn: boolean;
}

export function RouteSummary({ metrics, roundTrip, limitedReturn }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="surface" style={{ padding: "var(--space-3)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>{COPY.routeDistance}</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {formatDistance(metrics.distanceMeters)}
          </div>
        </div>
        <div className="surface" style={{ padding: "var(--space-3)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>{COPY.routeDuration}</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {formatDuration(metrics.durationSeconds)}
          </div>
        </div>
      </div>

      {metrics.elevationGainMeters != null && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div className="badge badge-orange" style={{ justifyContent: "center", padding: "var(--space-2)" }}>
            {COPY.elevationGain}: {formatElevation(metrics.elevationGainMeters)}
          </div>
          {metrics.elevationLossMeters != null && (
            <div className="badge badge-blue" style={{ justifyContent: "center", padding: "var(--space-2)" }}>
              {COPY.elevationLoss}: {formatElevation(metrics.elevationLossMeters)}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", textAlign: "center" }}>
        {COPY.durationDisclaimer}
      </p>

      {roundTrip && (
        <div style={{
          textAlign: "center",
          padding: "var(--space-2)",
          background: "var(--color-primary-light)",
          borderRadius: "var(--radius-md)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--color-primary-dark)",
        }}>
          {limitedReturn ? COPY.limitedReturn : COPY.returnDifferentRoad}
        </div>
      )}
    </div>
  );
}
