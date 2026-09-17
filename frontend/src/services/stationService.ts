import { apiClient } from "./apiClient";

export interface StationCommandParams {
  stationId?: number;
  districtId?: number;
}

export const stationService = {
  async getStationCommandCenter(params?: StationCommandParams) {
    const response = await apiClient.get("/cases/station-command-center", { params });
    return response.data;
  },
};
