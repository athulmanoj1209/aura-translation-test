import type { EnrichedRFI } from './rfi.model';

export interface AddRfiDrawerData {
  currentUser?: string;
}

export interface ViewRfiDrawerData {
  rfi: EnrichedRFI;
  currentUser?: string;
}
