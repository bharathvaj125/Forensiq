/** Typed client for the /assistant endpoints (data-grounded chat). */

import { apiClient } from "./apiClient";

export interface AssistantStatus {
  configured: boolean;
  available: boolean;
  models: string[];
  retry_in_seconds: number | null;
  cases_in_scope: number;
  embedded_cases: number;
  as_of_date: string;
}

export interface AssistantAnswer {
  answer: string;
  source_case_ids: number[];
  model_version: string;
  download_url: string | null;
  tools_used: string[];
}

export const assistantService = {
  async getStatus(): Promise<AssistantStatus> {
    const response = await apiClient.get("/assistant/status");
    return response.data;
  },

  async queryAssistant(query: string): Promise<AssistantAnswer> {
    const response = await apiClient.post("/assistant/query", { query });
    return response.data;
  },
};
