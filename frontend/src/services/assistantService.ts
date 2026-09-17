/**
 * Typed client for /assistant/chat endpoint (incl. WebSocket/stream handling). Used by: corresponding module's hooks/components.
 *
 * NOTE: Scaffold placeholder only. Implementation to be added
 * during the corresponding roadmap milestone.
 */

import { apiClient } from "./apiClient";

export const assistantService = {
  async queryAssistant(query: string) {
    const response = await apiClient.post("/assistant/query", { query });
    return response.data;
  },
};
