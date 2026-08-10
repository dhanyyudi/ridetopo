import type { Position } from "./geo";

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
