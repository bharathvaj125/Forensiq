import { apiClient } from "./apiClient";

export const notificationService = {
  async getNotifications() {
    const response = await apiClient.get("/notifications");
    return response.data;
  },

  async markAsRead(id: number) {
    const response = await apiClient.put(`/notifications/${id}/read`);
    return response.data;
  },

  async deleteNotification(id: number) {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  },

  async clearAll() {
    const response = await apiClient.delete("/notifications");
    return response.data;
  },
};
