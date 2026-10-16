import type { ScopeLibraryItem } from './scope-library.model';

export interface AddScopeLibraryDrawerData {
  mode: 'add' | 'edit';
  approvalMode?: boolean;
  /** Current workflow status of the request being reviewed — approve/reject controls only show when this is 'pending_review'. */
  requestStatus?: string;
  scopeItem?: ScopeLibraryItem | null;
  allScopes: ScopeLibraryItem[];
}

export interface AddScopeLibraryDrawerResult {
  saved?: ScopeLibraryItem;
  approval?: { action: 'approve' | 'reject'; notes: string };
}

export interface ScopeLibraryProfileDrawerData {
  scopeItem: ScopeLibraryItem;
}
