import { apiClient } from "./apiClient";

export interface CourtMilestone {
  stage: string;
  date: string;
  status: string;
  note: string;
}

export interface CourtCaseItem {
  CaseMasterID: number;
  CaseNo: string;
  FIRNo: string | null;
  DistrictName: string | null;
  PoliceStationName: string | null;
  CourtName: string | null;
  RegisteredDate: string;
  TrialStage: string;
  CaseStatus: string;
  RecordedStatus: string;
  OffenceSummary: string;
  AccusedNames: string | null;
  AIRiskLevel: string | null;
  JudgeBench: string | null;
  PublicProsecutor: string | null;
  DefenseCounsel: string | null;
  NextHearingDate: string | null;
  OrderNotes: string | null;
  Milestones: CourtMilestone[];
}

export interface CourtCasesResponse {
  total: number;
  stage_counts: Record<string, number>;
  hearings: { records: number; scheduled: number; next_7_days: number; overdue: number };
  future_dated_excluded: number;
  as_of_date: string;
  items: CourtCaseItem[];
}

export interface HearingUpdate {
  TrialStage?: string;
  CaseStatus?: string;
  JudgeBench?: string;
  PublicProsecutor?: string;
  DefenseCounsel?: string;
  NextHearingDate?: string;
  OrderNotes?: string;
}

export const courtService = {
  async getCases(params: { stage?: string; search?: string; limit?: number; offset?: number }): Promise<CourtCasesResponse> {
    const response = await apiClient.get("/court/cases", {
      params: { stage: params.stage && params.stage !== "all" ? params.stage : undefined, search: params.search || undefined,
                limit: params.limit, offset: params.offset },
    });
    return response.data;
  },

  async recordHearing(caseMasterId: number, update: HearingUpdate): Promise<void> {
    await apiClient.put(`/court/cases/${caseMasterId}/hearing`, update);
  },
};
