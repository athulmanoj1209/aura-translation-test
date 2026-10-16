export interface RFIResponseDoc { name: string; url: string; description: string; }
export interface RFIResponse {
  responseText: string;
  explanationNotes?: string;
  responseDocs: RFIResponseDoc[];
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  submittedAt?: string;
  rejectedAt?: string;
}

export interface RFIQuestionnaireDoc { name: string; url: string; description?: string; }

export interface RFIHistoryEntry {
  responseText: string;
  explanationNotes?: string;
  responseDocs: RFIResponseDoc[];
  questionnaire: {
    question: string;
    answer?: string;
    questionDocs?: RFIQuestionnaireDoc[];
    answerDocs?: RFIQuestionnaireDoc[];
  }[];
  submittedAt: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface RFI {
  id: number;
  subDivisionValue: string;
  subDivisionLabel: string;
  scopeValue: string | null;
  scopeLabel: string | null;
  subScopeValue: string | null;
  subScopeLabel: string | null;
  title: string;
  description: string;
  dueDate: Date;
  ownerValue: string;
  ownerLabel: string;
  status: 'pending' | 'completed' | 'overdue' | 'under-review' | 'reopened';
  response?: RFIResponse | null;
  /** Auditor(s) who raised / own this RFI. Optional until wired in the data. */
  auditorId?: string;
  auditorIds?: string[];
  questionnaire?: Array<{
    question: string;
    answer?: string;
    dueDate?: string | null;
    questionDocs?: RFIQuestionnaireDoc[];
    answerDocs?: RFIQuestionnaireDoc[];
  }>;
  responseHistory?: RFIHistoryEntry[];
}

export interface EnrichedRFI extends RFI {
  company: string;
  divisionCode: string;
  divisionName: string;
  /** Drives the list's newest-first sort. */
  createdAt: Date;
  /** Drives the Activate/Deactivate action — independent of `status`. */
  recordStatus: 'active' | 'inactive';
}
