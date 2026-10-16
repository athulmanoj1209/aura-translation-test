import type { ScopeLibraryItem } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library.model';
import type { RfiLibraryItem } from './rfi-library.model';

export interface AddRfiLibraryDrawerData {
  mode: 'add' | 'edit';
  approvalMode?: boolean;
  /** Current workflow status of the request being reviewed — approve/reject controls only show when this is 'pending_review'. */
  requestStatus?: string;
  rfiItem?: RfiLibraryItem | null;
  allScopes: ScopeLibraryItem[];
}

export interface AddRfiLibraryDrawerResult {
  saved?: RfiLibraryItem;
  approval?: { action: 'approve' | 'reject'; notes: string };
}

export interface RfiLibraryProfileDrawerData {
  rfiItem: RfiLibraryItem;
}
