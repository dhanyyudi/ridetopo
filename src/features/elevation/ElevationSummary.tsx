import type { AnalyzedElevation } from "@/domain/elevation";
import { formatElevation } from "@/lib/format-id";
import { COPY } from "@/content/id";

interface Props {
  elevation: AnalyzedElevation;
}

export function ElevationSummary({ elevation }: Props) {
  if (!elevation.complete) {
    return (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", textAlign: "center" }}>
        {COPY.elevationUnavailable}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
      {elevation.gainMeters != null && (
        <div className="badge badge-orange" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)" }}>
          {COPY.elevationGain}: {formatElevation(elevation.gainMeters)}
        </div>
      )}
      {elevation.lossMeters != null && (
        <div className="badge badge-blue" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)" }}>
          {COPY.elevationLoss}: {formatElevation(elevation.lossMeters)}
        </div>
      )}
    </div>
  );
}
