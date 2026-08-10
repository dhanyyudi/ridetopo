import { COPY } from "@/content/id";
import type { RouteLocation } from "@/domain/location";
import { LocationField } from "./LocationField";
import { PRODUCT_LIMITS } from "@/domain/route";

interface Props {
  locations: RouteLocation[];
  onAddWaypoint: () => void;
  onRemoveLocation: (id: string) => void;
  onOpenSearch: (location: RouteLocation) => void;
  onOpenMapPicker: (location: RouteLocation) => void;
  onUseGeolocation: (location: RouteLocation) => void;
  onSwap: () => void;
}

export function WaypointList({
  locations,
  onAddWaypoint,
  onRemoveLocation,
  onOpenSearch,
  onOpenMapPicker,
  onUseGeolocation,
  onSwap,
}: Props) {
  const atMax = locations.filter((l) => l.role === "waypoint").length >= PRODUCT_LIMITS.maxIntermediateWaypoints;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {locations.map((loc, idx) => (
        <LocationField
          key={loc.id}
          location={loc}
          index={idx}
          total={locations.length}
          onRemove={() => onRemoveLocation(loc.id)}
          onOpenSearch={() => onOpenSearch(loc)}
          onOpenMapPicker={() => onOpenMapPicker(loc)}
          onUseGeolocation={() => onUseGeolocation(loc)}
        />
      ))}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {!atMax && (
          <button
            onClick={onAddWaypoint}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            + {COPY.addWaypoint}
          </button>
        )}
        {atMax && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", alignSelf: "center" }}>
            {COPY.maxWaypointReached}
          </span>
        )}

        {locations.length >= 2 && (
          <button onClick={onSwap} className="btn btn-ghost" aria-label={COPY.swapDirections}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
