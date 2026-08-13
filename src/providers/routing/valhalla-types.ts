export interface ValhallaLocation {
  lat: number;
  lon: number;
  type?: string;
  name?: string;
}

export interface ValhallaCostingOptions {
  bicycle_type?: string;
  use_roads?: number;
  use_hills?: number;
}

export type ValhallaLinearCostShape =
  | string
  | { type: "LineString"; coordinates: readonly (readonly [number, number])[] };

export interface ValhallaLinearCostFactor {
  shape: ValhallaLinearCostShape;
  factor: number;
}

export interface ValhallaRouteRequest {
  locations: ValhallaLocation[];
  costing: string;
  costing_options?: Record<string, ValhallaCostingOptions>;
  directions_options?: {
    units?: string;
  };
  elevation_interval?: number;
  exclude_locations?: ValhallaLocation[];
  alternates?: number;
  linear_cost_factors?: readonly ValhallaLinearCostFactor[];
}

export interface ValhallaSummary {
  length?: number;
  time?: number;
  min_lat?: number;
  max_lat?: number;
  min_lon?: number;
  max_lon?: number;
}

export interface ValhallaLeg {
  shape?: string;
  summary?: ValhallaSummary;
  elevation?: (number | null)[];
  elevation_interval?: number;
}

export interface ValhallaTrip {
  status?: number;
  status_message?: string;
  units?: string;
  language?: string;
  legs?: ValhallaLeg[];
  summary?: ValhallaSummary;
  alternates?: ValhallaTrip[];
}

export interface ValhallaRouteResponse {
  trip?: ValhallaTrip;
  error?: string;
}

export interface ValhallaTraceRequest {
  encoded_polyline: string;
  shape_match: string;
  costing: string;
  filters?: {
    attributes?: string[];
    action?: string;
  };
}

export interface ValhallaTraceResponse {
  edges?: ValhallaEdge[];
  error?: string;
}

export interface ValhallaEdge {
  begin_shape_index?: number;
  end_shape_index?: number;
  names?: string[];
  road_class?: string;
  surface?: string;
  unpaved?: boolean;
  use?: string;
  way_id?: number;
  weighted_grade?: number;
}
