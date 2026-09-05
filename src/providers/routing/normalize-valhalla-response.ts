import type { Position } from "@/domain/geo";
import type { RouteLeg, ElevationSample } from "@/domain/route";
import type { ValhallaRouteResponse, ValhallaLeg, ValhallaTrip } from "./valhalla-types";
import { decodePolyline6 } from "@/lib/polyline6";
import { ELEVATION_CONFIG } from "@/domain/route";
import { mergeRouteLegs } from "@/services/routing/merge-legs";

export class ValhallaResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValhallaResponseError";
  }
}

export function normalizeValhallaResponse(raw: ValhallaRouteResponse): readonly RouteLeg[] {
  const trip = raw.trip;
  if (!trip) {
    throw new ValhallaResponseError("Respons server rute tidak valid.");
  }

  if (trip.status === 400 || trip.status_message?.toLowerCase().includes("no suitable edges")) {
    throw new ValhallaResponseError("Tidak ditemukan rute yang dapat digunakan.");
  }

  if (trip.status !== undefined && trip.status !== 0) {
    throw new ValhallaResponseError("Server rute menolak permintaan.");
  }

  if (!trip.legs || trip.legs.length === 0) {
    throw new ValhallaResponseError("Respons server tidak mengandung rute.");
  }

  return trip.legs.map((leg, index) => normalizeLeg(leg, index, trip));
}

/** The whole primary trip collapsed into one leg. */
export function normalizeValhallaTrip(raw: ValhallaRouteResponse): RouteLeg {
  return mergeRouteLegs(normalizeValhallaResponse(raw));
}

/**
 * Valhalla has shipped two shapes for alternates: a list of trip wrappers at
 * the top level of the response, and a list of trips nested under `trip`.
 * Accept both so a server upgrade cannot silently drop every alternate.
 */
function collectAlternateTrips(raw: ValhallaRouteResponse): readonly ValhallaTrip[] {
  const trips: ValhallaTrip[] = [];

  for (const entry of raw.alternates ?? []) {
    if (!entry) continue;
    const candidate: ValhallaTrip = entry.trip ?? entry;
    if (candidate.legs && candidate.legs.length > 0) trips.push(candidate);
  }

  for (const entry of raw.trip?.alternates ?? []) {
    if (entry?.legs && entry.legs.length > 0) trips.push(entry);
  }

  return trips;
}

export function normalizeAlternateTrips(raw: ValhallaRouteResponse): readonly RouteLeg[] {
  const alternates: RouteLeg[] = [];

  for (const trip of collectAlternateTrips(raw)) {
    try {
      const legs = trip.legs!.map((leg, index) => normalizeLeg(leg, index, trip));
      alternates.push(mergeRouteLegs(legs));
    } catch {
      /* skip invalid alternate */
    }
  }

  return alternates;
}

function normalizeLeg(leg: ValhallaLeg, index: number, trip: ValhallaTrip): RouteLeg {
  if (!leg.shape) {
    throw new ValhallaResponseError("Rute tidak memiliki geometri.");
  }

  const geometry = decodePolyline6(leg.shape) as Position[];

  if (geometry.length < 2) {
    throw new ValhallaResponseError("Geometri rute terlalu pendek.");
  }

  /* The trip summary describes the whole trip, so it may only stand in for a
     leg when the trip has exactly one. */
  const singleLeg = (trip.legs?.length ?? 1) === 1;
  const distanceMeters =
    (leg.summary?.length ?? (singleLeg ? trip.summary?.length : undefined) ?? 0) * 1000;
  const durationSeconds =
    leg.summary?.time ?? (singleLeg ? trip.summary?.time : undefined) ?? 0;

  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    throw new ValhallaResponseError("Jarak rute tidak valid.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new ValhallaResponseError("Durasi rute tidak valid.");
  }

  const interval = leg.elevation_interval ?? ELEVATION_CONFIG.intervalMeters;
  const elevation = buildElevationSamples(leg.elevation ?? [], interval, distanceMeters);

  return {
    id: `leg-${index}-${crypto.randomUUID().slice(0, 8)}`,
    geometry,
    distanceMeters,
    durationSeconds,
    elevation,
    encodedShape: leg.shape,
  };
}

/**
 * Valhalla elevation arrays are distance-interval samples, not geometry
 * vertices. Element i maps to min(i * interval, legLength).
 */
export function buildElevationSamples(
  raw: readonly (number | null)[],
  interval: number,
  legLengthMeters: number,
): readonly ElevationSample[] {
  if (raw.length === 0 || legLengthMeters <= 0) return [];

  /* An array whose span cannot cover the leg — in either direction — cannot be
     mapped to route distance. Per the graceful-degradation rules the route
     stays valid and elevation simply becomes unavailable, so return no
     samples instead of rejecting the whole response. */
  const arraySpan = (raw.length - 1) * interval;
  const tolerance = Math.max(interval * 2, legLengthMeters * 0.01);
  if (Math.abs(arraySpan - legLengthMeters) > tolerance) {
    return [];
  }

  const samples: ElevationSample[] = [];

  for (let i = 0; i < raw.length; i++) {
    const distanceMeters = Math.min(i * interval, legLengthMeters);
    const value = raw[i];

    const isValid = value != null && Number.isFinite(value) && value > -500;

    samples.push({
      distanceMeters,
      elevationMeters: isValid ? value : null,
    });
  }

  return samples;
}
