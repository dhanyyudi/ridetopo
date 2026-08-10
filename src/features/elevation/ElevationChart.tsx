import type { ElevationSample } from "@/domain/route";
import type { TerrainSection } from "@/domain/elevation";
interface Props {
  samples: readonly ElevationSample[];
  terrain: readonly TerrainSection[];
  width: number;
  height: number;
  cursor?: number | null;
  onCursorChange?: (distance: number) => void;
}

export function ElevationChart({ samples, terrain, width, height, cursor, onCursorChange }: Props) {
  if (samples.length < 2) {
    return (
      <div style={{
        width, height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-tertiary)",
        fontSize: "var(--text-sm)",
      }}>
        Data elevasi tidak tersedia
      </div>
    );
  }

  const padding = { top: 16, right: 12, bottom: 24, left: 0 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const validElevations = samples.filter((s) => s.elevationMeters !== null).map((s) => s.elevationMeters!);
  const minElev = validElevations.length > 0 ? Math.min(...validElevations) : 0;
  const maxElev = validElevations.length > 0 ? Math.max(...validElevations) : 100;
  const elevRange = maxElev - minElev || 1;

  const maxDist = samples[samples.length - 1]!.distanceMeters;
  const distScale = chartW / (maxDist || 1);
  const elevScale = chartH / elevRange;

  const points = samples
    .filter((s) => s.elevationMeters !== null)
    .map((s) => {
      const x = padding.left + s.distanceMeters * distScale;
      const y = padding.top + chartH - (s.elevationMeters! - minElev) * elevScale;
      return `${x},${y}`;
    });

  const pathD = points.length > 0 ? `M${points.join(" L")}` : "";

  const terrainRects = terrain.map((section, idx) => {
    const x1 = padding.left + section.startDistanceMeters * distScale;
    const x2 = padding.left + section.endDistanceMeters * distScale;
    const color =
      section.classification === "climb"
        ? "#EA580C"
        : section.classification === "descent"
          ? "#2563EB"
          : "#0F766E";
    return (
      <rect
        key={idx}
        x={x1}
        y={padding.top}
        width={Math.max(1, x2 - x1)}
        height={chartH}
        fill={color}
        opacity={0.15}
        rx={2}
      />
    );
  });

  const cursorX = cursor != null ? padding.left + cursor * distScale : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Grafik elevasi rute"
      onClick={(e) => {
        if (!onCursorChange) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dist = (x - padding.left) / distScale;
        onCursorChange(Math.max(0, Math.min(maxDist, dist)));
      }}
    >
      {terrainRects}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="#2DD4BF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {cursorX != null && (
        <line
          x1={cursorX}
          y1={padding.top}
          x2={cursorX}
          y2={padding.top + chartH}
          stroke="#0F766E"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
    </svg>
  );
}
