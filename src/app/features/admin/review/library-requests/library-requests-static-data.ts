// Live data for the Library Requests page (library-requests.ts) -- derived
// directly from the real MOCK_SCOPE_LIBRARY / MOCK_RFI_LIBRARY records
// (audit-scope-library.ts / rfi-management-library.ts) instead of a separate
// hand-authored array. An item shows up here for as long as its own `status`
// field is one of the 3 approval-workflow values below; approving/rejecting
// a request writes `status` back onto that same real record, so the change
// is visible on the Audit Scope Library / RFI Management Library pages too,
// not just in this queue. `scopePayload`/`rfiPayload` carry the exact
// ScopeLibraryItem / RfiLibraryItem record, already the shape the Add Scope
// Library / Add RFI Library drawers know how to read.

import type { ScopeLibraryItem, RiskCategory } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library.model';
import type { RfiLibraryItem } from '@/app/features/audits/libraries/rfi-management-library/models/rfi-library.model';
import { SCOPE_LIBRARY_STATIC_COMPANIES } from '@/app/features/audits/libraries/audit-scope-library/audit-scope-library-static-data';
import { divisionAllowsSubDivisions } from '@/app/shared/utils/no-sub-division-message';
import type { LibRequestRecord, RiskLevel } from './models/library-request.model';

// ScopeLibraryItem carries no severity/risk field of its own (unlike
// divisions/sub-divisions/scopes) — this maps its `riskCategory` to a
// reasonable display risk so the requests queue can still show/filter a
// Risk column for scope & sub-scope items.
const RISK_CATEGORY_SEVERITY: Record<RiskCategory, RiskLevel> = {
  'Financial Risk': 'high',
  'Fraud Risk': 'high',
  'IT General Controls': 'high',
  'Compliance Risk': 'high',
  'Access Management': 'medium',
  'Change Management': 'medium',
  'Vendor Risk': 'medium',
  'Data Privacy': 'medium',
  'Operational Risk': 'medium',
  'Business Continuity': 'low',
};

function resolveCompanyName(companyId: string): string {
  return SCOPE_LIBRARY_STATIC_COMPANIES.find(c => c.id === companyId)?.companyName ?? companyId;
}

function resolveDivisionName(companyId: string, divisionCode: string): string {
  const company = SCOPE_LIBRARY_STATIC_COMPANIES.find(c => c.id === companyId);
  return company?.divisions.find(b => b.divisionCode === divisionCode)?.divisionName ?? divisionCode;
}

/** False for items filed under a sub-division of a division that has no
 *  sub-divisions (leftover seed records) — kept out of the queue. */
function isUnderValidSubDivision(item: { company: string; division: string; subDivision: string }): boolean {
  return !item.subDivision || divisionAllowsSubDivisions(item.division, item.company);
}

/**
 * Builds the Library Requests queue by filtering the real scope-library and
 * RFI-library records for the ones currently in an approval-workflow state.
 */
export function deriveLibraryRequests(scopeLibrary: ScopeLibraryItem[], rfiLibrary: RfiLibraryItem[]): LibRequestRecord[] {
  const records: LibRequestRecord[] = [];

  for (const item of scopeLibrary) {
    if (item.status !== 'pending_review' && item.status !== 'approved' && item.status !== 'rejected') continue;
    if (!isUnderValidSubDivision(item)) continue;
    const parent = item.parentScopeId ? scopeLibrary.find(s => s.id === item.parentScopeId) : undefined;
    records.push({
      id: item.id,
      name: item.title,
      type: item.scopeLevel === 'subscope' ? 'Subscope' : 'Scope',
      company: resolveCompanyName(item.company),
      division: resolveDivisionName(item.company, item.division),
      subDivision: item.subDivision,
      category: item.riskCategory,
      risk: RISK_CATEGORY_SEVERITY[item.riskCategory] ?? 'medium',
      status: item.status,
      submittedBy: item.submittedBy ?? '—',
      submittedDate: item.submittedDate ?? '—',
      parentEntity: parent ? `${parent.title} (${parent.id})` : (item.parentScopeTitle ? `${item.parentScopeTitle} (${item.parentScopeId})` : '—'),
      scopePayload: item,
    });
  }

  for (const item of rfiLibrary) {
    if (item.status !== 'pending_review' && item.status !== 'approved' && item.status !== 'rejected') continue;
    if (!isUnderValidSubDivision(item)) continue;
    records.push({
      id: item.id,
      name: item.title,
      type: 'RFI',
      company: resolveCompanyName(item.company),
      division: resolveDivisionName(item.company, item.division),
      subDivision: item.subDivision,
      category: item.category,
      risk: item.priority,
      status: item.status,
      submittedBy: item.submittedBy ?? '—',
      submittedDate: item.submittedDate ?? '—',
      parentEntity: item.scopeTitle ? `${item.scopeTitle} (${item.scopeId})` : (item.subScopeTitle ? `${item.subScopeTitle} (${item.subScopeId})` : '—'),
      rfiPayload: item,
    });
  }

  return records;
}
