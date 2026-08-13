import type { Position } from "@/domain/geo";
import type { RouteLeg, ElevationSample } from "@/domain/route";
import type { ValhallaRouteResponse, ValhallaLeg, ValhallaTrip } from "./valhalla-types";
import { decodePolyline6 } from "@/lib/polyline6";
import { ELEVATION_CONFIG } from "@/domain/route";

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

export function normalizeAlternateTrips(raw: ValhallaRouteResponse): readonly RouteLeg[] {
  const trip = raw.trip;
  if (!trip || !trip.alternates || trip.alternates.length === 0) {
    return [];
  }

  const alternates: RouteLeg[] = [];
  for (const alt of trip.alternates) {
    if (!alt.legs || alt.legs.length === 0) continue;
    try {
      alternates.push(normalizeLeg(alt.legs[0]!, alternates.length, alt));
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

  const distanceMeters = (leg.summary?.length ?? trip.summary?.length ?? 0) * 1000;
  const durationSeconds = leg.summary?.time ?? trip.summary?.time ?? 0;

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

  const samples: ElevationSample[] = [];
  const tolerance = interval;

  for (let i = 0; i < raw.length; i++) {
    const distanceMeters = Math.min(i * interval, legLengthMeters);
    const value = raw[i];

    const isValid = value != null && Number.isFinite(value) && value > -500;

    samples.push({
      distanceMeters,
      elevationMeters: isValid ? value : null,
    });
  }

  /* Reject arrays whose span cannot reasonably map to the leg length */
  const arraySpan = (raw.length - 1) * interval;
  if (arraySpan - legLengthMeters > tolerance) {
    throw new ValhallaResponseError("Data elevasi tidak cocok dengan panjang rute.");
  }

  return samples;
}
