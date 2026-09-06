import type { RoutingProvider, ProviderRouteRequest } from "@/providers/contracts";
import type { RouteLeg, RoadSegment } from "@/domain/route";
import type {
  ValhallaRouteResponse,
  ValhallaTraceRequest,
  ValhallaTraceResponse,
  ValhallaEdge,
} from "./valhalla-types";
import { buildValhallaRequest } from "./build-valhalla-request";
import {
  normalizeValhallaTrip,
  normalizeAlternateTrips,
  ValhallaResponseError,
} from "./normalize-valhalla-response";
import { getRuntimeConfig } from "@/config/runtime-config";
import { abortableFetch } from "@/lib/abortable-request";

export function createValhallaProvider(): RoutingProvider {
  const config = getRuntimeConfig();
  if (!config) {
    throw new Error("Runtime config belum dimuat.");
  }
  const baseUrl = config.valhallaBaseUrl.replace(/\/+$/, "");

  async function postRoute(
    input: ProviderRouteRequest,
    signal: AbortSignal,
  ): Promise<ValhallaRouteResponse> {
    const body = buildValhallaRequest(input);

    const result = await abortableFetch<ValhallaRouteResponse>(
      `${baseUrl}/route`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );

    if (!result.ok) {
      /* Developer-facing only: the UI shows the Indonesian copy below, never
         the server's own words. Without this line a production report gives
         us a bare 400 and nothing to act on. */
      console.warn(
        "[ridetopo] Valhalla /route failed",
        JSON.stringify({
          status: result.status ?? null,
          code: result.code ?? null,
          detail: result.error,
          penalised: Boolean(body.linear_cost_factors),
          shapeChars:
            typeof body.linear_cost_factors?.[0]?.shape === "string"
              ? body.linear_cost_factors[0].shape.length
              : 0,
          locations: body.locations.length,
          exclusions: body.exclude_locations?.length ?? 0,
          alternates: body.alternates ?? 0,
        }),
      );
      throw new ValhallaResponseError("Gagal menghubungi server rute.");
    }

    return result.data as ValhallaRouteResponse;
  }

  return {
    /* One element per trip. A trip with intermediate waypoints arrives as
       several Valhalla legs and is collapsed into one before it leaves the
       provider boundary. */
    async route(input: ProviderRouteRequest, signal: AbortSignal): Promise<readonly RouteLeg[]> {
      const raw = await postRoute(input, signal);
      return [normalizeValhallaTrip(raw)];
    },

    async routeCandidates(
      input: ProviderRouteRequest,
      signal: AbortSignal,
    ): Promise<readonly RouteLeg[]> {
      const raw = await postRoute(input, signal);
      return [normalizeValhallaTrip(raw), ...normalizeAlternateTrips(raw)];
    },

    async traceAttributes(encodedShape: string, signal: AbortSignal): Promise<readonly RoadSegment[]> {
      const body: ValhallaTraceRequest = {
        encoded_polyline: encodedShape,
        shape_match: "edge_walk",
        costing: "bicycle",
        filters: {
          attributes: [
            "edge.names",
            "edge.road_class",
            "edge.surface",
            "edge.unpaved",
            "edge.use",
            "edge.begin_shape_index",
            "edge.end_shape_index",
            "edge.way_id",
          ],
          action: "include",
        },
      };

      const result = await abortableFetch<ValhallaTraceResponse>(
        `${baseUrl}/trace_attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        signal,
      );

      if (!result.ok) {
        throw new Error("Gagal memuat data jalan.");
      }

      if (!result.data?.edges) {
        return [];
      }

      return result.data.edges.map((edge: ValhallaEdge, idx: number) => ({
        id: `edge-${idx}-${edge.way_id ?? idx}`,
        beginShapeIndex: edge.begin_shape_index ?? 0,
        endShapeIndex: edge.end_shape_index ?? 0,
        name: edge.names?.[0] ?? null,
        roadClass: mapRoadClass(edge.road_class ?? "other"),
        surface: edge.surface ?? null,
        unpaved: edge.unpaved ?? null,
        use: edge.use ?? null,
        wayId: edge.way_id != null ? String(edge.way_id) : null,
      }));
    },
  };
}

function mapRoadClass(raw: string): RoadSegment["roadClass"] {
  const mapping: Record<string, RoadSegment["roadClass"]> = {
    motorway: "motorway",
    motorway_link: "motorway",
    trunk: "trunk",
    trunk_link: "trunk",
    primary: "primary",
    primary_link: "primary",
    secondary: "secondary",
    secondary_link: "secondary",
    tertiary: "tertiary",
    tertiary_link: "tertiary",
    unclassified: "unclassified",
    residential: "residential",
    service: "service",
    service_other: "service",
    service_driveway: "service",
    service_parking_aisle: "service",
    service_emergency_access: "service",
    service_alley: "service",
    cycleway: "cycleway",
    footway: "cycleway",
    path: "cycleway",
    living_street: "residential",
    pedestrian: "other",
    track: "other",
    bridleway: "other",
  };
  return mapping[raw] ?? "other";
}
