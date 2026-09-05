import { create } from "zustand";
import type { EditableRouteLocation } from "@/domain/location";
import type {
  BicycleProfile,
  RoadPreference,
  TerrainPreference,
  ReturnMode,
  PlannedRoute,
  RoadSegment,
} from "@/domain/route";
import type { Position } from "@/domain/geo";
import type { AppView } from "@/app/app-view";

export interface ExclusionItem {
  id: string;
  position: Position;
  label: string;
}

export interface SearchDialogState {
  open: boolean;
  targetId: string | null;
}

export interface MapPickerState {
  open: boolean;
  targetId: string | null;
}

/** Shape-index bounds of the ruas or corridor under review. */
export interface ReviewSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

/** Corridor bounds being picked. `null` means corridor mode is off. */
export interface ReviewCorridor {
  startShapeIndex: number | null;
  endShapeIndex: number | null;
}

export interface ImagePreviewState {
  open: boolean;
  url: string | null;
  filename: string;
  imageFile: File | null;
}

export interface RoutePlannerState {
  /* Editable form state (not persisted as a whole) */
  locations: EditableRouteLocation[];
  profile: BicycleProfile;
  roadPreference: RoadPreference;
  terrainPreference: TerrainPreference;
  returnToStart: boolean;
  returnMode: ReturnMode;
  activeExclusions: ExclusionItem[];

  /* Route result state — independent from form state */
  lastValidRoute: PlannedRoute | null;
  isCalculating: boolean;
  routeError: string | null;
  changesUnapplied: boolean;

  /* Road metadata */
  roadSegments: RoadSegment[] | null;
  roadSegmentsLoading: boolean;
  roadMetadataError: string | null;
  reviewSelection: ReviewSelection | null;
  reviewCorridor: ReviewCorridor | null;

  /* Distance along the route highlighted by the chart or a map tap */
  chartCursorMeters: number | null;

  /* Inline notice for the location controls (GPS permission, availability) */
  locationNotice: string | null;

  /* View state */
  appView: AppView;
  searchDialog: SearchDialogState;
  mapPicker: MapPickerState;
  imagePreview: ImagePreviewState;
  offline: boolean;

  /* Draft */
  draftAvailable: boolean;
  restorePromptOpen: boolean;

  /* Actions — form */
  setLocations: (locations: EditableRouteLocation[]) => void;
  addWaypointBeforeDestination: () => void;
  removeLocation: (id: string) => void;
  updateLocation: (id: string, updates: Partial<EditableRouteLocation>) => void;
  moveWaypoint: (id: string, direction: -1 | 1) => void;
  reorderWaypoint: (fromIndex: number, toIndex: number) => void;
  swapDirections: () => void;
  setProfile: (profile: BicycleProfile) => void;
  setRoadPreference: (pref: RoadPreference) => void;
  setTerrainPreference: (pref: TerrainPreference) => void;
  setReturnToStart: (value: boolean) => void;
  setReturnMode: (mode: ReturnMode) => void;

  /* Actions — exclusions */
  setActiveExclusions: (exclusions: ExclusionItem[]) => void;

  /* Actions — route result */
  setLastValidRoute: (route: PlannedRoute | null) => void;
  setIsCalculating: (value: boolean) => void;
  setRouteError: (error: string | null) => void;
  setChangesUnapplied: (value: boolean) => void;

  /* Actions — road metadata */
  setRoadSegments: (segments: RoadSegment[] | null) => void;
  setRoadSegmentsLoading: (value: boolean) => void;
  setRoadMetadataError: (error: string | null) => void;
  setReviewSelection: (selection: ReviewSelection | null) => void;
  setReviewCorridor: (corridor: ReviewCorridor | null) => void;
  setChartCursorMeters: (distanceMeters: number | null) => void;
  setLocationNotice: (notice: string | null) => void;

  /* Actions — view state */
  setAppView: (view: AppView) => void;
  setSearchDialog: (state: SearchDialogState) => void;
  setMapPicker: (state: MapPickerState) => void;
  setImagePreview: (state: ImagePreviewState) => void;
  setOffline: (value: boolean) => void;

  /* Actions — draft */
  setDraftAvailable: (value: boolean) => void;
  setRestorePromptOpen: (value: boolean) => void;

  resetAll: () => void;
}

const initialFormState = {
  locations: [] as EditableRouteLocation[],
  profile: "road-bike" as BicycleProfile,
  roadPreference: "standard" as RoadPreference,
  terrainPreference: "standard" as TerrainPreference,
  returnToStart: false,
  returnMode: "different-road" as ReturnMode,
  activeExclusions: [] as ExclusionItem[],
};

const initialState = {
  ...initialFormState,
  lastValidRoute: null as PlannedRoute | null,
  isCalculating: false,
  routeError: null as string | null,
  changesUnapplied: false,
  roadSegments: null as RoadSegment[] | null,
  roadSegmentsLoading: false,
  roadMetadataError: null as string | null,
  reviewSelection: null as ReviewSelection | null,
  reviewCorridor: null as ReviewCorridor | null,
  chartCursorMeters: null as number | null,
  locationNotice: null as string | null,
  appView: "composer" as AppView,
  searchDialog: { open: false, targetId: null } as SearchDialogState,
  mapPicker: { open: false, targetId: null } as MapPickerState,
  imagePreview: { open: false, url: null, filename: "", imageFile: null } as ImagePreviewState,
  offline: false,
  draftAvailable: false,
  restorePromptOpen: false,
};

export const useRoutePlannerStore = create<RoutePlannerState>((set) => ({
  ...initialState,

  setLocations: (locations) => set({ locations }),

  addWaypointBeforeDestination: () =>
    set((s) => {
      const destIndex = s.locations.findIndex((l) => l.role === "destination");
      const waypoint: EditableRouteLocation = {
        id: crypto.randomUUID(),
        role: "waypoint",
        position: null,
        label: "",
        source: null,
      };
      const updated = [...s.locations];
      updated.splice(destIndex < 0 ? updated.length : destIndex, 0, waypoint);
      return { locations: updated };
    }),

  removeLocation: (id) =>
    set((s) => ({ locations: s.locations.filter((l) => l.id !== id) })),

  updateLocation: (id, updates) =>
    set((s) => ({
      locations: s.locations.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),

  moveWaypoint: (id, direction) =>
    set((s) => {
      const idx = s.locations.findIndex((l) => l.id === id);
      if (idx < 0) return {};
      const loc = s.locations[idx]!;
      if (loc.role !== "waypoint") return {};
      const targetIdx = idx + direction;
      if (targetIdx < 1) return {};
      const target = s.locations[targetIdx];
      if (!target || target.role === "origin") return {};
      const updated = [...s.locations];
      [updated[idx], updated[targetIdx]] = [updated[targetIdx]!, updated[idx]!];
      return { locations: updated };
    }),

  reorderWaypoint: (fromIndex, toIndex) =>
    set((s) => {
      const updated = [...s.locations];
      const [moved] = updated.splice(fromIndex, 1);
      if (!moved) return {};
      updated.splice(toIndex, 0, moved);
      return { locations: updated };
    }),

  swapDirections: () =>
    set((s) => {
      const origin = s.locations.find((l) => l.role === "origin");
      const destination = s.locations.find((l) => l.role === "destination");
      if (!origin || !destination) return {};
      const updated = s.locations.map((l) => {
        if (l.role === "origin") return { ...destination, role: "origin" as const };
        if (l.role === "destination") return { ...origin, role: "destination" as const };
        return l;
      });
      return { locations: updated };
    }),

  setProfile: (profile) => set({ profile }),
  setRoadPreference: (roadPreference) => set({ roadPreference }),
  setTerrainPreference: (terrainPreference) => set({ terrainPreference }),
  setReturnToStart: (returnToStart) => set({ returnToStart }),
  setReturnMode: (returnMode) => set({ returnMode }),
  setActiveExclusions: (activeExclusions) => set({ activeExclusions }),

  setLastValidRoute: (lastValidRoute) =>
    /* Road metadata is keyed to the route it was traced from; a new route
       invalidates it so the review panel never shows stale segments and
       persisted drafts never carry metadata from a previous route. */
    set({
      lastValidRoute,
      routeError: null,
      changesUnapplied: false,
      roadSegments: null,
      roadMetadataError: null,
      reviewSelection: null,
      reviewCorridor: null,
      chartCursorMeters: null,
    }),
  setIsCalculating: (isCalculating) => set({ isCalculating }),
  setRouteError: (routeError) => set({ routeError }),
  setChangesUnapplied: (changesUnapplied) => set({ changesUnapplied }),

  setRoadSegments: (roadSegments) => set({ roadSegments }),
  setRoadSegmentsLoading: (roadSegmentsLoading) => set({ roadSegmentsLoading }),
  setRoadMetadataError: (roadMetadataError) => set({ roadMetadataError }),
  setReviewSelection: (reviewSelection) => set({ reviewSelection }),
  setReviewCorridor: (reviewCorridor) => set({ reviewCorridor }),
  setChartCursorMeters: (chartCursorMeters) => set({ chartCursorMeters }),
  setLocationNotice: (locationNotice) => set({ locationNotice }),

  setAppView: (appView) => set({ appView }),
  setSearchDialog: (searchDialog) => set({ searchDialog }),
  setMapPicker: (mapPicker) => set({ mapPicker }),
  setImagePreview: (imagePreview) => set({ imagePreview }),
  setOffline: (offline) => set({ offline }),

  setDraftAvailable: (draftAvailable) => set({ draftAvailable }),
  setRestorePromptOpen: (restorePromptOpen) => set({ restorePromptOpen }),

  resetAll: () =>
    set({
      ...initialState,
      locations: [],
    }),
}));
