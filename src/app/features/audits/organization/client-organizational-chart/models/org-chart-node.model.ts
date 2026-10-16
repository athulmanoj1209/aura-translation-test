import type { TreeNode } from 'primeng/api';

export type OrgChartViewMode = 'chart' | 'list';
/** 'spacer' is chart-view only: the "Division Scopes" card node holding a division's
 *  own scopes (only for divisions without sub-divisions).
 *  'divisionScopes' is list-view only: the "Division Scopes" group row holding them. */
export type OrgNodeType = 'company' | 'division' | 'subDivision' | 'scope' | 'subscope' | 'spacer' | 'divisionScopes';

export interface OrgNodeData {
  type: OrgNodeType;
  id: string;
  name: string;
  subtitle: string;
  status?: string;
  riskRating?: string;
  riskStatus?: string;
  companyKey?: string;
  divisionCount?: number;
  employeeCount?: number;
  divisionCode?: string;
  divisionType?: string;
  city?: string;
  country?: string;
  auditStatus?: string;
  subDivisionCount?: number;
  numberOfEmployees?: number | null;
  // Scope / SubScope fields
  scopeType?: string;
  auditFrequency?: string;
  modeOfAudit?: string;
  samplingSize?: number;
  startDate?: string;
  endDate?: string;
  subScopeCount?: number;
  /** Spacer only: a placeholder sub-division card it renders invisibly, so the card takes a sub-division card's size. */
  mirror?: OrgNodeData;
  /** Spacer only: number of division-level scopes behind it (shown on its label). */
  scopeCount?: number;
}

export type OrgTreeNode = TreeNode<OrgNodeData>;
