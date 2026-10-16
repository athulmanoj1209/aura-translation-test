// Live data for the Scope Requests page (scope-requests.ts) -- derived
// directly from the real StaticScope records in
// audit-scope-management/audit-scope-static-data.ts instead of a separate
// hand-authored array. A scope/sub-scope shows up here for as long as its
// `workflowStatus` is one of the approval-workflow values below;
// approving/rejecting a request writes `workflowStatus` back onto that same
// real record, so the change is visible on the Audit Scope Management page
// too, not just in this queue. `scopePayload` is the exact StaticScope
// record, which is already the shape add-audit-scope.component.ts's
// Add/Edit drawer knows how to read.

import { AUDIT_SCOPE_STATIC_COMPANIES } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data';
import type { ScopeStatus, StaticScope } from '@/app/features/audits/audit-plan/audit-scope-management/models/audit-scope.model';
import { divisionAllowsSubDivisions } from '@/app/shared/utils/no-sub-division-message';
import type { ScopeRequestRecord, ScopeRequestStatus, RiskLevel } from './models/scope-request.model';

// 'Not Started' is included alongside 'Approved' — an approved scope's
// audit simply hasn't started yet, which is the same real-world state as
// "approved and not yet acted on" (mirrors division-static-data.ts's
// not_planned/approved equivalence), so any scope already sitting at
// 'Not Started' (freshly approved or pre-existing) shows up here too.
const WORKFLOW_LABEL_TO_STATUS: Record<string, ScopeRequestStatus> = {
  'Pending Review': 'pending_review',
  'Approved': 'approved',
  'Not Started': 'approved',
  'Rejected': 'rejected',
};

/**
 * Maps a request queue status back onto the module's own Title Case
 * `workflowStatus` values. An approval is written as 'Not Started' rather
 * than 'Approved' — see the `WORKFLOW_LABEL_TO_STATUS` note above.
 */
export function toScopeWorkflowStatus(status: 'approved' | 'rejected'): ScopeStatus {
  return status === 'approved' ? 'Not Started' : 'Rejected';
}

/** Flat search across every company/division/sub-division for every scope and sub-scope
 *  — division-level scopes (`division.scopes`, `subDivisionName: null`) included. */
function allStaticScopes(): Array<{ scope: StaticScope; companyName: string; divisionName: string }> {
  const result: Array<{ scope: StaticScope; companyName: string; divisionName: string }> = [];
  for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
    for (const division of company.divisions) {
      for (const scope of division.scopes ?? []) {
        result.push({ scope, companyName: company.companyName, divisionName: division.divisionName });
      }
      // Skip leftover sub-division records under a division that has no sub-divisions.
      if (!divisionAllowsSubDivisions(division.divisionCode, company.id)) continue;
      for (const dept of division.subDivisions) {
        for (const scope of dept.scopes) {
          result.push({ scope, companyName: company.companyName, divisionName: division.divisionName });
        }
      }
    }
  }
  return result;
}

/**
 * Builds the Scope Requests queue by filtering every real scope/sub-scope
 * for the ones currently in an approval-workflow state.
 */
export function deriveScopeRequests(): ScopeRequestRecord[] {
  const flat = allStaticScopes();
  const records: ScopeRequestRecord[] = [];

  for (const { scope, companyName, divisionName } of flat) {
    const status = scope.workflowStatus ? WORKFLOW_LABEL_TO_STATUS[scope.workflowStatus] : undefined;
    if (!status) continue;

    const parent = scope.parentScopeId
      ? flat.find(s => s.scope.id === scope.parentScopeId)?.scope
      : undefined;

    records.push({
      id: scope.id,
      name: scope.scopeName,
      type: scope.parentScopeId ? 'Subscope' : 'Scope',
      company: companyName,
      division: divisionName,
      subDivision: scope.subDivisionName ?? '—',
      risk: (scope.riskRating as RiskLevel) ?? 'low',
      status,
      submittedBy: scope.submittedBy ?? '—',
      submittedDate: scope.submittedDate ?? '—',
      dueDate: scope.dueDate ?? null,
      parentEntity: parent ? `${parent.scopeName} (${parent.id})` : '—',
      scopePayload: { ...scope, companyId: scope.company, companyName, divisionName, deptName: scope.subDivisionName } as unknown as Record<string, unknown>,
    });
  }

  return records;
}
