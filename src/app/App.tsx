import { useEffect, useState, useCallback, useMemo } from "react";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppShell } from "./AppShell";
import { loadRuntimeConfig } from "@/config/load-runtime-config";
import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import { useRoutePlannerController } from "@/features/route/use-route-planner-controller";
import { RouteComposer } from "@/features/route/RouteComposer";
import { RouteResultPanel } from "@/features/route/RouteResultPanel";
import { RoadReviewPanel } from "@/features/road-review/RoadReviewPanel";
import { LocationSearchDialog } from "@/features/location/LocationSearchDialog";
import { MapPicker } from "@/features/location/MapPicker";
import { ImagePreviewDialog } from "@/features/export/ImagePreviewDialog";
import { MapCanvas, type MapMarker } from "@/features/map/MapCanvas";
import { createInitialLocations } from "@/domain/location";
import { loadPreferences } from "@/services/persistence/preference-storage";
import { getRouteElevation } from "@/services/routing/route-elevation";
import { cumulativeDistances } from "@/services/routing/calculate-overlap";
import {
  buildSegmentRanges,
  findSegmentAtDistance,
  segmentsWithinBounds,
  advanceCorridor,
  corridorRange,
} from "@/services/road/segment-ranges";
import { Trash2, RotateCcw } from "lucide-react";
import "@/styles/global.css";
import "@/styles/components.css";
import "@/styles/map.css";
import "@/styles/layout.css";

function PrivacyView() {
  return (
    <div className="info-page">
      <h1 className="info-title">{COPY.privacyTitle}</h1>
      <p className="info-body">{COPY.privacyText}</p>
    </div>
  );
}

function AboutView() {
  return (
    <div className="info-page">
      <h1 className="info-title">{COPY.aboutTitle}</h1>
      <p className="info-body">{COPY.aboutText}</p>
    </div>
  );
}

function RestorePrompt({
  onRestore,
  onDelete,
}: {
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="restore-prompt">
      <div className="restore-card" role="dialog" aria-label={COPY.draftPromptTitle}>
        <h1 className="restore-title">{COPY.draftPromptTitle}</h1>
        <p className="restore-body">{COPY.draftPromptBody}</p>
        <div className="restore-actions">
          <button type="button" className="btn btn-primary" onClick={onRestore}>
            <RotateCcw size={16} aria-hidden="true" />
            {COPY.continueDraft}
          </button>
          {confirming ? (
            <>
              <p className="restore-body" role="alert">
                {COPY.deleteDraftConfirm}
              </p>
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                {COPY.draftDeleteConfirm}
              </button>
              <button type="button" className="btn btn-tertiary" onClick={() => setConfirming(false)}>
                {COPY.draftKeep}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              <Trash2 size={16} aria-hidden="true" />
              {COPY.deleteDraft}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const store = useRoutePlannerStore();
  const controller = useRoutePlannerController();

  /* Config + offline */
  useEffect(() => {
    const controller = new AbortController();
    void loadRuntimeConfig(controller.signal)
      .then(() => setConfigReady(true))
      .catch(() => setConfigError(COPY.errorConfig));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;

    /* navigator.onLine is unreliable when a service worker serves
       everything, so probe reachability directly with a timeout. */
    const probe = async () => {
      const probeController = new AbortController();
      const timer = window.setTimeout(() => probeController.abort(), 4_000);
      try {
        /* Probe the runtime config: a real, small, never-precached file, so
           this cannot silently succeed from the service worker cache. */
        await fetch("/config.json", {
          cache: "no-store",
          method: "HEAD",
          signal: probeController.signal,
        });
        if (!cancelled) useRoutePlannerStore.getState().setOffline(false);
      } catch {
        if (!cancelled) useRoutePlannerStore.getState().setOffline(true);
      } finally {
        window.clearTimeout(timer);
      }
    };

    const markOffline = () => useRoutePlannerStore.getState().setOffline(true);
    /* Same function identity on add and remove, or the listener outlives the
       component. */
    const onOnline = () => void probe();

    void probe();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", markOffline);
    const interval = window.setInterval(() => void probe(), 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", markOffline);
      window.clearInterval(interval);
    };
  }, []);

  /* Initial A/B slots and remembered preferences */
  useEffect(() => {
    const state = useRoutePlannerStore.getState();
    if (state.locations.length === 0) {
      state.setLocations(createInitialLocations());
    }

    const preferences = loadPreferences();
    if (preferences) {
      state.setProfile(preferences.profile);
      state.setRoadPreference(preferences.roadPreference);
      state.setTerrainPreference(preferences.terrainPreference);
    }
  }, []);

  const navigate = useCallback((view: "composer" | "privacy" | "about") => {
    const state = useRoutePlannerStore.getState();
    if (view === "privacy" || view === "about") {
      state.setAppView(view);
      return;
    }
    state.setAppView("composer");
  }, []);

  const markers = useMemo((): MapMarker[] => {
    const route = store.lastValidRoute;
    if (route) {
      return route.input.locations.map((loc) => {
        if (route.input.returnToStart && loc.role === "origin") {
          return {
            id: loc.id,
            position: loc.position,
            label: "A",
            kind: "origin-destination" as const,
          };
        }
        return {
          id: loc.id,
          position: loc.position,
          label: loc.role === "origin" ? "A" : loc.role === "destination" ? "B" : String(route.input.locations.filter((l) => l.role === "waypoint").indexOf(loc) + 1),
          kind: loc.role === "origin" ? ("origin" as const) : loc.role === "destination" ? ("destination" as const) : ("waypoint" as const),
        };
      });
    }
    return store.locations
      .filter((l) => l.position !== null)
      .map((l) => ({
        id: l.id,
        position: l.position!,
        label: l.role === "origin" ? "A" : l.role === "destination" ? "B" : String(store.locations.filter((x) => x.role === "waypoint").indexOf(l) + 1),
        kind: l.role === "origin" ? ("origin" as const) : l.role === "destination" ? ("destination" as const) : ("waypoint" as const),
      }));
  }, [store.locations, store.lastValidRoute]);

  /**
   * A tap on the route line. In review mode it picks the ruas under the tap —
   * or the next corridor boundary — exactly as the segment list does. On the
   * result map it moves the elevation cursor.
   */
  const handleRouteClick = useCallback((distanceMeters: number) => {
    const state = useRoutePlannerStore.getState();
    const route = state.lastValidRoute;

    if (state.appView !== "road-review") {
      state.setChartCursorMeters(distanceMeters);
      return;
    }

    const segments = state.roadSegments;
    if (!route || !segments || segments.length === 0) return;

    const ranges = buildSegmentRanges(segments, cumulativeDistances(route.geometry));
    const hit = findSegmentAtDistance(ranges, distanceMeters);
    if (!hit) return;
    const segment = segments.find((s) => s.id === hit.id);
    if (!segment) return;

    if (state.reviewCorridor) {
      const next = advanceCorridor(state.reviewCorridor, segment);
      state.setReviewCorridor(next);
      const bounds = corridorRange(next);
      state.setReviewSelection(
        bounds
          ? {
              startShapeIndex: bounds.start,
              endShapeIndex: bounds.end,
              segmentIds: segmentsWithinBounds(segments, bounds.start, bounds.end).map(
                (s) => s.id,
              ),
            }
          : null,
      );
      return;
    }

    state.setReviewSelection({
      startShapeIndex: segment.beginShapeIndex,
      endShapeIndex: segment.endShapeIndex,
      segmentIds: [segment.id],
    });
  }, []);

  const searchTarget = useMemo(() => {
    if (!store.searchDialog.targetId) return null;
    return store.locations.find((l) => l.id === store.searchDialog.targetId) ?? null;
  }, [store.locations, store.searchDialog.targetId]);

  const mapPickerTarget = useMemo(() => {
    if (!store.mapPicker.targetId) return null;
    return store.locations.find((l) => l.id === store.mapPicker.targetId) ?? null;
  }, [store.locations, store.mapPicker.targetId]);

  if (configError) {
    return (
      <div className="config-error">
        <h1 className="config-error-title">{COPY.appName}</h1>
        <p className="inline-error">{configError}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {COPY.reload}
        </button>
      </div>
    );
  }

  if (!configReady) {
    return (
      <div className="config-error">
        <div className="loading-spinner" aria-hidden="true" />
        <p className="config-error-text">{COPY.loading}</p>
      </div>
    );
  }

  if (store.restorePromptOpen) {
    return (
      <AppShell offline={store.offline} onNavigate={navigate} activeView="composer">
        <RestorePrompt
          onRestore={() => void controller.restoreDraft()}
          onDelete={() => void controller.deleteDraft()}
        />
      </AppShell>
    );
  }

  if (store.appView === "privacy") {
    return (
      <AppShell offline={store.offline} onNavigate={navigate} activeView="privacy">
        <PrivacyView />
      </AppShell>
    );
  }

  if (store.appView === "about") {
    return (
      <AppShell offline={store.offline} onNavigate={navigate} activeView="about">
        <AboutView />
      </AppShell>
    );
  }

  const isResult = store.appView === "result";
  const isReview = store.appView === "road-review";
  const activeRoute = store.lastValidRoute;
  const routeGeometry = activeRoute?.geometry ?? null;

  /* Review mode simplifies the route to one neutral line and highlights the
     selection; the result map shows terrain colours instead. */
  const terrain = !isReview && activeRoute ? getRouteElevation(activeRoute).terrain : null;

  const selectionGeometry =
    isReview && activeRoute && store.reviewSelection
      ? activeRoute.geometry.slice(
          Math.max(0, store.reviewSelection.startShapeIndex),
          Math.min(activeRoute.geometry.length, store.reviewSelection.endShapeIndex + 1),
        )
      : null;

  return (
    <AppShell offline={store.offline} onNavigate={navigate} activeView={store.appView}>
      <div className={`app-layout ${isResult ? "layout-result" : isReview ? "layout-review" : "layout-composer"}`}>
        <div className="app-panel">
          {store.appView === "composer" && <RouteComposer controller={controller} offline={store.offline} />}
          {isResult && <RouteResultPanel controller={controller} offline={store.offline} />}
          {isReview && (
            <RoadReviewPanel
              controller={controller}
              onExit={() => store.setAppView("result")}
            />
          )}
        </div>

        <div className="app-map">
          <MapCanvas
            markers={markers}
            routeGeometry={routeGeometry}
            terrain={terrain}
            selectionGeometry={selectionGeometry}
            cursorDistanceMeters={isResult ? store.chartCursorMeters : null}
            onRouteClick={handleRouteClick}
            fitPadding={isResult ? 120 : 60}
            offline={store.offline}
          />
        </div>
      </div>

      <LocationSearchDialog
        open={store.searchDialog.open}
        onClose={() => store.setSearchDialog({ open: false, targetId: null })}
        onSelect={(result) => {
          if (searchTarget) {
            controller.applyLocation(searchTarget.id, {
              position: result.position,
              label: result.label.split(",")[0] ?? result.label,
              source: "search",
            });
          }
        }}
        onSearch={controller.searchLocation}
        offline={store.offline}
      />

      <MapPicker
        open={store.mapPicker.open}
        initialPosition={mapPickerTarget?.position ?? null}
        onSave={(position) => {
          if (mapPickerTarget) {
            controller.applyMapPosition(mapPickerTarget.id, position);
          }
        }}
        onCancel={() => store.setMapPicker({ open: false, targetId: null })}
      />

      <ImagePreviewDialog
        open={store.imagePreview.open}
        imageUrl={store.imagePreview.url}
        onClose={controller.closeImagePreview}
        onShare={() => void controller.shareImage()}
        onDownload={controller.downloadImage}
      />
    </AppShell>
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  );
}
