import type { Position } from "./geo";
import { PRODUCT_LIMITS } from "./route";

export interface EditableRouteLocation {
  id: string;
  role: "origin" | "waypoint" | "destination";
  position: Position | null;
  label: string;
  source: "search" | "map" | "geolocation" | null;
}

export interface RouteLocation {
  id: string;
  role: "origin" | "waypoint" | "destination";
  position: Position;
  label: string;
  source: "search" | "map" | "geolocation";
}

export function createLocationId(): string {
  return crypto.randomUUID();
}

export function createEmptyLocation(role: "origin" | "destination"): EditableRouteLocation {
  return {
    id: createLocationId(),
    role,
    position: null,
    label: "",
    source: null,
  };
}

export function createInitialLocations(): EditableRouteLocation[] {
  return [createEmptyLocation("origin"), createEmptyLocation("destination")];
}

export function countWaypoints(locations: readonly EditableRouteLocation[]): number {
  return locations.filter((l) => l.role === "waypoint").length;
}

export function validateRouteLocations(
  locations: readonly EditableRouteLocation[],
): { ok: true; value: readonly RouteLocation[] } | { ok: false; message: string } {
  const origin = locations.find((l) => l.role === "origin");
  const destination = locations.find((l) => l.role === "destination");

  if (!origin || !destination) {
    return { ok: false, message: "Titik mulai dan tujuan wajib diisi." };
  }

  if (origin.position === null || destination.position === null) {
    return { ok: false, message: "Lengkapi titik mulai dan tujuan terlebih dahulu." };
  }

  const ordered = [...locations].sort((a, b) => {
    const order: Record<EditableRouteLocation["role"], number> = { origin: 0, waypoint: 1, destination: 2 };
    return order[a.role] - order[b.role];
  });

  const validated: RouteLocation[] = [];
  for (const loc of ordered) {
    if (loc.position === null || loc.source === null) {
      return { ok: false, message: "Ada titik yang belum dipilih." };
    }
    validated.push({
      id: loc.id,
      role: loc.role,
      position: loc.position,
      label: loc.label,
      source: loc.source,
    });
  }

  const waypointCount = validated.filter((l) => l.role === "waypoint").length;
  if (waypointCount > PRODUCT_LIMITS.maxIntermediateWaypoints) {
    return { ok: false, message: "Maksimal 20 titik antara." };
  }

  return { ok: true, value: validated };
}
