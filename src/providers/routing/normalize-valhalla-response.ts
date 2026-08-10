import type { Position } from "@/domain/geo";
import type { RouteLeg, ElevationSample } from "@/domain/route";
import type { ValhallaRouteResponse, ValhallaLeg } from "./valhalla-types";
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
    throw new ValhallaResponseError("Respons Valhalla tidak valid: trip tidak ditemukan.");
  }

  if (trip.status === 400 || trip.status_message?.includes("No suitable edges")) {
    throw new ValhallaResponseError("Tidak ditemukan rute yang dapat digunakan.");
  }

  if (!trip.legs || trip.legs.length === 0) {
    throw new ValhallaResponseError("Respons Valhalla tidak mengandung legs.");
  }

  return trip.legs.map((leg, index) => normalizeLeg(leg, index));
}

function normalizeLeg(leg: ValhallaLeg, index: number): RouteLeg {
  if (!leg.shape) {
    throw new ValhallaResponseError(`Leg ${index}: shape tidak ditemukan.`);
  }

  const geometry = decodePolyline6(leg.shape) as Position[];

  if (geometry.length < 2) {
    throw new ValhallaResponseError(`Leg ${index}: geometri terlalu pendek.`);
  }

  const distanceMeters = (leg.summary?.length ?? 0) * 1000;
  const durationSeconds = leg.summary?.time ?? 0;

  const elevation = buildElevationSamples(leg.elevation ?? [], leg.elevation_interval ?? ELEVATION_CONFIG.intervalMeters, geometry);

  return {
    id: `leg-${index}-${crypto.randomUUID().slice(0, 8)}`,
    geometry,
    distanceMeters,
    durationSeconds,
    elevation,
    encodedShape: leg.shape,
  };
}

function buildElevationSamples(
  raw: readonly (number | null)[],
  interval: number,
  geometry: readonly Position[],
): readonly ElevationSample[] {
  const samples: ElevationSample[] = [];

  for (let i = 0; i < geometry.length; i++) {
    const distanceMeters = i * interval;
    const elevationValue = i < raw.length ? raw[i] : null;
    const validElevation =
      elevationValue != null &&
      Number.isFinite(elevationValue) &&
      elevationValue > -500;

    samples.push({
      distanceMeters,
      elevationMeters: validElevation ? elevationValue as number : null,
    });
  }

  return samples;
}
