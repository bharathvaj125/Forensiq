import { apiClient } from "./apiClient";

export const searchService = {
  async unifiedSearch(query: string) {
    const response = await apiClient.get("/search", {
      params: { q: query },
    });
    return response.data;
  },
};

