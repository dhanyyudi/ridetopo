import { TrendingUp, Minus, TrendingDown } from "lucide-react";
import { COPY } from "@/content/id";
import { TERRAIN_COLORS } from "@/features/map/map-layers";
import type { TerrainClass } from "@/domain/elevation";

const ITEMS: { key: TerrainClass; label: string; Icon: typeof TrendingUp }[] = [
  { key: "climb", label: COPY.terrainClimb, Icon: TrendingUp },
  { key: "flat", label: COPY.terrainFlat, Icon: Minus },
  { key: "descent", label: COPY.terrainDescent, Icon: TrendingDown },
];

/**
 * Terrain meaning must never rest on colour alone, so each band is named and
 * carries a shape of its own.
 */
export function TerrainLegend() {
  return (
    <ul className="terrain-legend" aria-label={COPY.terrainLegendLabel}>
      {ITEMS.map(({ key, label, Icon }) => (
        <li key={key} className="terrain-legend-item">
          <span
            className="terrain-legend-swatch"
            style={{ background: TERRAIN_COLORS[key] }}
            aria-hidden="true"
          />
          <Icon size={14} aria-hidden="true" color={TERRAIN_COLORS[key]} />
          <span className="terrain-legend-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
