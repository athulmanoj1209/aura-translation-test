import type { AuditReportEntry, AuditType, ReportPeriod } from './audit-report.model';

/** Subset of AuditReportEntry needed to prefill the Add/Edit Report form when editing. */
export interface AddNewReportEditData {
  id: string;
  companyId: string;
  divisionCode: string;
  auditType: AuditType;
  createdDate: string;
  reportPeriod: ReportPeriod;
  periodZone: string;
  leadAuditor: string;
  /** Real backend template id (AuditReportRecord.template.templateId) - the reliable
   *  way to resolve the report's template. Null for reports whose template was never
   *  actually uploaded (seed data, or no template picked when the report was made). */
  templateId: number | null;
  /** Fallback for that legacy/seed case, where templateId is null but the record
   *  still carries the original template's file name to match against. */
  templateFileName?: string;
}

export interface AddNewReportDrawerData {
  mode?: 'add' | 'edit';
  report?: AddNewReportEditData;
}

export interface AddNewReportResult {
  companyId: string;
  divisionCode: string;
  divisionName: string;
  auditType: AuditType;
  reportId: string;
  reportYear: number;
  reportPeriod: ReportPeriod;
  periodZone: string;
  leadAuditorId: string;
  leadAuditor: string;
  templateId: string | null;
}

export interface ReportProfileDrawerData {
  report: AuditReportEntry;
}
