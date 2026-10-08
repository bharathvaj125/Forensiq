import { apiClient } from "./apiClient";

export interface AdminUser {
  UserID: number;
  Username: string;
  Email: string;
  IsActive: boolean;
  CreatedAt: string;
  role: { RoleID: number; RoleName: string; Description: string } | null;
  OfficerID: number | null;
  OfficerName: string | null;
  Rank: string | null;
  BadgeNumber: string | null;
  ScopeLevel: string;
  ScopeDescription: string;
}

export interface RoleDetail {
  RoleID: number;
  RoleName: string;
  Description: string | null;
  Permissions: string[];
  ScopeLevel: string;
  Users: number;
}

export interface NewOfficerAccount {
  Username: string;
  Password: string;
  Email: string;
  RoleID: number;
  Rank: string;
  OfficerName: string;
  BadgeNumber: string;
  DistrictID?: number;
  PoliceStationID?: number;
}

export interface SystemHealth {
  database: { dialect: string; healthy: boolean; latency_ms: number; size_bytes: number | null; fallback_active: boolean };
  tables: { table_name: string; row_count: number; size_bytes: number | null }[];
  models: { name: string; version: string | null; detail?: Record<string, any> }[];
  scoring: { cases: number; scored_with_current_model: number };
  embeddings: { embedded_cases: number; cases: number };
  assistant: { configured: boolean; available: boolean; models: string[]; retry_in_seconds: number | null };
  activity_24h: { ai_runs: number; audit_events: number; active_users: number };
  as_of_date: string;
}

export const adminService = {
  async getUsers(): Promise<AdminUser[]> {
    const response = await apiClient.get("/admin/users");
    return response.data;
  },

  async getRoles(): Promise<RoleDetail[]> {
    const response = await apiClient.get("/admin/roles");
    return response.data;
  },

  async createUser(payload: NewOfficerAccount): Promise<AdminUser> {
    const response = await apiClient.post("/admin/users", payload);
    return response.data;
  },

  async updateUserRole(userId: number, roleId: number): Promise<AdminUser> {
    const response = await apiClient.patch(`/admin/users/${userId}/role`, { RoleID: roleId });
    return response.data;
  },

  async setUserActive(userId: number, isActive: boolean): Promise<AdminUser> {
    const response = await apiClient.patch(`/admin/users/${userId}/active`, { IsActive: isActive });
    return response.data;
  },

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/reset-password`, { NewPassword: newPassword });
  },

  async getSystemHealth(): Promise<SystemHealth> {
    const response = await apiClient.get("/admin/system-health");
    return response.data;
  },

  async getOfficers(params: { page?: number; pageSize?: number; search?: string } = {}) {
    const response = await apiClient.get("/officers", { params });
    return response.data;
  },

  async getAuditLogs(): Promise<any[]> {
    const response = await apiClient.get("/audit", { params: { pageSize: 100 } });
    return response.data;
  },
};
