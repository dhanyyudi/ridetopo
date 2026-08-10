import { useCallback } from "react";
import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import { WaypointList } from "@/features/location/WaypointList";
import { RoundTripControl } from "./RoundTripControl";
import { RouteResultPanel } from "./RouteResultPanel";
import { createLocationId, type RouteLocation } from "@/domain/location";
import type { Position } from "@/domain/geo";
import { PRODUCT_LIMITS } from "@/domain/route";

export function RouteComposer() {
  const store = useRoutePlannerStore();

  const handleAddWaypoint = useCallback(() => {
    const wpCount = store.locations.filter((l) => l.role === "waypoint").length;
    if (wpCount >= PRODUCT_LIMITS.maxIntermediateWaypoints) return;

    const insertAt = store.locations.length > 0 ? store.locations.length - 1 : 0;
    const newLoc: RouteLocation = {
      id: createLocationId(),
      role: "waypoint",
      position: [0, 0] as Position,
      label: "",
      source: "search",
    };
    const updated = [...store.locations];
    updated.splice(insertAt, 0, newLoc);
    store.setLocations(updated);
  }, [store]);

  const handleRemoveLocation = useCallback(
    (id: string) => {
      if (store.locations.length <= 2 && !store.locations.find((l) => l.id === id)?.role.includes("waypoint")) return;
      store.removeLocation(id);
    },
    [store],
  );

  const handleOpenSearch = useCallback((_loc: RouteLocation) => {
    // TODO: implement search dialog
  }, []);

  const handleOpenMapPicker = useCallback((_loc: RouteLocation) => {
    // TODO: implement map picker
  }, []);

  const handleUseGeolocation = useCallback((_loc: RouteLocation) => {
    // TODO: implement geolocation
  }, []);

  if (store.lastValidRoute && !store.routeError) {
    return (
      <RouteResultPanel
        route={store.lastValidRoute}
        onReviewRoad={() => {}}
        onBack={() => store.setLastValidRoute(null)}
      />
    );
  }

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
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>
        {COPY.navComposer}
      </h2>

      <WaypointList
        locations={store.locations}
        onAddWaypoint={handleAddWaypoint}
        onRemoveLocation={handleRemoveLocation}
        onOpenSearch={handleOpenSearch}
        onOpenMapPicker={handleOpenMapPicker}
        onUseGeolocation={handleUseGeolocation}
        onSwap={store.swapDirections}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
        <div>
          <label className="field-label">{COPY.profileLabel}</label>
          <select
            value={store.profile}
            onChange={(e) => store.setProfile(e.target.value as typeof store.profile)}
            className="text-input"
          >
            <option value="road-bike">{COPY.roadBike}</option>
            <option value="commuter-bike">{COPY.commuterBike}</option>
          </select>
        </div>
        <div>
          <label className="field-label">{COPY.roadPreference}</label>
          <select
            value={store.roadPreference}
            onChange={(e) => store.setRoadPreference(e.target.value as typeof store.roadPreference)}
            className="text-input"
          >
            <option value="standard">{COPY.standardRoad}</option>
            <option value="small-roads">{COPY.smallRoads}</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
        <div>
          <label className="field-label">{COPY.terrainPreference}</label>
          <select
            value={store.terrainPreference}
            onChange={(e) => store.setTerrainPreference(e.target.value as typeof store.terrainPreference)}
            className="text-input"
          >
            <option value="standard">{COPY.standardTerrain}</option>
            <option value="flatter">{COPY.flatter}</option>
          </select>
        </div>
      </div>

      <RoundTripControl
        enabled={store.returnToStart}
        mode={store.returnMode}
        onToggle={store.setReturnToStart}
        onModeChange={store.setReturnMode}
      />

      <button
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={store.isCalculating || store.locations.length < 2}
      >
        {store.isCalculating ? COPY.calculating : COPY.planRoute}
      </button>
    </div>
  );
}
