import { apiClient } from "./apiClient";

export interface CourtCaseData {
  CourtCaseID?: number;
  CaseNo: string;
  FIRNo?: string;
  DistrictName?: string;
  PoliceStationName?: string;
  CourtName: string;
  JudgeBench?: string;
  PublicProsecutor?: string;
  DefenseCounsel?: string;
  TrialStage: string;
  CaseStatus?: string;
  NextHearingDate?: string;
  OrderNotes?: string;
  OffenceSummary?: string;
  BNSSections?: string;
  AccusedNames?: string;
  ComplainantName?: string;
  Milestones?: Array<{
    stage: string;
    date: string;
    status: string;
    note: string;
  }>;
}

export const courtService = {
  async getCases(status?: string, search?: string): Promise<CourtCaseData[]> {
    const params: any = {};
    if (status && status !== "All") params.case_status = status;
    if (search) params.search = search;
    const response = await apiClient.get("/court/cases", { params });
    return response.data;
  },

  async createCase(data: CourtCaseData): Promise<any> {
    const response = await apiClient.post("/court/cases", data);
    return response.data;
  }
};
