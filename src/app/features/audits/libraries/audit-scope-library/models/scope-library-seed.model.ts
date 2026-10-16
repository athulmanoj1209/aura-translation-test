import type { RiskCategory, Framework } from './scope-library.model';

/* Seed-row shapes used by audit-scope-library-static-xyz-org.data.ts to build the
 * XYZ Broadcast scope library items. */

export interface XyzLibrarySubScopeSeed { name: string; objective: string; }

export interface XyzLibrarySubDivisionSeed {
  subDivision: string;
  scopeTitle: string;
  riskCategory: RiskCategory;
  frameworks: Framework[];
  subScopes: XyzLibrarySubScopeSeed[];
}
