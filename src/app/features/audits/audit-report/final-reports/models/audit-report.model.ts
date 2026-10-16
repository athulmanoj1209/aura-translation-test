// Shapes of the static audit-report seed trees (reports-lists-static-data.ts,
// report-lists-static-indi-org-data.ts, report-lists-static-xyz-broadcast.data.ts)
// and of the flat list entries reports-lists.ts builds from them.

export type AuditType = 'internal' | 'external' | 'financial' | 'safety';
export type ReportPeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
export type ReportStatus = 'draft' | 'reopened' | 'in_review' | 'approved';

export interface ReportTemplateInfo {
  /** Backend-issued numeric id from POST /Audit/upload-template - null for every
   *  pre-seeded static record here (they were never actually uploaded). Mirrors
   *  ReportTemplateRecord.templateId in report-templates/models/report-template.model.ts. */
  templateId: number | null;
  templateName: string;
  templateDescription: string;
  industryType: string;
  templateFileName: string;
  submittedByName: string;
  submittedByRole: string;
  status: 'active' | 'inactive';
}

export interface AuditReportRecord {
  companyId: string;
  divisionName: string;
  divisionCode: string;
  /** ISO timestamp — drives newest-first ordering in reports-lists.ts. */
  createdAt: string;
  reportTitle: string;
  auditType: AuditType;
  status: ReportStatus;
  createdDate: string;
  updatedDate: string;
  leadAuditor: string;
  reportPeriod: ReportPeriod;
  publishedByName: string;
  publishedByRole: string;
  reviewerName: string;
  reviewerRole: string;
  template: ReportTemplateInfo;
}

export interface ReportsListStaticDivision {
  divisionCode: string;
  divisionName: string;
  /** Real-world sector this division operates in. */
  industryType: string;
  auditReports: AuditReportRecord[];
}

export interface ReportsListStaticCompany {
  id: string;
  companyName: string;
  tag: string;
  color: string;
  divisions: ReportsListStaticDivision[];
}

export interface CompanyLookupEntry {
  id: string;
  label: string;
  tag: string;
  color: string;
}

export interface AuditReportEntry {
  id: string;
  companyId: string;
  divisionName: string;
  divisionCode: string;
  /** ISO timestamp — drives newest-first ordering (see applyFilters()). */
  createdAt: string;
  reportTitle: string;
  auditType: AuditType;
  status: ReportStatus;
  createdDate: string;
  updatedDate: string;
  leadAuditor: string;
  reportPeriod: ReportPeriod;
  /** Specific instance within reportPeriod - 'Q1'..'Q4', 'M1'..'M12', 'H1'/'H2', or '' for yearly. */
  periodZone: string;
  /** Who first published this report. */
  publishedByName: string;
  publishedByRole: string;
  /** Who this report is assigned to for review. */
  reviewerName: string;
  reviewerRole: string;
  /** The template this report was generated from - see report-templates.ts. */
  template: ReportTemplateInfo;
}
