import type { RoadSegment } from "@/domain/route";
import { getRoadDisplayName, getRoadDescription } from "@/domain/road";

interface Props {
  segments: readonly RoadSegment[];
  selectedId: string | null;
  onSelect: (segment: RoadSegment) => void;
  routeLength: number;
}

export function RoadSegmentList({ segments, selectedId, onSelect, routeLength }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--color-border)" }}>
      {segments.map((seg) => (
        <button
          key={seg.id}
          onClick={() => onSelect(seg)}
          style={{
            textAlign: "left",
            padding: "0.75rem",
            background: selectedId === seg.id ? "var(--color-primary-light)" : "var(--color-white)",
            borderLeft: selectedId === seg.id ? "3px solid var(--color-primary)" : "3px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              {getRoadDisplayName(seg)}
            </div>
            <div style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)" }}>
              {getRoadDescription(seg, routeLength)}
            </div>
          </div>
          {selectedId === seg.id && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
