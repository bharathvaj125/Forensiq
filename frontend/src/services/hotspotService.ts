/**
 * Typed client for /hotspots endpoints. Used by: corresponding module's hooks/components.
 *
 * NOTE: Scaffold placeholder only. Implementation to be added
 * during the corresponding roadmap milestone.
 */

import { apiClient } from "./apiClient";

export const hotspotService = {
  async getHotspots(districtId?: number, crimeType?: string, stationId?: number) {
    const params: any = {};
    if (districtId) params.districtId = districtId;
    if (crimeType) params.crimeType = crimeType;
    if (stationId !== undefined) params.stationId = stationId;
    const response = await apiClient.get("/hotspot", { params });
    return response.data;
  },

  async getPredictedHotspots() {
    const response = await apiClient.get("/hotspot/predicted");
    return response.data;
  },
};
