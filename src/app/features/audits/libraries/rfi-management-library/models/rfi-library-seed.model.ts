import type { RfiCategory, RfiPriority } from './rfi-library.model';

/* Seed-row shape used by rfi-library-static-xyz-org.data.ts to build the
 * XYZ Broadcast RFI library items. */

export interface XyzRfiLibrarySeed {
  id: string;
  subDivision: string;
  scopeId: string;
  scopeTitle: string;
  subScopeId: string;
  subScopeTitle: string;
  title: string;
  description: string;
  category: RfiCategory;
  priority: RfiPriority;
  tags: string[];
  questions: string[];
}
