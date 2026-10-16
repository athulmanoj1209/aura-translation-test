export type RfiPriority = 'low' | 'medium' | 'high' | 'critical';

export type RfiLibraryStatus = 'pending_review' | 'rejected' | 'approved';

export type RfiCategory =
  | 'Evidence & Document Requests'
  | 'Process & Control Walkthroughs'
  | 'Policy & Compliance Verification'
  | 'System & IT Logic Inquiries';

export interface RfiLibraryItem {
  id: string;
  /** Company id, division code, and sub-division name — same values used by
   * audit-scope-static-data.ts's company → division → sub-division cascade. */
  company: string;
  division: string;
  subDivision: string;
  /** Stamped on add/edit: true when filed under a sub-division, false when directly under the division. */
  hasSubDivision?: boolean;
  title: string;
  description: string;
  category: RfiCategory;
  priority: RfiPriority;
  tags: string[];
  questions?: string[];
  scopeId?: string | null;
  scopeTitle?: string;
  subScopeId?: string;
  subScopeTitle?: string;
  status: RfiLibraryStatus;
  submittedBy?: string;
  submittedDate?: string;
  dueDate?: string | null;
  createdAt: string;
}
