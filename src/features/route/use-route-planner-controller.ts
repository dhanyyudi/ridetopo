import { useCallback, useEffect, useRef } from "react";
import { useRoutePlannerStore, type ExclusionItem } from "@/store/route-planner-store";
import { validateRouteLocations } from "@/domain/location";
import type { Position } from "@/domain/geo";
import type { RoutePlanInput, PlannedRoute, RoadSegment } from "@/domain/route";
import type { DraftV1 } from "@/domain/export";
import type { GeocodingResult, RoutingProvider, GeocodingProvider } from "@/providers/contracts";
import { getRuntimeConfig } from "@/config/runtime-config";
import { createValhallaProvider } from "@/providers/routing/valhalla-provider";
import { createNominatimProvider } from "@/providers/geocoding/nominatim-provider";
import { planRoute } from "@/services/routing/plan-route";
import { routeEncodedShape } from "@/services/routing/merge-legs";
import { mergeExclusionPositions } from "@/services/avoidance/build-exclusions";
import { draftRepository } from "@/services/persistence/draft-repository";
import { savePreferences } from "@/services/persistence/preference-storage";
import { buildDraftFromRoute } from "@/services/persistence/draft-serialization";
import { PRODUCT_LIMITS } from "@/domain/route";
import { COPY } from "@/content/id";

interface ProviderSingletons {
  routing: RoutingProvider;
  geocoding: GeocodingProvider;
}

let providerCache: ProviderSingletons | null = null;

function getProviders(): ProviderSingletons {
  if (!providerCache) {
    const config = getRuntimeConfig();
    if (!config) {
      throw new Error("Runtime config belum dimuat.");
    }
    providerCache = {
      routing: createValhallaProvider(),
      geocoding: createNominatimProvider(),
    };
  }
  return providerCache;
}

export class RoutePlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutePlanningError";
  }
}

export function translateError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return COPY.errorRouteCancelled;
  }
  if (err instanceof RoutePlanningError) {
    return err.message;
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("500 km")) return COPY.errorRouteTooLong;
    if (msg.includes("Tidak ditemukan rute")) return COPY.errorNoRoute;
  }
  return COPY.errorRouteFailed;
}

export function useRoutePlannerController() {
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlannedRef = useRef(false);
  const traceIdRef = useRef(0);
  const traceAbortRef = useRef<AbortController | null>(null);

  /* Nothing must keep firing after the app unmounts. */
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      traceAbortRef.current?.abort();
    },
    [],
  );

  const providers = useCallback((): ProviderSingletons | null => {
    try {
      return getProviders();
    } catch {
      return null;
    }
  }, []);

  const buildInput = useCallback((): RoutePlanInput | { error: string } => {
    const state = useRoutePlannerStore.getState();
    const result = validateRouteLocations(state.locations);
    if (!result.ok) {
      return { error: result.message };
    }
    return {
      locations: result.value,
      profile: state.profile,
      roadPreference: state.roadPreference,
      terrainPreference: state.terrainPreference,
      exclusions: state.activeExclusions.map((e) => e.position),
      returnToStart: state.returnToStart,
      returnMode: state.returnMode,
    };
  }, []);

  const executeRouteRequest = useCallback(
    async (input: RoutePlanInput): Promise<void> => {
      const activeProviders = providers();
      if (!activeProviders) {
        useRoutePlannerStore.getState().setRouteError(COPY.errorConfig);
        return;
      }

      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      useRoutePlannerStore.getState().setIsCalculating(true);
      useRoutePlannerStore.getState().setRouteError(null);
      useRoutePlannerStore.getState().setChangesUnapplied(false);

      try {
        const route = await planRoute(input, activeProviders.routing, controller.signal);

        if (requestId !== requestIdRef.current) {
          return;
        }

        useRoutePlannerStore.getState().setLastValidRoute(route);
        useRoutePlannerStore.getState().setIsCalculating(false);

        /* Read the store again after setLastValidRoute: that action clears the
           road metadata traced from the previous route, and a stale snapshot
           would carry it into the saved draft. */
        const applied = useRoutePlannerStore.getState();
        if (!hasPlannedRef.current || applied.appView === "composer") {
          hasPlannedRef.current = true;
          applied.setAppView("result");
        }

        void persistDraft(route);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          useRoutePlannerStore.getState().setIsCalculating(false);
          return;
        }
        useRoutePlannerStore.getState().setIsCalculating(false);
        useRoutePlannerStore.getState().setChangesUnapplied(true);
        useRoutePlannerStore.getState().setRouteError(translateError(err));
      }
    },
    [providers],
  );

  const scheduleReroute = useCallback(
    (input: RoutePlanInput) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void executeRouteRequest(input);
      }, PRODUCT_LIMITS.routeDebounceMs);
    },
    [executeRouteRequest],
  );

  const planExplicitly = useCallback(async (): Promise<void> => {
    const built = buildInput();
    if ("error" in built) {
      useRoutePlannerStore.getState().setRouteError(built.error);
      return;
    }
    await executeRouteRequest(built);
  }, [buildInput, executeRouteRequest]);

  const rerouteIfValid = useCallback(() => {
    const state = useRoutePlannerStore.getState();
    if (!hasPlannedRef.current || !state.lastValidRoute) {
      return;
    }
    const built = buildInput();
    if ("error" in built) {
      return;
    }
    scheduleReroute(built);
  }, [buildInput, scheduleReroute]);

  /* Location actions */
  const applyLocation = useCallback(
    (locationId: string, value: { position: Position; label: string; source: "search" | "geolocation" }) => {
      const state = useRoutePlannerStore.getState();
      state.updateLocation(locationId, {
        position: value.position,
        label: value.label,
        source: value.source,
      });
      state.setSearchDialog({ open: false, targetId: null });
      rerouteIfValid();
    },
    [rerouteIfValid],
  );

  const applyMapPosition = useCallback(
    (locationId: string, position: Position) => {
      const state = useRoutePlannerStore.getState();
      const loc = state.locations.find((l) => l.id === locationId);
      state.updateLocation(locationId, {
        position,
        label: loc?.label && loc.source === "search" ? loc.label : COPY.mapPickLabel,
        source: "map",
      });
      state.setMapPicker({ open: false, targetId: null });
      rerouteIfValid();
    },
    [rerouteIfValid],
  );

  const useGeolocation = useCallback(
    (locationId: string) => {
      const state = useRoutePlannerStore.getState();
      const loc = state.locations.find((l) => l.id === locationId);
      if (!loc || loc.role !== "origin") return;

      if (!("geolocation" in navigator)) {
        state.setLocationNotice(COPY.locationUnavailable);
        return;
      }

      state.setLocationNotice(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          useRoutePlannerStore.getState().setLocationNotice(null);
          applyLocation(locationId, {
            position: [pos.coords.longitude, pos.coords.latitude],
            label: COPY.myLocation,
            source: "geolocation",
          });
        },
        (error) => {
          /* Inline beside the location controls: a denied permission is not a
             routing failure and must not replace the route error. */
          useRoutePlannerStore
            .getState()
            .setLocationNotice(
              error.code === error.TIMEOUT ? COPY.locationTimeout : COPY.locationDenied,
            );
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      );
    },
    [applyLocation],
  );

  const addWaypoint = useCallback(() => {
    const state = useRoutePlannerStore.getState();
    const count = state.locations.filter((l) => l.role === "waypoint").length;
    if (count >= PRODUCT_LIMITS.maxIntermediateWaypoints) return;
    state.addWaypointBeforeDestination();
  }, []);

  const removeLocation = useCallback(
    (id: string) => {
      const state = useRoutePlannerStore.getState();
      const loc = state.locations.find((l) => l.id === id);
      if (!loc || loc.role === "origin" || loc.role === "destination") return;
      state.removeLocation(id);
      rerouteIfValid();
    },
    [rerouteIfValid],
  );

  const moveWaypoint = useCallback(
    (id: string, direction: -1 | 1) => {
      useRoutePlannerStore.getState().moveWaypoint(id, direction);
      rerouteIfValid();
    },
    [rerouteIfValid],
  );

  const swapDirections = useCallback(() => {
    useRoutePlannerStore.getState().swapDirections();
    rerouteIfValid();
  }, [rerouteIfValid]);

  const setPreference = useCallback(
    (change: Partial<Pick<RoutePlanInput, "profile" | "roadPreference" | "terrainPreference" | "returnToStart" | "returnMode">>) => {
      const state = useRoutePlannerStore.getState();
      if (change.profile !== undefined) state.setProfile(change.profile);
      if (change.roadPreference !== undefined) state.setRoadPreference(change.roadPreference);
      if (change.terrainPreference !== undefined) state.setTerrainPreference(change.terrainPreference);
      if (change.returnToStart !== undefined) state.setReturnToStart(change.returnToStart);
      if (change.returnMode !== undefined) state.setReturnMode(change.returnMode);

      /* Only the lightweight UI preferences persist; where someone rides
         stays in the validated draft. */
      const after = useRoutePlannerStore.getState();
      savePreferences({
        profile: after.profile,
        roadPreference: after.roadPreference,
        terrainPreference: after.terrainPreference,
      });

      rerouteIfValid();
    },
    [rerouteIfValid],
  );

  /* Road review */
  const openRoadReview = useCallback(async (): Promise<void> => {
    const state = useRoutePlannerStore.getState();
    if (state.offline) {
      state.setRoadMetadataError(COPY.offlineTraceDisabled);
      return;
    }
    const activeProviders = providers();
    if (!activeProviders) return;
    const route = state.lastValidRoute;
    if (!route) return;

    state.setAppView("road-review");
    state.setRoadMetadataError(null);

    if (state.roadSegments && state.roadSegments.length > 0) {
      return;
    }

    const traceId = ++traceIdRef.current;
    traceAbortRef.current?.abort();
    const abort = new AbortController();
    traceAbortRef.current = abort;

    state.setRoadSegmentsLoading(true);
    try {
      /* The whole route, round trips included — the return leg is part of the
         ride and must be reviewable too. */
      const segments = await activeProviders.routing.traceAttributes(
        routeEncodedShape(route),
        abort.signal,
      );
      if (traceId !== traceIdRef.current) return;
      useRoutePlannerStore.getState().setRoadSegments(segments as RoadSegment[]);
      useRoutePlannerStore.getState().setRoadSegmentsLoading(false);
    } catch (err) {
      if (traceId !== traceIdRef.current) return;
      useRoutePlannerStore.getState().setRoadSegmentsLoading(false);
      if (err instanceof DOMException && err.name === "AbortError") return;
      useRoutePlannerStore.getState().setRoadMetadataError(COPY.metadataUnavailable);
    }
  }, [providers]);

  /* Avoidance — transactional: exclusions commit only with a validated route */
  const addAvoidance = useCallback(
    async (
      positions: readonly Position[],
      label: string,
      avoidedGeometry: readonly Position[],
    ): Promise<void> => {
      const state = useRoutePlannerStore.getState();
      const previousRoute = state.lastValidRoute;
      const previousExclusions = state.activeExclusions;

      const combined = mergeExclusions(previousExclusions, positions, label);

      if (!hasPlannedRef.current || !previousRoute) {
        state.setActiveExclusions(combined);
        return;
      }

      state.setActiveExclusions(combined);

      const built = buildInput();
      if ("error" in built) {
        state.setActiveExclusions(previousExclusions);
        return;
      }

      await executeRouteRequest(built);

      const after = useRoutePlannerStore.getState();
      if (after.routeError) {
        /* Failed reroute: roll back exclusions, keep the old route */
        after.setActiveExclusions(previousExclusions);
        return;
      }

      const newRoute = after.lastValidRoute;
      if (!newRoute || avoidedGeometry.length < 2) return;

      /* Awaited, so the rollback cannot land on top of a later route. */
      const { validateAvoidance } = await import("@/services/avoidance/validate-avoidance");
      const stillCrossing = !validateAvoidance(avoidedGeometry, newRoute.geometry, {
        toleranceMeters: 20,
        terminalAllowanceMeters: 40,
      });

      if (stillCrossing && useRoutePlannerStore.getState().lastValidRoute === newRoute) {
        const rolledBack = useRoutePlannerStore.getState();
        rolledBack.setActiveExclusions(previousExclusions);
        rolledBack.setLastValidRoute(previousRoute);
        rolledBack.setRouteError(COPY.avoidanceFailed);
        rolledBack.setChangesUnapplied(true);
      }
    },
    [buildInput, executeRouteRequest],
  );

  const removeAvoidance = useCallback(
    (id: string) => {
      const state = useRoutePlannerStore.getState();
      const previousRoute = state.lastValidRoute;
      const previousExclusions = state.activeExclusions;
      state.setActiveExclusions(previousExclusions.filter((e) => e.id !== id));

      if (!hasPlannedRef.current || !previousRoute) return;

      const built = buildInput();
      if ("error" in built) {
        state.setActiveExclusions(previousExclusions);
        return;
      }

      void executeRouteRequest(built).then(() => {
        const after = useRoutePlannerStore.getState();
        if (after.routeError) {
          /* Failed reroute after removal: restore the exclusion list */
          after.setActiveExclusions(previousExclusions);
        }
      });
    },
    [buildInput, executeRouteRequest],
  );

  /* Draft */
  const restoreDraft = useCallback(async (): Promise<void> => {
    const state = useRoutePlannerStore.getState();
    const draft = await draftRepository.load();
    if (!draft) {
      state.setDraftAvailable(false);
      state.setRestorePromptOpen(false);
      return;
    }

    hasPlannedRef.current = true;
    useRoutePlannerStore.setState({
      lastValidRoute: draft.route,
      roadSegments: (draft.roadSegments as RoadSegment[] | null) ?? null,
      activeExclusions: draft.activeExclusions.map((p, i) => ({
        id: `excl-${i}-${p[0]}-${p[1]}`,
        position: p,
        label: COPY.exclusionLabel,
      })),
      locations: draft.route.input.locations.map((l) => ({ ...l })),
      profile: draft.route.input.profile,
      roadPreference: draft.route.input.roadPreference,
      terrainPreference: draft.route.input.terrainPreference,
      returnToStart: draft.route.input.returnToStart,
      returnMode: draft.route.input.returnMode,
      appView: "result",
      draftAvailable: false,
      restorePromptOpen: false,
    });
  }, []);

  const deleteDraft = useCallback(async (): Promise<void> => {
    await draftRepository.clear();
    useRoutePlannerStore.getState().setDraftAvailable(false);
    useRoutePlannerStore.getState().setRestorePromptOpen(false);
  }, []);

  /* Exports */
  const exportGpx = useCallback((): void => {
    const state = useRoutePlannerStore.getState();
    const route = state.lastValidRoute;
    if (!route) return;

    void (async () => {
      try {
        const { generateGpxBlob, generateGpxFilename } = await import(
          "@/services/export/build-gpx"
        );
        const { triggerDownload } = await import("@/services/export/share-route-card");
        triggerDownload(generateGpxBlob(route), generateGpxFilename(route));
      } catch {
        /* A failed export must leave the route untouched. */
        useRoutePlannerStore.getState().setRouteError(COPY.errorExport);
      }
    })();
  }, []);

  const prepareImage = useCallback(async (): Promise<void> => {
    const state = useRoutePlannerStore.getState();
    const route = state.lastValidRoute;
    if (!route) return;

    try {
      const { renderRouteCard } = await import("@/services/export/render-route-card");
      const { formatDistance, formatElevation, formatDuration } = await import("@/lib/format-id");

      const logo = new Image();
      logo.src = "/brand/logo-mark.svg";
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = () => reject(new Error("Logo tidak dapat dimuat."));
      });

      const blob = await renderRouteCard(
        {
          distanceLabel: formatDistance(route.metrics.distanceMeters),
          elevationGainLabel:
            route.metrics.elevationGainMeters != null
              ? formatElevation(route.metrics.elevationGainMeters)
              : null,
          estimatedTimeLabel: formatDuration(route.metrics.durationSeconds),
          geometry: route.geometry,
        },
        { logo, fontFamily: "Plus Jakarta Sans" },
      );

      const { generateImageFilename } = await import("@/services/export/share-route-card");
      const filename = generateImageFilename(route);
      const file = new File([blob], filename, { type: "image/png" });
      const url = URL.createObjectURL(blob);

      useRoutePlannerStore.getState().setImagePreview({ open: true, url, filename, imageFile: file });
    } catch {
      useRoutePlannerStore.getState().setRouteError(COPY.errorImageRender);
    }
  }, []);

  const downloadImage = useCallback((): void => {
    const state = useRoutePlannerStore.getState();
    const file = state.imagePreview.imageFile;
    if (!file) return;
    void import("@/services/export/share-route-card").then(({ downloadRouteCard }) => {
      downloadRouteCard(file, state.imagePreview.filename);
    });
  }, []);

  const shareImage = useCallback(async (): Promise<void> => {
    const state = useRoutePlannerStore.getState();
    const file = state.imagePreview.imageFile;
    if (!file) return;

    try {
      const { canShareRouteCard, shareRouteCard } = await import("@/services/export/share-route-card");
      if (canShareRouteCard(file)) {
        await shareRouteCard(file);
      } else {
        downloadImage();
      }
    } catch {
      /* cancellation or unsupported — keep download fallback available */
    }
  }, [downloadImage]);

  const closeImagePreview = useCallback((): void => {
    const state = useRoutePlannerStore.getState();
    if (state.imagePreview.url) {
      URL.revokeObjectURL(state.imagePreview.url);
    }
    state.setImagePreview({ open: false, url: null, filename: "", imageFile: null });
  }, []);

  /* Draft availability check at startup */
  useEffect(() => {
    let cancelled = false;
    void draftRepository.load().then((draft) => {
      if (!cancelled && draft) {
        useRoutePlannerStore.getState().setDraftAvailable(true);
        useRoutePlannerStore.getState().setRestorePromptOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    /* Query */
    searchLocation: (query: string, signal: AbortSignal): Promise<readonly GeocodingResult[]> => {
      const state = useRoutePlannerStore.getState();
      if (state.offline) {
        throw new Error(COPY.offlineSearchDisabled);
      }
      const activeProviders = providers();
      if (!activeProviders) return Promise.resolve([]);
      return activeProviders.geocoding.search(query, signal);
    },
    /* Plan */
    planExplicitly,
    /* Locations */
    applyLocation,
    applyMapPosition,
    useGeolocation,
    addWaypoint,
    removeLocation,
    moveWaypoint,
    swapDirections,
    setPreference,
    /* Review */
    openRoadReview,
    addAvoidance,
    removeAvoidance,
    /* Draft */
    restoreDraft,
    deleteDraft,
    /* Export */
    exportGpx,
    prepareImage,
    shareImage,
    downloadImage,
    closeImagePreview,
  };
}

/**
 * Merge new exclusion points into the active list, keeping the identity and
 * label of points that are already there.
 */
function mergeExclusions(
  existing: readonly ExclusionItem[],
  incoming: readonly Position[],
  label: string,
): ExclusionItem[] {
  const merged = mergeExclusionPositions(
    existing.map((item) => item.position),
    incoming,
    PRODUCT_LIMITS.maxExclusionLocations,
  );

  return merged.map((position) => {
    const previous = existing.find(
      (item) =>
        Math.abs(item.position[0] - position[0]) < 1e-9 &&
        Math.abs(item.position[1] - position[1]) < 1e-9,
    );
    return previous ?? { id: crypto.randomUUID(), position, label };
  });
}

/**
 * Build the draft from the store as it stands right now. Never from a
 * snapshot captured before the route was applied — road metadata is keyed to
 * the route it was traced from and is reset when a new route arrives.
 */
export function buildDraftForCurrentState(route: PlannedRoute): DraftV1 {
  const { roadSegments, activeExclusions } = useRoutePlannerStore.getState();
  return buildDraftFromRoute(
    route,
    roadSegments,
    activeExclusions.map((exclusion) => exclusion.position),
  );
}

async function persistDraft(route: PlannedRoute): Promise<void> {
  try {
    await draftRepository.save(buildDraftForCurrentState(route));
  } catch {
    /* Draft persistence is best-effort */
  }
}
