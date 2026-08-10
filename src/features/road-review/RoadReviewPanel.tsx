import { useState, useCallback } from "react";
import { COPY } from "@/content/id";
import type { RoadSegment } from "@/domain/route";
import type { RoadSelection } from "@/domain/road";
import { RoadSegmentList } from "./RoadSegmentList";
import { getRoadDisplayName, getRoadDescription } from "@/domain/road";

interface Props {
  segments: readonly RoadSegment[];
  routeLength: number;
  onAvoid: (selection: RoadSelection) => void;
  onExtend: (selection: RoadSelection) => void;
  onExit: () => void;
  activeExclusions: number;
}

export function RoadReviewPanel({
  segments,
  routeLength,
  onAvoid,
  onExtend,
  onExit,
  activeExclusions,
}: Props) {
  const [selected, setSelected] = useState<RoadSegment | null>(null);

  const handleSelect = useCallback((seg: RoadSegment) => {
    setSelected((prev) => (prev?.id === seg.id ? null : seg));
  }, []);

  const handleAvoid = () => {
    if (!selected) return;
    onAvoid({
      startShapeIndex: selected.beginShapeIndex,
      endShapeIndex: selected.endShapeIndex,
      segmentIds: [selected.id],
    });
    setSelected(null);
  };

  const handleExtend = () => {
    if (!selected) return;
    onExtend({
      startShapeIndex: selected.beginShapeIndex,
      endShapeIndex: selected.endShapeIndex,
      segmentIds: [selected.id],
    });
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      padding: "var(--space-4)",
      maxWidth: "480px",
      margin: "0 auto",
      width: "100%",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
          {COPY.roadReviewTitle}
        </h2>
        <button onClick={onExit} className="btn btn-ghost">
          {COPY.exitReview}
        </button>
      </div>

      {segments.length === 0 && (
        <p style={{ color: "var(--color-text-tertiary)", textAlign: "center" }}>
          {COPY.metadataUnavailable}
        </p>
      )}

      <RoadSegmentList
        segments={segments}
        selectedId={selected?.id ?? null}
        onSelect={handleSelect}
        routeLength={routeLength}
      />

      {selected && (
        <div style={{
          padding: "var(--space-4)",
          background: "var(--color-surface-alt)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>
              {getRoadDisplayName(selected)}
            </div>
            <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
              {getRoadDescription(selected, routeLength)}
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button onClick={handleAvoid} className="btn btn-danger" style={{ flex: 1 }}>
              {COPY.avoidRoad}
            </button>
            <button onClick={handleExtend} className="btn btn-secondary" style={{ flex: 1 }}>
              {COPY.extendArea}
            </button>
          </div>
        </div>
      )}

      {activeExclusions > 0 && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", textAlign: "center" }}>
          {COPY.activeExclusions}: {activeExclusions}
        </p>
      )}
    </div>
  );
}
