import { create } from "zustand";
import type { RouteLocation } from "@/domain/location";
import type { BicycleProfile, RoadPreference, TerrainPreference, ReturnMode, PlannedRoute, RoadSegment } from "@/domain/route";
import type { Position } from "@/domain/geo";

export interface RoutePlannerState {
  /* Form state (not persisted) */
  locations: RouteLocation[];
  profile: BicycleProfile;
  roadPreference: RoadPreference;
  terrainPreference: TerrainPreference;
  returnToStart: boolean;
  returnMode: ReturnMode;
  activeExclusions: Position[];

  /* Route state */
  lastValidRoute: PlannedRoute | null;
  isCalculating: boolean;
  routeError: string | null;

  /* Road metadata */
  roadSegments: RoadSegment[] | null;
  roadSegmentsLoading: boolean;

  /* Map */
  mapPickerOpen: boolean;
  mapPickerTarget: "origin" | "destination" | null;

  /* Draft */
  draftAvailable: boolean;

  /* Actions */
  setLocations: (locations: RouteLocation[]) => void;
  addLocation: (location: RouteLocation) => void;
  removeLocation: (id: string) => void;
  updateLocation: (id: string, updates: Partial<RouteLocation>) => void;
  swapDirections: () => void;
  setProfile: (profile: BicycleProfile) => void;
  setRoadPreference: (pref: RoadPreference) => void;
  setTerrainPreference: (pref: TerrainPreference) => void;
  setReturnToStart: (value: boolean) => void;
  setReturnMode: (mode: ReturnMode) => void;
  setActiveExclusions: (exclusions: Position[]) => void;
  addExclusion: (position: Position) => void;
  removeExclusion: (index: number) => void;
  setLastValidRoute: (route: PlannedRoute | null) => void;
  setIsCalculating: (value: boolean) => void;
  setRouteError: (error: string | null) => void;
  setRoadSegments: (segments: RoadSegment[] | null) => void;
  setRoadSegmentsLoading: (value: boolean) => void;
  setMapPickerOpen: (open: boolean) => void;
  setMapPickerTarget: (target: "origin" | "destination" | null) => void;
  setDraftAvailable: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  locations: [] as RouteLocation[],
  profile: "road-bike" as BicycleProfile,
  roadPreference: "standard" as RoadPreference,
  terrainPreference: "standard" as TerrainPreference,
  returnToStart: false,
  returnMode: "different-road" as ReturnMode,
  activeExclusions: [] as Position[],
  lastValidRoute: null as PlannedRoute | null,
  isCalculating: false,
  routeError: null as string | null,
  roadSegments: null as RoadSegment[] | null,
  roadSegmentsLoading: false,
  mapPickerOpen: false,
  mapPickerTarget: null as "origin" | "destination" | null,
  draftAvailable: false,
};

export const useRoutePlannerStore = create<RoutePlannerState>((set) => ({
  ...initialState,

  setLocations: (locations) => set({ locations }),
  addLocation: (location) =>
    set((s) => ({ locations: [...s.locations, location] })),
  removeLocation: (id) =>
    set((s) => ({ locations: s.locations.filter((l) => l.id !== id) })),
  updateLocation: (id, updates) =>
    set((s) => ({
      locations: s.locations.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  swapDirections: () =>
    set((s) => {
      const locs = [...s.locations];
      if (locs.length >= 2) {
        [locs[0], locs[locs.length - 1]] = [locs[locs.length - 1]!, locs[0]!];
        locs[0] = { ...locs[0]!, role: "origin" };
        locs[locs.length - 1] = { ...locs[locs.length - 1]!, role: "destination" };
      }
      return { locations: locs };
    }),
  setProfile: (profile) => set({ profile }),
  setRoadPreference: (roadPreference) => set({ roadPreference }),
  setTerrainPreference: (terrainPreference) => set({ terrainPreference }),
  setReturnToStart: (returnToStart) => set({ returnToStart }),
  setReturnMode: (returnMode) => set({ returnMode }),
  setActiveExclusions: (activeExclusions) => set({ activeExclusions }),
  addExclusion: (position) =>
    set((s) => ({ activeExclusions: [...s.activeExclusions, position] })),
  removeExclusion: (index) =>
    set((s) => ({
      activeExclusions: s.activeExclusions.filter((_, i) => i !== index),
    })),
  setLastValidRoute: (lastValidRoute) => set({ lastValidRoute, routeError: null }),
  setIsCalculating: (isCalculating) => set({ isCalculating }),
  setRouteError: (routeError) => set({ routeError }),
  setRoadSegments: (roadSegments) => set({ roadSegments }),
  setRoadSegmentsLoading: (roadSegmentsLoading) => set({ roadSegmentsLoading }),
  setMapPickerOpen: (mapPickerOpen) => set({ mapPickerOpen }),
  setMapPickerTarget: (mapPickerTarget) => set({ mapPickerTarget }),
  setDraftAvailable: (draftAvailable) => set({ draftAvailable }),
  reset: () => set({ ...initialState }),
}));
