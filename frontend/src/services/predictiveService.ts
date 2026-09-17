import { apiClient } from "./apiClient";

export interface PredictiveDashboardParams {
  districtId?: number;
  stationId?: number;
  crimeCategory?: string;
  datePreset?: string;
  startDate?: string;
  endDate?: string;
}

export const predictiveService = {
  async getDashboard(params?: PredictiveDashboardParams) {
    const response = await apiClient.get("/predictive/dashboard", { params });
    return response.data;
  },

  async getHotspots(params?: { districtId?: number; stationId?: number; crimeCategory?: string }) {
    const response = await apiClient.get("/predictive/hotspots", { params });
    return response.data;
  },

  async getPatrolStrategy(params?: { districtId?: number; stationId?: number }) {
    const response = await apiClient.get("/predictive/patrol-strategy", { params });
    return response.data;
  },

  async getEarlyWarnings(params?: { districtId?: number }) {
    const response = await apiClient.get("/predictive/early-warnings", { params });
    return response.data;
  },

  async queryAssistant(query: string, districtId?: number, stationId?: number) {
    const response = await apiClient.post("/predictive/assistant-query", {
      query,
      district_id: districtId,
      station_id: stationId,
    });
    return response.data;
  },
};
