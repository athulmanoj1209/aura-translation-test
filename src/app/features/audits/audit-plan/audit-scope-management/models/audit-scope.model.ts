/** Minimal company display fields, supplied by the caller (which has access to
 *  `CompanyDataService`) so a company that exists there but has never had a
 *  scope added yet can get a fresh wrapper here instead of silently dropping
 *  the scope. */
export interface CompanyMeta {
  companyName: string;
  tag?: string;
  color?: string;
}

export type ScopeType = 'subDivisional' | 'functional' | 'independent';
export type AuditFrequency = 'quarterly' | 'annually' | 'monthly';
export type ModeOfAudit = 'full' | 'limited' | 'thematic' | 'follow-up' | 'continuous';
export type SamplingMethodology = 'random' | 'risk-based' | 'judgmental';
export type ScopeRiskRating = 'low' | 'medium' | 'high';
/** Drives the Activate/Deactivate action — independent of `workflowStatus` below. */
export type ScopeRecordStatus = 'active' | 'inactive';
/** Drives the list's status badge (Not Started/Planned/In Progress/Overdue/Completed). */
export type ScopeStatus = 'Not Started' | 'Planned' | 'In Progress' | 'Overdue' | 'Completed' | 'Pending Review' | 'Approved' | 'Rejected';
/** Drives a task's status badge in the Sub-Scope profile drawer / add-task-audit list. */
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'overdue';

/**
 * A task associated with a scope or sub-scope (`StaticScope.tasks`) — the shape
 * mirrors `add-task-audit.ts`'s task form value (plus `id`/`status`, which that
 * form doesn't manage as form controls the same way) so tasks round-trip
 * losslessly between the static data and the Add/Edit Audit Scope drawer's
 * Tasks tab.
 */
export interface ScopeTask {
  id: string;
  taskName: string;
  status: TaskStatus;
  objective?: string;
  checklistItems?: string[];
  assignedAuditor?: string;
  startDate?: string;
  endDate?: string;
  controlRating?: string;
  riskPriority?: string;
  tags?: string[];
  description?: string;
}

export interface StaticScope {
  id: string;
  company: string;
  divisionCode: string;
  /** null for a division-level scope (one that sits directly under its division, not under a sub-division). */
  subDivisionName: string | null;
  /**
   * Stamped on add/edit: true when filed under a sub-division, false when filed
   * directly under the division. Absent on seed records (placement decides).
   */
  hasSubDivision?: boolean;
  /**
   * Division-level scopes: the `subDivisionCode`s (sub-division-static-data.ts)
   * of the division's sub-divisions, linking the scope to them.
   * Sub-division scopes: null — their sub-division is `subDivisionName`.
   */
  subDivisionsInfo: string[] | null;
  /** null = top-level scope; set = sub-scope of the scope with this id. */
  parentScopeId: string | null;
  scopeName: string;
  scopeType: ScopeType;
  linkedSubDivisions: string[];
  auditFrequency: AuditFrequency;
  modeOfAudit: ModeOfAudit;
  samplingMethodology: SamplingMethodology;
  samplingSize: number;
  startDate: string;
  endDate: string;
  assignedAuditors: string[];
  assignedReviewers: string[];
  objective?: string;
  justificationForSampling?: string;
  estimatedHours?: number | null;
  hourlyRate?: number | null;
  riskReferenceId?: string;
  riskRating?: ScopeRiskRating | null;
  completionNote?: string;
  status: ScopeRecordStatus;
  workflowStatus?: ScopeStatus;
  submittedBy?: string;
  submittedDate?: string;
  dueDate?: string | null;
  /** ISO timestamp — drives the list's newest-first sort. Stamped by `upsertStaticScope`. */
  createdAt: string;
  tasks?: ScopeTask[];
}

export interface StaticSubDivision {
  subDivisionName: string;
  company: string;
  divisionCode: string;
  scopes: StaticScope[];
}

export interface StaticDivision {
  divisionCode: string;
  divisionName: string;
  /** Mirrors the division module's `hasSubDivision` (division-static-data.ts). */
  hasSubDivision: boolean;
  company: string;
  /** Division-level scopes/sub-scopes (`subDivisionName: null`) — same flat parent/child layout as a sub-division's `scopes`. */
  scopes: StaticScope[];
  subDivisions: StaticSubDivision[];
}

export interface StaticCompany {
  id: string;
  companyName: string;
  tag: string;
  color: string;
  divisions: StaticDivision[];
}
