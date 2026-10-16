import type { Scope, SubScope } from '@/app/features/audits/organization/divisions/models/division.model';
import type { StaticScope } from './audit-scope.model';

export interface AddAuditScopeDrawerData {
  mode: 'add' | 'view' | 'edit';
  approvalMode?: boolean;
  /** Current workflow status of the request being reviewed — approve/reject controls only show when this is 'pending_review'. */
  requestStatus?: string;
  scope?: any | null;
  initialTab?: number;
  subScopeIndex?: number;
  availableScopeOptions?: { label: string; value: string }[];
}

export interface AddAuditScopeDrawerResult {
  saved?: any;
  /** New scope/sub-scope built from the form (add mode). */
  scope?: Omit<StaticScope, 'id'>;
  /** Updated fields for the scope/sub-scope being edited (edit mode). */
  scopeUpdate?: Omit<StaticScope, 'id'>;
  approval?: { action: 'approve' | 'reject'; notes: string };
}

export interface ScopeProfileDrawerData {
  scope: Scope | null;
  subscope?: SubScope | null;
  parentName?: string;
}
