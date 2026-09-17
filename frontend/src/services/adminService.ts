import { apiClient } from "./apiClient";

export const adminService = {
  async getUsers() {
    const response = await apiClient.get("/admin/users");
    return response.data;
  },

  async createUser(payload: any) {
    const response = await apiClient.post("/admin/users", payload);
    return response.data;
  },

  async assignJurisdictionOverride(payload: { UserID: number; DistrictID?: number; PoliceStationID?: number }) {
    const response = await apiClient.post("/admin/jurisdictions", payload);
    return response.data;
  },

  async getOfficers(params: { page?: number; pageSize?: number; search?: string } = {}) {
    const response = await apiClient.get("/officers", { params });
    return response.data;
  },

  async getOfficerDetails(officerId: number) {
    const response = await apiClient.get(`/officers/${officerId}`);
    return response.data;
  },

  async getAuditLogs() {
    const response = await apiClient.get("/audit");
    return response.data;
  },
};

