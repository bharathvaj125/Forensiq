import { apiClient } from "./apiClient";

export interface PredictiveDashboardParams {
  districtId?: number;
  stationId?: number;
  crimeCategory?: string;
  datePreset?: string;
  startDate?: string;
  endDate?: string;
}

export interface PredictiveDashboard {
  total_cases_analyzed: number;
  predicted_30day_cases: number;
  growth_rate_pct: number;
  high_risk_hotspot_count: number;
  patrol_squads_recommended: number;
  early_warnings_active: number;
  backlog_workload_index: number;
  open_cases: number;
  peak_window: string | null;
  peak_window_share: number | null;
  peak_shift: string | null;
  hourly_distribution: { hour: number; count: number; peak_label: string | null }[];
  dow_distribution: { dow_index: number; day_name: string; count: number; pct: number }[];
  monthly_trend: { year_month: string; historical_count: number; forecast_count: number | null; data_type: string }[];
  district_rankings: { district_name: string; case_count: number; growth_pct: number; risk_level: string }[];
  station_rankings: { station_name: string; case_count: number; pending_cases: number; workload_score: number }[];
  category_rankings: { category_name: string; case_count: number; trend_direction: string }[];
  xai_explanations: { title: string; prediction: string; why_explanation: string; confidence: number | null; supporting_stats: string[]; data_sources: string }[];
  as_of_date: string | null;
  future_dated_cases_excluded: number;
  forecast_trend: string | null;
  forecast_backtest_accuracy: number | null;
  model_version: string;
}

export interface PredictiveHotspot {
  rank: number;
  location_name: string;
  latitude: number;
  longitude: number;
  hotspot_score: number;
  risk_level: string;
  case_count: number;
  repeat_offenders_count: number;
  pending_cases: number;
  peak_window: string;
  reason: string;
}

export interface PatrolStrategy {
  district_name: string;
  recommended_officers: number;
  recommended_cars: number;
  recommended_bikes: number;
  officers_per_unit: number;
  hotspots_considered: number;
  suggested_shift: string;
  suggested_timing: string;
  priority_level: string;
  patrol_route: string[];
  reasoning: string;
  resource_recommendations: { unit_type: string; quantity: number; justification: string; data_support: string }[];
}

export interface EarlyWarningAlert {
  alert_id: string;
  alert_type: string;
  title: string;
  confidence: number | null;
  risk_level: string;
  evidence: string;
  reason: string;
  affected_stations: string[];
  suggested_action: string;
}

export const predictiveService = {
  async getDashboard(params?: PredictiveDashboardParams): Promise<PredictiveDashboard> {
    const response = await apiClient.get("/predictive/dashboard", { params });
    return response.data;
  },

  async getHotspots(params?: { districtId?: number; stationId?: number; crimeCategory?: string }): Promise<{ total_hotspots: number; hotspots: PredictiveHotspot[]; model_version: string }> {
    const response = await apiClient.get("/predictive/hotspots", { params });
    return response.data;
  },

  async getPatrolStrategy(params?: { districtId?: number; stationId?: number }): Promise<PatrolStrategy> {
    const response = await apiClient.get("/predictive/patrol-strategy", { params });
    return response.data;
  },

  async getEarlyWarnings(params?: { districtId?: number }): Promise<{ active_alerts_count: number; alerts: EarlyWarningAlert[] }> {
    const response = await apiClient.get("/predictive/early-warnings", { params });
    return response.data;
  },

  async queryAssistant(query: string, districtId?: number, stationId?: number): Promise<{ query: string; answer: string; recommended_actions: string[] }> {
    const response = await apiClient.post("/predictive/assistant-query", {
      query,
      district_id: districtId,
      station_id: stationId,
    });
    return response.data;
  },
};
