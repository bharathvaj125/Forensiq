import { apiClient } from "./apiClient";

export interface ExternalAgency {
  AgencyID: number;
  AgencyCode: string;
  AgencyName: string;
  AgencyType: string;
  HeadOffice?: string;
  OfficialEmail: string;
  ContactNumber?: string;
  Status: string;
}

export interface ExternalAgencyOfficer {
  AgencyOfficerID: number;
  AgencyID: number;
  AgencyCode?: string;
  AgencyName?: string;
  OfficerIDCode: string;
  Username: string;
  AccessPassword?: string;
  OfficerName: string;
  Designation: string;
  OfficialEmail: string;
  Phone?: string;
  IdentityNumber?: string;
  Status: string;
}

export const collaborationService = {
  async officerLogin(credentials: any) {
    const response = await apiClient.post("/collaboration/officer-login", credentials);
    return response.data;
  },

  async getAgencies() {
    const response = await apiClient.get<ExternalAgency[]>("/collaboration/agencies");
    return response.data;
  },

  async createAgency(data: any) {
    const response = await apiClient.post<ExternalAgency>("/collaboration/agencies", data);
    return response.data;
  },

  async getAgencyOfficers(agencyId?: number) {
    const response = await apiClient.get<ExternalAgencyOfficer[]>("/collaboration/agency-officers", {
      params: agencyId ? { agency_id: agencyId } : {},
    });
    return response.data;
  },

  async createAgencyOfficer(data: any) {
    const response = await apiClient.post<ExternalAgencyOfficer>("/collaboration/agency-officers", data);
    return response.data;
  },

  async submitOfficerRequest(data: any) {
    const response = await apiClient.post("/collaboration/officer-request", data);
    return response.data;
  },

  async getAiRecommendation(caseId: number) {
    const response = await apiClient.get(`/collaboration/ai-recommendation/${caseId}`);
    return response.data;
  },

  async getCollaborationRequests() {
    const response = await apiClient.get("/collaboration/requests");
    return response.data;
  },

  async approveCollaborationRequest(requestId: number, approvalConfig: any) {
    const response = await apiClient.post(`/collaboration/requests/${requestId}/approve`, approvalConfig);
    return response.data;
  },

  async rejectCollaborationRequest(requestId: number, remarks: string) {
    const response = await apiClient.post(`/collaboration/requests/${requestId}/reject`, { remarks });
    return response.data;
  },

  async getExternalWorkspace(officerId?: number) {
    const response = await apiClient.get(`/collaboration/external-workspace`, {
      params: officerId ? { officer_id: officerId } : {},
    });
    return response.data;
  },

  async getAuditLogs() {
    const response = await apiClient.get("/collaboration/audit-logs");
    return response.data;
  },
};
