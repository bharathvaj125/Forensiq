/** Typed client for the /hotspot endpoints (map points, KDE hotspots and the map's filter layers). */

import { apiClient } from "./apiClient";

export interface HotspotFilters {
  districtId?: number;
  stationId?: number;
  crimeType?: string;
}

export interface MapPoint {
  latitude: number;
  longitude: number;
  CaseMasterID: number | null;
  CaseNo: string | null;
  BriefFacts: string | null;
  PoliceStationName: string | null;
  CrimeHeadName: string | null;
  AIRiskScore: number | null;
  AIRiskLevel: string | null;
  IncidentFromDate: string | null;
}

export interface MapPointsResponse {
  points: MapPoint[];
  total_points: number;
  total_matching: number;
}

export interface PredictedHotspot {
  rank: number;
  latitude: number;
  longitude: number;
  relative_density: number;
  radius_m: number;
  location_name: string;
  district_name: string | null;
  case_count: number;
  open_cases: number;
  high_risk_cases: number;
  high_risk_lift: number;
  repeat_offender_profiles: number;
  top_crimes: { name: string; cases: number }[];
  peak_window: string | null;
  risk_level: string;
  reason: string;
  top_factors: string[];
}

export interface PredictedHotspotsResponse {
  model_version: string;
  as_of_date: string | null;
  hotspots: PredictedHotspot[];
  warning?: string | null;
}

export interface MapLayers {
  as_of_date: string;
  geocoded_cases: number;
  bounds: [[number, number], [number, number]] | null;
  districts: { id: number; name: string; latitude: number; longitude: number; cases: number }[];
  stations: { id: number; name: string; district_id: number | null; latitude: number; longitude: number; cases: number }[];
  crime_heads: { id: number; name: string; cases: number }[];
}

const toParams = (filters: HotspotFilters) => ({
  districtId: filters.districtId || undefined,
  stationId: filters.stationId || undefined,
  crimeType: filters.crimeType || undefined,
});

export const hotspotService = {
  async getLayers(): Promise<MapLayers> {
    const response = await apiClient.get("/hotspot/layers");
    return response.data;
  },

  async getHotspots(filters: HotspotFilters = {}, limit = 2000): Promise<MapPointsResponse> {
    const response = await apiClient.get("/hotspot", { params: { ...toParams(filters), limit } });
    return response.data;
  },

  async getPredictedHotspots(filters: HotspotFilters = {}): Promise<PredictedHotspotsResponse> {
    const response = await apiClient.get("/hotspot/predicted", { params: toParams(filters) });
    return response.data;
  },
};
