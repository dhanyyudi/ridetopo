import { useCallback } from "react";
import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import { WaypointList } from "@/features/location/WaypointList";
import { RoundTripControl } from "./RoundTripControl";
import type { EditableRouteLocation } from "@/domain/location";
import type { useRoutePlannerController } from "./use-route-planner-controller";
import { Navigation } from "lucide-react";

interface Props {
  controller: ReturnType<typeof useRoutePlannerController>;
  offline: boolean;
}

export function RouteComposer({ controller, offline }: Props) {
  const store = useRoutePlannerStore();

  const handleOpenSearch = useCallback(
    (loc: EditableRouteLocation) => {
      store.setSearchDialog({ open: true, targetId: loc.id });
    },
    [store],
  );

  const handleOpenMapPicker = useCallback(
    (loc: EditableRouteLocation) => {
      store.setMapPicker({ open: true, targetId: loc.id });
    },
    [store],
  );

  const handleUseGeolocation = useCallback(
    (loc: EditableRouteLocation) => {
      controller.useGeolocation(loc.id);
    },
    [controller],
  );

  const handleReorder = useCallback(
    (fromId: string, toId: string) => {
      const locations = useRoutePlannerStore.getState().locations;
      const fromIdx = locations.findIndex((l) => l.id === fromId);
      const toIdx = locations.findIndex((l) => l.id === toId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      useRoutePlannerStore.getState().reorderWaypoint(fromIdx, toIdx);
    },
    [],
  );

  const hasValidRoute = store.lastValidRoute !== null;
  const canPlan = store.locations.length >= 2 && !offline;
  /* The round-trip toggle only makes sense once there is an A and a B. */
  const hasEndpoints =
    store.locations.some((l) => l.role === "origin" && l.position !== null) &&
    store.locations.some((l) => l.role === "destination" && l.position !== null);

  return (
    <div className="composer">
      <div className="composer-scroll">
        <h1 className="composer-title">{COPY.navComposer}</h1>
        <p className="composer-subtitle">{COPY.appTagline}</p>

        <WaypointList
          locations={store.locations}
          onAddWaypoint={controller.addWaypoint}
          onRemoveLocation={controller.removeLocation}
          onOpenSearch={handleOpenSearch}
          onOpenMapPicker={handleOpenMapPicker}
          onUseGeolocation={handleUseGeolocation}
          onMoveWaypoint={controller.moveWaypoint}
          onSwap={controller.swapDirections}
          onReorder={handleReorder}
        />

        {store.locationNotice && (
          <p className="inline-error" role="status">
            {store.locationNotice}
          </p>
        )}

        {hasEndpoints && (
          <RoundTripControl
            enabled={store.returnToStart}
            mode={store.returnMode}
            onToggle={(v) => controller.setPreference({ returnToStart: v })}
            onModeChange={(m) => controller.setPreference({ returnMode: m })}
          />
        )}

        <section className="composer-section" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="section-title">
            {COPY.profileLabel}
          </h2>
          <div className="segmented" role="radiogroup" aria-label={COPY.profileLabel}>
            <button
              type="button"
              role="radio"
              aria-checked={store.profile === "road-bike"}
              className={store.profile === "road-bike" ? "segmented-item active" : "segmented-item"}
              onClick={() => controller.setPreference({ profile: "road-bike" })}
            >
              {COPY.roadBike}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={store.profile === "commuter-bike"}
              className={store.profile === "commuter-bike" ? "segmented-item active" : "segmented-item"}
              onClick={() => controller.setPreference({ profile: "commuter-bike" })}
            >
              {COPY.commuterBike}
            </button>
          </div>
        </section>

        <section className="composer-section" aria-labelledby="road-pref-heading">
          <h2 id="road-pref-heading" className="section-title">
            {COPY.roadPreference}
          </h2>
          <div className="segmented" role="radiogroup" aria-label={COPY.roadPreference}>
            <button
              type="button"
              role="radio"
              aria-checked={store.roadPreference === "standard"}
              className={store.roadPreference === "standard" ? "segmented-item active" : "segmented-item"}
              onClick={() => controller.setPreference({ roadPreference: "standard" })}
            >
              {COPY.standardRoad}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={store.roadPreference === "small-roads"}
              className={store.roadPreference === "small-roads" ? "segmented-item active" : "segmented-item"}
              onClick={() => controller.setPreference({ roadPreference: "small-roads" })}
            >
              {COPY.smallRoads}
            </button>
          </div>
          <p className="section-helper">{COPY.roadPreferenceHelper}</p>
        </section>

        <section className="composer-section" aria-labelledby="terrain-pref-heading">
          <h2 id="terrain-pref-heading" className="section-title">
            {COPY.terrainPreference}
          </h2>
          <div className="segmented" role="radiogroup" aria-label={COPY.terrainPreference}>
            <button
              type="button"
              role="radio"
              aria-checked={store.terrainPreference === "standard"}
              className={store.terrainPreference === "standard" ? "segmented-item active" : "segmented-item"}
              onClick={() => controller.setPreference({ terrainPreference: "standard" })}
            >
              {COPY.standardTerrain}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={store.terrainPreference === "flatter"}
              className={store.terrainPreference === "flatter" ? "segmented-item active" : "segmented-item"}
              onClick={() => controller.setPreference({ terrainPreference: "flatter" })}
            >
              {COPY.flatter}
            </button>
          </div>
          <p className="section-helper">{COPY.terrainPreferenceHelper}</p>
        </section>
      </div>

      <div className="composer-footer">
        {store.routeError && (
          <p className="inline-error" role="alert">
            {store.routeError}
          </p>
        )}
        {offline && (
          <p className="inline-hint" role="status">
            {COPY.offlineRouteDisabled}
          </p>
        )}
        {store.changesUnapplied && !store.routeError && (
          <p className="inline-hint" role="status">
            {COPY.unappliedChanges}
          </p>
        )}
        {hasValidRoute && store.routeError && (
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={() => store.setAppView("result")}
          >
            {COPY.viewPreviousRoute}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary composer-cta"
          onClick={() => void controller.planExplicitly()}
          disabled={!canPlan || store.isCalculating}
        >
          {store.isCalculating ? (
            <>
              <span className="loading-spinner small" aria-hidden="true" />
              {COPY.calculating}
            </>
          ) : (
            <>
              <Navigation size={18} aria-hidden="true" />
              {COPY.planRoute}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
