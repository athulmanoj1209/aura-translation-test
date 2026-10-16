import type { SubDivisionType } from '@/app/features/audits/organization/sub-divisions/models/sub-division-static.model';

export type DivisionStatus = 'active' | 'inactive';
export type DivisionType =
  | 'head_office' | 'branch' | 'department' | 'representative_office'
  | 'warehouse' | 'factory' | 'project_office' | 'subsidiary';
/** Same value domain as the Sub-Division Type dropdown — only set when `divisionType` is 'department'. */
export type DepartmentType = SubDivisionType;
export type DivisionCountry = 'ae' | 'sa' | 'bh' | 'kw';
export type DivisionEmirateState =
  | 'dubai' | 'abudhabi' | 'sharjah' | 'fujairah' | 'rak' | 'ajman' | 'ummalquwain' | 'khorfakkan'
  | 'riyadh' | 'makkah' | 'eastern' | 'tabuk' | 'madinah'
  | 'capital' | 'southern' | 'muharraq' | 'central' | 'northern'
  | 'hawalli' | 'jahra' | 'ahmadi' | 'farwaniya' | 'mubarak';
export type RiskRating = 'low' | 'medium' | 'high';
export type RiskStatus = 'open' | 'monitored' | 'closed';
export type AuditStatus = 'not_planned' | 'planned' | 'in_progress' | 'completed' | 'pending_review' | 'approved' | 'rejected';
export type SectorActivity =
  | 'professional_services' | 'financial_services' | 'retail' | 'manufacturing'
  | 'technology' | 'healthcare' | 'construction' | 'real_estate';
export type CompanyIndustry = 'jewelry' | 'other';
export type SubDivisionStatus = 'active' | 'inactive' | 'archived' | 'pending' | 'pending_approval' | 'approved' | 'rejected';
export type ScopeType = 'subDivisional' | 'functional' | 'independent';
export type AuditFrequency = 'quarterly' | 'annually' | 'monthly';

export interface DocFile {
  name: string;
  url: string;
}

export interface StaticSubScope {
  subScopeName: string;
  subScopeType: string;
  auditFrequency: AuditFrequency;
  riskRating: RiskRating;
}

export interface StaticScope {
  scopeName: string;
  scopeType: ScopeType;
  auditFrequency: AuditFrequency;
  riskRating: RiskRating;
  subScopes?: StaticSubScope[];
}

export interface StaticSubDivision {
  subDivisionName: string;
  company: string;
  parentSubDivisions: string[];
  status: SubDivisionStatus;
  riskRating: RiskRating;
  riskStatus: RiskStatus;
  primaryContactPerson: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  subDivisionHead: string | null;
  numberOfEmployees: number | null;
  operationalSince: string | null;
  scopes?: StaticScope[];
}

export interface StaticDivision {
  company: string;
  divisionName: string;
  divisionCode: string;
  divisionType: DivisionType;
  departmentType: DepartmentType | null;
  status: DivisionStatus;
  currency: string;
  numberOfEmployees: number | null;
  operationalSince: string | null;
  licenseNumber: string;
  licenseAuthority: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  taxRegistrationNumber: string;
  commercialRegistrationNumber: string;
  divisionTimezone: string;
  legalEntityName: string;
  country: DivisionCountry;
  emirateState: DivisionEmirateState;
  city: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  gpsCoordinates: string;
  divisionManager: string;
  primaryContactPerson: string;
  contactEmail: string;
  contactPhone: string;
  alternatePhone: string;
  riskRating: RiskRating;
  riskStatus: RiskStatus;
  auditStatus: AuditStatus;
  submittedBy?: string;
  submittedDate?: string;
  dueDate?: string | null;
  lastAuditDate: string;
  nextAuditDueDate: string;
  sectorActivity: SectorActivity;
  parentDivision: string | null;
  parentNode: string | null;
  hasSubDivision: boolean;
  subDivisions: StaticSubDivision[];
  tradeLicenseFile: DocFile;
  vatCertificateFile: DocFile;
  orgDocumentsFile: DocFile;
  /** ISO timestamp — drives the list's newest-first sort. Stamped by `upsertStaticDivision`. */
  createdAt: string;
}

export interface StaticCompany {
  id: string;
  companyName: string;
  tag: string;
  color: string;
  industry: CompanyIndustry;
  divisions: StaticDivision[];
}

/** Minimal company display fields, supplied by the caller (which has access to
 *  `CompanyDataService`) so a company that exists there but has never had a
 *  division added yet can get a fresh wrapper here instead of silently dropping
 *  the division. */
export interface CompanyMeta {
  companyName: string;
  tag?: string;
  color?: string;
  industry?: string;
}

/**
 * The subset of `StaticDivision` fields the Add/Edit Division form actually edits.
 * `subDivisions` is excluded — add-divisions.ts has FormArray plumbing for a
 * subDivisions sub-form, but no template renders it (no "+ Add SubDivision" UI
 * exists), so it never produces data; editing a division must leave its
 * existing nested subDivisions untouched, same as editing a subDivision leaves
 * its `scopes` untouched. `legalEntityName`/`parentDivision` are also excluded —
 * neither has a form control in add-divisions.ts/.html. File fields are
 * handled separately as `File|null`.
 */
export type DivisionEditableFields = Omit<
  StaticDivision,
  'tradeLicenseFile' | 'vatCertificateFile' | 'orgDocumentsFile' | 'subDivisions'
  | 'legalEntityName' | 'parentDivision' | 'createdAt'
>;
