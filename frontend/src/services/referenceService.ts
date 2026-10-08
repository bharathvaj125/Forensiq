/** Lookup lists (districts, stations, crime types, statuses...) read from the database's reference tables. */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./apiClient";

export interface ReferenceOptions {
  districts: { id: number; name: string }[];
  stations: { id: number; name: string; district_id: number | null }[];
  crime_heads: { id: number; name: string }[];
  crime_subheads: { id: number; head_id: number | null; name: string }[];
  case_statuses: { id: number; name: string; group: "open" | "closed" }[];
  case_categories: { id: number; name: string }[];
  gravity_levels: { id: number; name: string }[];
  genders: { id: number; name: string }[];
  /** Terms already used in the records, so forms offer the vocabulary the data uses. */
  vocabulary: {
    injury_severity: string[]; relationship_to_accused: string[]; witness_type: string[];
    evidence_type: string[]; vehicle_type: string[]; vehicle_role: string[];
  };
}

export const referenceService = {
  async getOptions(): Promise<ReferenceOptions> {
    const response = await apiClient.get("/reference/options");
    return response.data;
  },
};

const EMPTY: ReferenceOptions = {
  districts: [], stations: [], crime_heads: [], crime_subheads: [], case_statuses: [], case_categories: [], gravity_levels: [], genders: [],
  vocabulary: { injury_severity: [], relationship_to_accused: [], witness_type: [], evidence_type: [], vehicle_type: [], vehicle_role: [] },
};

/** Cached for the session: reference tables change rarely. */
export function useReferenceOptions(): ReferenceOptions & { isLoading: boolean } {
  const { data, isLoading } = useQuery({ queryKey: ["referenceOptions"], queryFn: () => referenceService.getOptions(), staleTime: 30 * 60 * 1000 });
  return { ...(data ?? EMPTY), isLoading };
}
