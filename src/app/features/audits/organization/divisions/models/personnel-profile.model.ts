// ─── Personnel profile types ────────────────────────────────────────────────
export interface PersonnelProfile {
  id: string;
  displayName: string;
  role: string;
  experienceYears: number;
  expertise: string[];
  workload: number;
  totalAudits?: number;
  completedAudits?: number;
}

export interface ReviewerProfile extends PersonnelProfile {
  totalReviews: number;
  completedReviews: number;
}
