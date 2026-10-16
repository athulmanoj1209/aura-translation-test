export type ScopeRequestType = 'Scope' | 'Subscope';
export type ScopeRequestStatus = 'pending_review' | 'rejected' | 'approved';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ScopeRequestRecord {
  id: string;
  name: string;
  type: ScopeRequestType;
  /** Display labels used by the requests list/filters. */
  company: string;
  division: string;
  subDivision: string;
  risk: RiskLevel;
  status: ScopeRequestStatus;
  submittedBy: string;
  submittedDate: string;
  dueDate: string | null;
  parentEntity: string;
  /** Full StaticScope record — everything the Add/Edit Audit Scope drawer needs. */
  scopePayload: Record<string, unknown>;
}

export type ScopeRequest = ScopeRequestRecord;
