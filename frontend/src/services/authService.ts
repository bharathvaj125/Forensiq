import { apiClient } from "./apiClient";

export const authService = {
  async login(payload: any) {
    const params = new URLSearchParams({
      Username: payload.Username || payload.username || "",
      Password: payload.Password || payload.password || "",
    });
    const response = await apiClient.post("/auth/login", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  },
  async logout(refreshToken: string) {
    const params = new URLSearchParams({
      refresh_token: refreshToken || "",
    });
    await apiClient.post("/auth/logout", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await apiClient.post("/auth/change-password", { CurrentPassword: currentPassword, NewPassword: newPassword });
  },
  async getMe() {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
};
