export type RiskCategory =
  | 'Access Management'
  | 'Change Management'
  | 'Vendor Risk'
  | 'Financial Risk'
  | 'Operational Risk'
  | 'Compliance Risk'
  | 'IT General Controls'
  | 'Data Privacy'
  | 'Business Continuity'
  | 'Fraud Risk';

export type Framework = 'COBIT' | 'ISO 27001' | 'NIST' | 'COSO' | 'SOX' | 'PCI DSS';
export type ScopeLevel = 'scope' | 'subscope';
export type ScopeLibraryStatus = 'pending_review' | 'rejected' | 'approved';

export interface ScopeLibraryItem {
  id: string;
  /** Company id, division code, and sub-division name — same values used by
   * audit-scope-static-data.ts's company → division → sub-division cascade. */
  company: string;
  division: string;
  subDivision: string;
  /** Stamped on add/edit: true when filed under a sub-division, false when directly under the division. */
  hasSubDivision?: boolean;
  title: string;
  objective: string;
  scopeLevel: ScopeLevel;
  parentScopeId?: string;
  parentScopeTitle?: string;
  subScopes?: { id: string; title: string }[];
  riskCategory: RiskCategory;
  applicableFrameworks: Framework[];
  status: ScopeLibraryStatus;
  submittedBy?: string;
  submittedDate?: string;
  dueDate?: string | null;
  createdAt: string;
}
