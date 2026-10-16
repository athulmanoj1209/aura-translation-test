import type { StaticSubDivision, SubDivisionEditableFields } from './sub-division-static.model';
import type { ProfileSubDivision } from './sub-division-profile.model';

export interface SubDivisionFormSubDivision extends StaticSubDivision {
  divisionCode: string;
}

export interface AddSubDivisionDrawerData {
  mode: 'add' | 'edit';
  subDivision?: SubDivisionFormSubDivision | null;
  approvalMode?: boolean;
  /** Current workflow status of the request being reviewed — approve/reject controls only show when this is 'pending_review'. */
  requestStatus?: string;
}

export interface AddSubDivisionDrawerResult {
  approval?: { action: 'approve' | 'reject'; notes: string };
  /**
   * 'add' mode: the brand-new sub-division to insert. `auditStatus` is
   * excluded — the form has no control for it; upsertStaticSubDivision()
   * always starts a new sub-division at `'pending_approval'`.
   */
  subDivision?: Omit<SubDivisionFormSubDivision, 'createdAt' | 'auditStatus'>;
  /** 'edit' mode: only the fields the form edits, merged into the existing record. */
  subDivisionUpdate?: SubDivisionEditableFields;
  /** 'edit' mode: the sub-division's code before this edit, to find the record being updated. */
  previousSubDivisionCode?: string;
}

export interface SubDivisionProfileDrawerData {
  subDivision: ProfileSubDivision;
  divisionName?: string;
}
