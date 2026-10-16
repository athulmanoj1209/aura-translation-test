import type { ScopeStatus } from './audit-scope.model';

/* Seed-row shapes used by audit-scope-static-xyz-org.data.ts to build the
 * XYZ Broadcast scope records. */

export interface XyzTaskSeed {
  taskName: string;
  description: string;
}

export interface XyzSubScopeSeed {
  name: string;
  objective: string;
  tasks?: XyzTaskSeed[];
  workflowStatus?: ScopeStatus;
}

export interface XyzScopeSubDivisionSeed {
  code: string;
  name: string;
  riskRating: 'high' | 'medium';
  auditFrequency: 'monthly' | 'quarterly';
  scopeName: string;
  workflowStatus: ScopeStatus;
  subScopes: XyzSubScopeSeed[];
}
