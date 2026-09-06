import type { PlannedRoute } from "@/domain/route";
import type { Position } from "@/domain/geo";
import { cumulativeDistances, distanceAlongRoute } from "./calculate-overlap";

export interface RouteMarker {
  id: string;
  position: Position;
  label: string;
  /** Shown beside the marker — the clock time at that end of the ride. */
  sublabel?: string;
  kind: "origin" | "waypoint" | "destination" | "origin-destination";
}

/** The point on `geometry` at a travelled distance. */
export function positionAtDistance(
  geometry: readonly Position[],
  distanceMeters: number,
): Position | null {
  if (geometry.length === 0) return null;
  if (geometry.length === 1) return geometry[0]!;

  const cumulative = cumulativeDistances(geometry);
  const total = cumulative[cumulative.length - 1] ?? 0;
  const target = Math.max(0, Math.min(total, distanceMeters));

  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i]! < target) continue;
    const a = geometry[i - 1]!;
    const b = geometry[i]!;
    const span = cumulative[i]! - cumulative[i - 1]! || 1;
    const t = (target - cumulative[i - 1]!) / span;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  return geometry[geometry.length - 1] ?? null;
}

/**
 * Marker positions for a planned route, anchored to the route itself.
 *
 * The router snaps every requested point to the nearest rideable edge, so a
 * pin dropped in a park or a building can sit a couple of hundred metres from
 * where the ride actually begins. Drawing markers at the requested
 * coordinates leaves them floating off the line; anchoring them to the route
 * puts each one where the rider will really be.
 */
export function buildRouteMarkers(
  route: PlannedRoute,
  times?: { departureLabel: string; arrivalLabel: string },
): RouteMarker[] {
  const geometry = route.geometry;
  if (geometry.length < 2) return [];

  const locations = route.input.locations;
  const outboundEnd = route.outbound.geometry[route.outbound.geometry.length - 1];
  const markers: RouteMarker[] = [];
  let waypointNumber = 0;

  for (const location of locations) {
    if (location.role === "origin") {
      markers.push({
        id: location.id,
        position: geometry[0]!,
        label: "A",
        /* A round trip starts and finishes here, so it carries both times. */
        ...(times
          ? {
              sublabel: route.input.returnToStart
                ? `${times.departureLabel} – ${times.arrivalLabel}`
                : times.departureLabel,
            }
          : {}),
        kind: route.input.returnToStart ? "origin-destination" : "origin",
      });
      continue;
    }

    if (location.role === "destination") {
      /* On a round trip B is the turnaround, which is where the outbound leg
         ends rather than where the whole ride ends. */
      const position = route.input.returnToStart
        ? (outboundEnd ?? geometry[geometry.length - 1]!)
        : geometry[geometry.length - 1]!;
      markers.push({
        id: location.id,
        position,
        label: "B",
        /* On a round trip B is the turnaround, so its arrival time is not the
           end of the ride and is left off rather than guessed. */
        ...(times && !route.input.returnToStart ? { sublabel: times.arrivalLabel } : {}),
        kind: "destination",
      });
      continue;
    }

    waypointNumber += 1;
    const snapped =
      positionAtDistance(geometry, distanceAlongRoute(geometry, location.position)) ??
      location.position;
    markers.push({
      id: location.id,
      position: snapped,
      label: String(waypointNumber),
      kind: "waypoint",
    });
  }

  return markers;
}
