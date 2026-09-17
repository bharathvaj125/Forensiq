import { apiClient } from "./apiClient";

export const caseService = {
  async getCases(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    districtId?: number;
    stationId?: number;
    statusId?: number;
    sortBy?: string;
  } = {}) {
    const response = await apiClient.get("/cases", { params });
    return response.data;
  },

  async getDistrictsAndStations() {
    const response = await apiClient.get("/cases/districts-and-stations");
    return response.data;
  },

  async getCaseDetails(caseId: number) {
    const response = await apiClient.get(`/cases/${caseId}`);
    return response.data;
  },

  async addEvidence(caseId: number, payload: { EvidenceType: string; Description: string }) {
    const response = await apiClient.post(`/cases/${caseId}/evidence`, payload);
    return response.data;
  },

  async uploadEvidenceFile(caseId: number, formData: FormData) {
    const response = await apiClient.post(`/cases/${caseId}/upload-evidence`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async getCaseAccused(caseId: number) {
    const response = await apiClient.get(`/cases/${caseId}/accused`);
    return response.data;
  },

  async getCaseVictims(caseId: number) {
    const response = await apiClient.get(`/cases/${caseId}/victims`);
    return response.data;
  },

  async getCaseEvidence(caseId: number) {
    const response = await apiClient.get(`/cases/${caseId}/evidence`);
    return response.data;
  },

  async getCaseVehicles(caseId: number) {
    const response = await apiClient.get(`/cases/${caseId}/vehicles`);
    return response.data;
  },

  async getCaseWitnesses(caseId: number) {
    const response = await apiClient.get(`/cases/${caseId}/witnesses`);
    return response.data;
  },

  async registerCase(payload: any) {
    const response = await apiClient.post("/cases", payload);
    return response.data;
  },

  async updateCaseStatus(caseId: number, statusId: number) {
    const response = await apiClient.put(`/cases/${caseId}/status`, null, {
      params: { statusId },
    });
    return response.data;
  },

  async updateCasePriority(caseId: number, priority: string) {
    const response = await apiClient.put(`/cases/${caseId}/priority`, null, {
      params: { priority },
    });
    return response.data;
  },

  async addWitnessStatement(caseId: number, payload: any) {
    const response = await apiClient.post(`/cases/${caseId}/witnesses`, payload);
    return response.data;
  },

  async addAnnotation(caseId: number, payload: { NotesText: string; Category: string }) {
    const response = await apiClient.post(`/cases/${caseId}/annotations`, payload);
    return response.data;
  },

  async deleteAnnotation(annotationId: number) {
    const response = await apiClient.delete(`/cases/annotations/${annotationId}`);
    return response.data;
  },

  async assignInvestigator(caseId: number, payload: { OfficerID: number; AssignmentRole: string }) {
    const response = await apiClient.post(`/cases/${caseId}/assignments`, payload);
    return response.data;
  },

  async releaseInvestigator(assignmentId: number) {
    const response = await apiClient.delete(`/cases/assignments/${assignmentId}`);
    return response.data;
  },
};

