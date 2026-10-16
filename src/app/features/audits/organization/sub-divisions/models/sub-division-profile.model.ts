import type { PersonnelProfile, ReviewerProfile } from '@/app/features/audits/organization/divisions/models/personnel-profile.model';
import type { StaticSubDivision } from './sub-division-static.model';

export interface ProfileSubScope {
  subScopeName: string;
  auditFrequency?: string;
  riskRating?: string;
  assignedAuditors?: string[];
  assignedReviewers?: string[];
  startDate: string;
  endDate: string;
}

export interface ProfileScope {
  scopeName: string;
  scopeType?: string;
  auditFrequency?: string;
  riskRating?: string;
  assignedAuditors?: string[];
  assignedReviewers?: string[];
  startDate: string;
  endDate: string;
  subScopes?: ProfileSubScope[];
}

export type ProfileSubDivision = Omit<StaticSubDivision, 'scopes'> & { scopes?: ProfileScope[] };

export interface ScopeAssignment {
  name: string;
  type: 'scope' | 'subscope';
  parentScope?: string;
  startDate: string;
  endDate: string;
}

export interface AuditorInfo extends PersonnelProfile {
  assignedItems: ScopeAssignment[];
}

export interface ReviewerInfo extends ReviewerProfile {
  reviewItems: ScopeAssignment[];
}

export interface FlatScopeItem {
  name: string;
  type: 'scope' | 'subscope';
  parentScopeName?: string;
  scopeType?: string;
  auditFrequency?: string;
  riskRating?: string;
  subScopeCount?: number;
}
