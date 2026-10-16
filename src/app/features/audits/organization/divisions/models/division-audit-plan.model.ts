export interface DivisionRFIQuestionnaireDoc { name: string; url: string; description?: string; }

export interface DivisionRFI {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  ownerValue: string;
  ownerLabel: string;
  status: 'pending' | 'completed' | 'overdue' | 'under-review' | 'reopened';
  response?: DivisionRFIResponse | null;
  questionnaire?: Array<{
    question: string;
    answer?: string;
    dueDate?: string | null;
    questionDocs?: DivisionRFIQuestionnaireDoc[];
    answerDocs?: DivisionRFIQuestionnaireDoc[];
  }>;
  responseHistory?: DivisionRFIHistoryEntry[];
}

export interface DivisionRFIResponse {
  responseText: string;
  explanationNotes?: string;
  responseDocs: { name: string; url: string; description: string }[];
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  submittedAt?: string;
  rejectedAt?: string;
}

export interface DivisionRFIHistoryEntry {
  responseText: string;
  explanationNotes?: string;
  responseDocs: { name: string; url: string; description: string }[];
  questionnaire: {
    question: string;
    answer?: string;
    questionDocs?: DivisionRFIQuestionnaireDoc[];
    answerDocs?: DivisionRFIQuestionnaireDoc[];
  }[];
  submittedAt: string;
  rejectedAt: string;
  rejectionReason: string;
}

export interface AuditPlanSubScope {
  subScopeName: string;
  subScopeType: string;
  rfis?: DivisionRFI[];
}

export interface AuditPlanScope {
  scopeName: string;
  scopeType: string;
  subDivisionName: string;
  auditFrequency: string;
  modeOfAudit: string;
  status: 'in-progress' | 'completed' | 'overdue' | 'pending';
  progress: number;
  rfis?: DivisionRFI[];
  subScopes?: AuditPlanSubScope[];
}

export interface AuditPlan {
  planId: string;
  planName: string;
  status: 'draft' | 'in-review' | 'approved' | 'active' | 'completed' | 'deactivated';
  auditFrequency: string;
  startDate: string;
  endDate: string;
  planOwner: string;
  objectives: string;
  totalBudget: string;
  auditScopes?: AuditPlanScope[];
}
