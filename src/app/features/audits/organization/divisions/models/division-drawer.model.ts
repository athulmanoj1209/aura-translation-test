import type { Division } from './division.model';
import type { DivisionEditableFields } from './division-static.model';

export interface AddDivisionsDrawerData {
  mode: 'add' | 'view' | 'edit';
  division?: any | null;
  initialTab?: number;
  approvalMode?: boolean;
  /** Current workflow status of the request being reviewed — approve/reject controls only show when this is 'pending_review'. */
  requestStatus?: string;
}

export interface AddDivisionsDrawerResult {
  /** 'add' mode: the brand-new division to insert. */
  division?: any;
  /** 'edit' mode: only the fields the form edits, merged into the existing record. */
  divisionUpdate?: DivisionEditableFields;
  approval?: { action: 'approve' | 'reject'; notes: string };
}

export interface DivisionProfileDrawerData {
  division: Division;
}
