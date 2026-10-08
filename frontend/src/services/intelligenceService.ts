/** Client for the risk, anomaly, forecast, similarity and repeat-offender endpoints. */

import { apiClient } from "./apiClient";

export const intelligenceService = {
  async getCaseAnomalies() {
    const response = await apiClient.get("/intelligence/anomalies");
    return response.data;
  },

  async getRepeatOffenders(accusedId: number) {
    const response = await apiClient.get(`/intelligence/offenders/${accusedId}/repeat-offender-matches`);
    return response.data;
  },

  async getCrimeTrendForecast(horizonDays: number = 7) {
    const response = await apiClient.get("/intelligence/forecast/crime-trend", {
      params: { horizon_days: horizonDays },
    });
    return response.data;
  },

  async backfillEmbeddings(limit: number = 250) {
    const response = await apiClient.post("/intelligence/embeddings/backfill", null, {
      params: { limit },
    });
    return response.data;
  },

  async getSimilarCases(caseId: number, limit: number = 10) {
    const response = await apiClient.get(`/intelligence/cases/${caseId}/similar`, {
      params: { limit },
    });
    return response.data;
  },

  async predictCaseRisk(caseId: number) {
    const response = await apiClient.get(`/intelligence/cases/${caseId}/predict`);
    return response.data;
  },
};
