import type { RoutingProvider, ProviderRouteRequest } from "@/providers/contracts";
import type { RouteLeg, RoadSegment } from "@/domain/route";
import type { ValhallaRouteResponse, ValhallaTraceRequest, ValhallaTraceResponse, ValhallaEdge } from "./valhalla-types";
import { buildValhallaRequest } from "./build-valhalla-request";
import { normalizeValhallaResponse, ValhallaResponseError } from "./normalize-valhalla-response";
import { getRuntimeConfig } from "@/config/runtime-config";
import { abortableFetch } from "@/lib/abortable-request";

export function createValhallaProvider(): RoutingProvider {
  const config = getRuntimeConfig();
  if (!config) {
    throw new Error("Runtime config not loaded");
  }
  const baseUrl = config.valhallaBaseUrl.replace(/\/+$/, "");

  return {
    async route(input: ProviderRouteRequest, signal: AbortSignal): Promise<readonly RouteLeg[]> {
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
        if (result.error === "aborted") {
          throw new DOMException("Aborted", "AbortError");
        }
        throw new ValhallaResponseError(result.error ?? "Gagal menghubungi server rute.");
      }

      return normalizeValhallaResponse(result.data!);
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
        throw new Error(result.error ?? "Gagal memuat data jalan.");
      }

      if (!result.data?.edges) {
        return [];
      }

      return result.data.edges.map((edge: ValhallaEdge, idx: number) => ({
        id: `edge-${idx}-${edge.way_id ?? 0}`,
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
    trunk: "trunk",
    primary: "primary",
    secondary: "secondary",
    tertiary: "tertiary",
    unclassified: "unclassified",
    residential: "residential",
    service: "service",
    cycleway: "cycleway",
    footway: "cycleway",
    path: "cycleway",
  };
  return mapping[raw] ?? "other";
}
