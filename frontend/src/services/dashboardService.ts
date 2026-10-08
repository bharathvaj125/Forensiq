import { apiClient } from "./apiClient";

export interface DashboardScope {
  districtId?: number;
  stationId?: number;
}

export const dashboardService = {
  async getSummary(scope: DashboardScope = {}) {
    const response = await apiClient.get("/dashboard/summary", { params: scope });
    return response.data;
  },

  async getWorkspace() {
    const response = await apiClient.get("/dashboard/workspace");
    return response.data;
  },

  async getHealth() {
    const root = (apiClient.defaults.baseURL || "").replace(/\/api\/v1\/?$/, "");
    const response = await apiClient.get("/health", { baseURL: root });
    return response.data as { status: string; database: string; dialect?: string };
  },
};
