import { apiClient } from "./apiClient";

export interface TaskTimelineEvent {
  EventID: number;
  TaskID: number;
  Status: string;
  Note?: string;
  UpdatedByUserID: number;
  UpdatedByUsername?: string;
  Timestamp: string;
}

export interface TaskDelegation {
  TaskID: number;
  Title: string;
  Description: string;
  CaseMasterID?: number;
  CaseNo?: string;
  AssignedByUserID: number;
  AssignedByUsername?: string;
  AssignedByRank?: string;
  AssignedToUserID: number;
  AssignedToUsername?: string;
  AssignedToRank?: string;
  DistrictID?: number;
  UnitID?: number;
  Priority: string;
  Status: string;
  DueDate?: string;
  CreatedAt: string;
  UpdatedAt: string;
  timeline_events: TaskTimelineEvent[];
}

export interface TaskCreatePayload {
  Title: string;
  Description: string;
  AssignedToUserID: number;
  CaseMasterID?: number;
  DistrictID?: number;
  UnitID?: number;
  Priority?: string;
  DueDate?: string;
}

export const taskService = {
  appointTask: async (payload: TaskCreatePayload): Promise<TaskDelegation> => {
    const res = await apiClient.post("/tasks/", payload);
    return res.data;
  },

  getTasksAssignedByMe: async (): Promise<TaskDelegation[]> => {
    const res = await apiClient.get("/tasks/assigned-by-me");
    return res.data;
  },

  getTasksAssignedToMe: async (): Promise<TaskDelegation[]> => {
    const res = await apiClient.get("/tasks/assigned-to-me");
    return res.data;
  },

  updateTaskStatus: async (taskId: number, status: string, note?: string): Promise<TaskDelegation> => {
    const res = await apiClient.put(`/tasks/${taskId}/status`, { Status: status, Note: note });
    return res.data;
  },

  getSubordinateOfficers: async (): Promise<any[]> => {
    const res = await apiClient.get("/tasks/subordinate-officers");
    return res.data;
  },
};
