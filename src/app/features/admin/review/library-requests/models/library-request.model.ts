import type { ScopeLibraryItem } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library.model';
import type { RfiLibraryItem } from '@/app/features/audits/libraries/rfi-management-library/models/rfi-library.model';

export type LibRequestType = 'Scope' | 'Subscope' | 'RFI';
export type LibRequestStatus = 'pending_review' | 'rejected' | 'approved';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LibRequestRecord {
  id: string;
  name: string;
  type: LibRequestType;
  /** Display labels used by the requests list/filters. */
  company: string;
  division: string;
  subDivision: string;
  category: string;
  risk: RiskLevel;
  status: LibRequestStatus;
  submittedBy: string;
  submittedDate: string;
  parentEntity: string;
  /** Full ScopeLibraryItem record — present for type === 'Scope' | 'Subscope'. */
  scopePayload?: ScopeLibraryItem;
  /** Full RfiLibraryItem record — present for type === 'RFI'. */
  rfiPayload?: RfiLibraryItem;
}

export type LibRequest = LibRequestRecord;
