import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { Popover, PopoverModule } from 'primeng/popover';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { FileDownloadService } from '@/app/core/services/file-download.service';
import { AddEvidenceComponent, AddEvidenceDrawerData, AddEvidenceResult } from '../add-evidence/add-evidence.component';
// Temporary, client-only bridge into the Pending Approvals queue (see
// execution-approval-list.component.ts) — adjust this relative path if that
// component lives somewhere else in your tree; it's assumed to be a sibling
// folder of this one, same as add-evidence/.
import { addPendingItem, PendingItem } from '@/app/features/admin/review/execution-requests/execution-requests.component';
import { EvidenceDetailComponent, EvidenceDetailDrawerData } from '../evidence-detail/evidence-detail.component';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
// Same CLIENT_MODE_VALUE constant the other static seed files (e.g.
// branch-static-data.ts) read at module-eval time — adjust this relative
// path to wherever client-mode.ts actually lives in your tree.
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';
// The internal-audit org-structure seed files (same family as
// client-mode.ts's sibling seeds) — used below to source the Company /
// Division / Sub-Division / Scope filter *options* from the real DAR
// Exchange org structure when CLIENT_MODE_VALUE is 'internal-audit',
// instead of from whatever values happen to appear on MOCK_EVIDENCE rows.
// Adjust these paths to wherever the four files actually live in your tree.
import { COMPANIES_SEED } from '@/app/features/audits/organization/company/company-static-indi-org.data';
import { DIVISION_INDI_ORG_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-indi-org.data';
import { SUB_DIVISION_INDI_ORG_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-indi-org.data';
import { SCOPE_INDI_ORG_COMPANIES } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-indi-org.data';
// Shared Company -> Division -> Sub-Division -> Scope directory (same source
// observation-list uses) for the filter options when CLIENT_MODE_VALUE is NOT
// 'internal-audit'.
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';


/* ── Model ─────────────────────────────────────────────────────────────── */

export interface EvidenceFile {
  name: string;
  size: number;
  url?: string;
  file?: File;
}

export type EvidenceType =
  | 'document' | 'screenshot' | 'interview_notes'
  | 'system_log' | 'email' | 'physical_inspection' | 'other';

/** Review workflow status — separate from `isActive` (record activation). */
export type EvidenceReviewStatus = 'requested' | 'uploaded' | 'under_review' | 'accepted' | 'rejected';

export interface Evidence {
  id: string;
  title: string;
  evidenceType: EvidenceType;
  scope: string;
  subscope: string;
  taskId: string;
  taskTitle: string;
  /** Not every evidence item is tied to a logged finding yet (e.g. one just added via "New Evidence"). */
  findingId?: string;
  findingTitle?: string;
  createdDate: Date;
  files: EvidenceFile[];
  description?: string;
  uploadedBy?: string;
  company?: string;
  branch?: string;
  department?: string;
  isActive?: boolean;
  /** Defaults to 'uploaded' when absent — every legacy record here already represents uploaded evidence. */
  status?: EvidenceReviewStatus;
  risk?: 'High' | 'Medium' | 'Low';
}

type SortColumn = 'id' | 'title' | 'evidenceType' | 'scope' | 'findingId' | 'createdDate' | 'files';
type SortDir = 'asc' | 'desc';

/* ── Stub data ──────────────────────────────────────────────────────────── */


/* ── Mock data ──────────────────────────────────────────────────────────── */

/**
 * Only when this build's client mode is 'internal-audit' (single-company
 * DAR Exchange seed) do the mock evidence records below get their
 * scope/subscope from the real audit-scope catalog in
 * audit-scope-static-indi-org.data.ts (SCOPE_INDI_ORG_COMPANIES — e.g.
 * scope: 'AML/CFT Compliance', subscope: 'Policy, Governance & Training'),
 * and their company/branch(division)/department(sub-division) from the
 * matching company/branch/department *-indi-org.data.ts seeds (e.g.
 * company: 'DAR Exchange', branch: 'IT', department: 'IT') — each record's
 * division/sub-division was picked to match the DAR branch/department that
 * owns its internal-audit scope above, so the Company/Division/Sub-Division
 * filters (which read their *options* from those same seeds — see
 * "Internal-audit org filter sources" below) actually match these rows.
 * In 'audit-firm' mode (multi-company seed) all five fields keep their
 * original, generic values instead, since that taxonomy doesn't apply
 * across arbitrary client companies.
 */
const IS_INTERNAL_AUDIT_CLIENT = CLIENT_MODE_VALUE === 'internal-audit';

const MOCK_EVIDENCE: Evidence[] = [
  {
    id: 'EV-001',
    title: 'Bank Reconciliation Report Q1 2025',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Accounts / Audit / Unclaimed Funds' : 'Internal Audit',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Financial Controls',
    taskId: 'TSK-001', taskTitle: 'Review payment controls',
    findingId: 'F-012', findingTitle: 'Unreconciled bank entries',
    createdDate: new Date('2025-01-15'), isActive: true,
    description: 'Comprehensive Q1 bank reconciliation report covering all active accounts. Highlights 14 unreconciled entries totalling AED 87,430 across three cost centres. Prepared by the Finance team and reviewed by the Audit Manager prior to submission.',
    uploadedBy: 'Athul Manoj',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'Finance' : 'Dubai',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'Finance' : 'Internal Audit',
    files: [
      { name: 'bank-recon-q1-2025.pdf',   size: 245000 },
      { name: 'ledger-export-q1.xlsx',     size: 87000  },
      { name: 'variance-analysis.xlsx',    size: 54000  },
    ],
  },
  {
    id: 'EV-002',
    title: 'User Access Matrix — ERP System',
    evidenceType: 'screenshot',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Information Technology / Cybersecurity' : 'Internal Audit',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'IT Controls',
    taskId: 'TSK-002', taskTitle: 'User access audit',
    findingId: 'F-005', findingTitle: 'Excessive privileged access rights',
    createdDate: new Date('2025-02-03'), isActive: true,
    description: 'Screenshots of the ERP system user access matrix showing 22 active accounts with super-user privileges. Captures were taken on 3 Feb 2025 at 14:30 GST and include both the role assignment screen and the segregation-of-duties conflict report.',
    uploadedBy: 'Sara Ahmed',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'Abu Dhabi',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'IT',
    files: [
      { name: 'access-matrix-screenshot-01.png', size: 320000 },
      { name: 'access-matrix-screenshot-02.png', size: 298000 },
      { name: 'sod-conflict-report.pdf',          size: 120000 },
    ],
  },
  {
    id: 'EV-003',
    title: 'HR Policy Manual — Revised Edition',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Human Resources / Emiratization' : 'External Audit',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Statutory Audit',
    taskId: 'TSK-010', taskTitle: 'HR compliance review',
    findingId: 'F-021', findingTitle: 'Outdated HR policies not aligned with UAE Labour Law',
    createdDate: new Date('2025-02-18'), isActive: false,
    description: 'Revised HR Policy Manual (v4.2) submitted by the client as evidence of remediation. Document includes updated leave policies, disciplinary procedures, and contractual templates compliant with the UAE Labour Law 2022 amendments.',
    uploadedBy: 'John Smith',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'HR Dept' : 'Sharjah',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'HR Dept' : 'External Audit',
    files: [
      { name: 'hr-policy-manual-v4.2.pdf',    size: 1340000 },
      { name: 'board-approval-minutes.pdf',    size:   92000 },
      { name: 'policy-comparison-table.docx',  size:   54000 },
      { name: 'hr-sign-off-email.pdf',         size:   28000 },
    ],
  },
  {
    id: 'EV-004',
    title: 'Vendor Due Diligence Correspondence',
    evidenceType: 'email',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'AML/CFT Compliance' : 'Regulatory',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? 'Transaction Monitoring, Screening & Risk Assessment' : 'AML / CFT',
    taskId: 'TSK-020', taskTitle: 'Vendor KYC verification',
    findingId: 'F-008', findingTitle: 'Incomplete KYC documentation for 3 high-value vendors',
    createdDate: new Date('2025-03-01'), isActive: true,
    description: 'Email chain between Procurement and the Compliance team documenting the escalation and resolution of KYC gaps for vendors V-019, V-031, and V-044. Includes acknowledgement of receipt of updated trade licences and passport copies.',
    uploadedBy: 'Meenu AM',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Dubai',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 2' : 'Regulatory',
    files: [
      { name: 'vendor-kyc-email-thread.pdf',  size:  78000 },
      { name: 'V019-trade-licence.pdf',        size: 210000 },
      { name: 'V031-kyc-package.zip',          size: 430000 },
      { name: 'V044-passport-scan.pdf',        size: 180000 },
    ],
  },
  {
    id: 'EV-005',
    title: 'Patch Management Compliance Logs — Q1',
    evidenceType: 'system_log',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Information Technology / Cybersecurity' : 'Internal Audit',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'IT Controls',
    taskId: 'TSK-005', taskTitle: 'Patch compliance check',
    findingId: 'F-034', findingTitle: 'Critical patches not applied within SLA',
    createdDate: new Date('2025-03-12'), isActive: true,
    description: 'Automated patch management system exports for January, February, and March 2025. Logs confirm 97.4% patch compliance across 312 endpoints. Three critical patches (MS-24-082, MS-24-091, CVE-2024-1234) remain outstanding on servers SRV-08 and SRV-14.',
    uploadedBy: 'Athul Manoj',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe KSA',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'Riyadh',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'IT',
    files: [
      { name: 'patch-log-jan-2025.csv', size:  43000 },
      { name: 'patch-log-feb-2025.csv', size:  41000 },
      { name: 'patch-log-mar-2025.csv', size:  39000 },
      { name: 'patch-summary-q1.pdf',   size: 178000 },
    ],
  },
  {
    id: 'EV-006',
    title: 'Cash Handling Process Walk-through Notes',
    evidenceType: 'interview_notes',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Branch Operations / Operational Controls' : 'Internal Audit',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Operational Review',
    taskId: 'TSK-030', taskTitle: 'Cash handling process review',
    findingId: 'F-017', findingTitle: 'Inadequate cash custody controls at branch level',
    createdDate: new Date('2025-03-25'), isActive: true,
    description: 'Interview notes from walk-through conducted with the Treasury Manager and two tellers at the Dubai branch. Observations document the absence of dual-custodian controls for cash amounts above AED 10,000 and the lack of a daily cash count sign-off sheet.',
    uploadedBy: 'Amy Elsner',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Dubai',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 2' : 'Internal Audit',
    files: [
      { name: 'interview-notes-cash-walkthrough.pdf', size: 135000 },
      { name: 'process-flowchart-current.pdf',        size:  88000 },
    ],
  },
  {
    id: 'EV-007',
    title: 'Data Centre Physical Inspection Report',
    evidenceType: 'physical_inspection',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Information Technology / Cybersecurity' : 'IT',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'IT Controls',
    taskId: 'TSK-040', taskTitle: 'Data centre access review',
    findingId: 'F-028', findingTitle: 'Unauthorised physical access to server room',
    createdDate: new Date('2025-04-02'), isActive: true,
    description: 'Physical inspection report for the Abu Dhabi data centre conducted on 1 April 2025. Findings include: 2 uncatalogued access cards, non-functioning CCTV on rack row C, and an unlocked equipment cabinet in zone 4. Photographic evidence attached.',
    uploadedBy: 'Ivan Magalhaes',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'Abu Dhabi',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'IT',
    files: [
      { name: 'dc-inspection-report.pdf',      size: 312000 },
      { name: 'cctv-gap-photo-01.jpg',         size: 890000 },
      { name: 'cctv-gap-photo-02.jpg',         size: 760000 },
      { name: 'access-log-export.xlsx',        size:  64000 },
      { name: 'zone4-cabinet-photo.jpg',       size: 540000 },
    ],
  },
  {
    id: 'EV-008',
    title: 'AML Transaction Monitoring Alerts — Feb 2025',
    evidenceType: 'system_log',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'AML/CFT Compliance' : 'Regulatory',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? 'Transaction Monitoring, Screening & Risk Assessment' : 'AML / CFT',
    taskId: 'TSK-021', taskTitle: 'AML alert review',
    findingId: 'F-009', findingTitle: 'AML alerts not reviewed within required timeframe',
    createdDate: new Date('2025-04-10'), isActive: true,
    description: 'System-generated transaction monitoring alert report for February 2025 exported from the Actimize platform. Report shows 48 high-priority alerts; 12 were not reviewed within the 5-business-day SLA. STR filing decisions documented for all closed alerts.',
    uploadedBy: 'Ioni Bowcher',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe Qatar',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Doha',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 2' : 'Regulatory',
    files: [
      { name: 'aml-alert-report-feb25.pdf',   size: 440000 },
      { name: 'actimize-export-feb25.csv',     size: 210000 },
      { name: 'str-filing-log.xlsx',           size:  56000 },
    ],
  },
  {
    id: 'EV-009',
    title: 'Tax Computation Workbook FY2024',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Accounts / Audit / Unclaimed Funds' : 'External Audit',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Tax Audit',
    taskId: 'TSK-011', taskTitle: 'Corporate tax compliance review',
    findingId: 'F-045', findingTitle: 'Deferred tax liability underestimated by SAR 1.2M',
    createdDate: new Date('2025-04-18'), isActive: false,
    description: 'Client-prepared corporate tax computation workbook for FY2024 including current tax, deferred tax schedules, and reconciliation to the audited P&L. The deferred tax liability on property revaluations was found to be understated by SAR 1.2M.',
    uploadedBy: 'Stephen Shaw',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe KSA',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'Finance' : 'Riyadh',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'Finance' : 'External Audit',
    files: [
      { name: 'tax-computation-fy2024.xlsx',   size: 320000 },
      { name: 'deferred-tax-schedule.xlsx',    size: 145000 },
      { name: 'zakat-return-fy2024.pdf',       size: 230000 },
    ],
  },
  {
    id: 'EV-010',
    title: 'Operational Risk Register — Q1 Snapshot',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Risk Management / Business Continuity' : 'Risk Management',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Operational Risk',
    taskId: 'TSK-050', taskTitle: 'Operational risk register review',
    findingId: 'F-062', findingTitle: 'Risk register not updated for 6+ months',
    createdDate: new Date('2025-05-05'), isActive: true,
    description: 'Quarterly snapshot of the operational risk register as of 31 March 2025. The register contains 84 risk entries; 23 have not been reviewed in over 180 days. Seven risks rated High or Critical lack assigned owners or mitigation actions.',
    uploadedBy: 'Michael Chen',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'RISK' : 'Dubai',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'RISK' : 'Risk Management',
    files: [
      { name: 'op-risk-register-q1-2025.xlsx', size: 275000 },
      { name: 'risk-heat-map.pdf',             size:  95000 },
    ],
  },
  {
    id: 'EV-011',
    title: 'Data Privacy Impact Assessment — CRM System',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Information Technology / Cybersecurity' : 'Regulatory',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Data Privacy',
    taskId: 'TSK-022', taskTitle: 'DPIA review for new CRM',
    findingId: 'F-051', findingTitle: 'DPIA not completed before CRM go-live',
    createdDate: new Date('2025-05-19'), isActive: true,
    description: 'Data Privacy Impact Assessment submitted retroactively for the Salesforce CRM deployment that went live on 1 March 2025. Assessment identifies three high-risk processing activities and recommends encryption at rest for customer PII fields. DPO sign-off attached.',
    uploadedBy: 'Reem Al Dosari',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe Oman',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'Muscat',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'Regulatory',
    files: [
      { name: 'dpia-crm-salesforce.pdf',        size: 415000 },
      { name: 'dpo-approval-email.pdf',          size:  32000 },
      { name: 'pii-data-flow-diagram.pdf',       size: 148000 },
    ],
  },
  {
    id: 'EV-012',
    title: 'Credit Risk Stress Test Results',
    evidenceType: 'other',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Risk Management / Business Continuity' : 'Risk Management',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Credit Risk',
    taskId: 'TSK-051', taskTitle: 'Credit portfolio stress testing',
    findingId: 'F-071', findingTitle: 'Stress test scenarios insufficiently severe',
    createdDate: new Date('2025-06-02'), isActive: true,
    description: 'Output of the Q1 2025 credit risk stress test across the retail and corporate loan portfolios. Results show a potential NPL ratio increase from 3.1% to 8.7% under the adverse scenario. The severe scenario (GDP contraction of 5%) was not modelled — flagged as a finding.',
    uploadedBy: 'Anna Fali',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe Qatar',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'RISK' : 'Doha',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'RISK' : 'Risk Management',
    files: [
      { name: 'stress-test-results-q1-2025.xlsx', size: 520000 },
      { name: 'methodology-note.pdf',              size: 190000 },
      { name: 'scenario-assumptions.docx',         size:  73000 },
    ],
  },
  {
    id: 'EV-013',
    title: 'Cash Flow Forecast Supporting Workings',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Operations and Other Departments' : 'Treasury Operations',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Cash Management',
    taskId: 'TSK-054', taskTitle: 'Cash flow forecast validation',
    findingId: 'F-085', findingTitle: 'Forecast variance exceeds threshold',
    createdDate: new Date('2026-06-18'), isActive: true, status: 'requested', risk: 'Medium',
    description: 'Request sent to Treasury for the supporting workbook behind the Q2 2026 cash flow forecast, including the key assumptions register.',
    uploadedBy: 'Bob Smith',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Dubai',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 2' : 'Treasury',
    files: [],
  },
  {
    id: 'EV-014',
    title: 'Privileged Access Sample — Screenshots',
    evidenceType: 'screenshot',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Information Technology / Cybersecurity' : 'IT Controls',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'IT General Controls',
    taskId: 'TSK-052', taskTitle: 'Privileged access review',
    findingId: 'F-078', findingTitle: 'Orphaned accounts identified',
    createdDate: new Date('2026-06-11'), isActive: true, status: 'uploaded', risk: 'High',
    description: 'Screenshots of the IAM console showing the sampled privileged accounts and their last login timestamps.',
    uploadedBy: 'Bob Smith',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe KSA',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'Riyadh',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'IT' : 'IT',
    files: [
      { name: 'iam-console-sample-01.png', size: 285000 },
      { name: 'iam-console-sample-02.png', size: 262000 },
    ],
  },
  {
    id: 'EV-015',
    title: 'Fixed Asset Additions — Purchase Invoices',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Operations and Other Departments' : 'Fixed Assets',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Financial Controls',
    taskId: 'TSK-053', taskTitle: 'Fixed asset additions verification',
    findingId: 'F-081', findingTitle: 'Capitalisation policy applied inconsistently',
    createdDate: new Date('2026-06-15'), isActive: true, status: 'under_review', risk: 'Medium',
    description: 'Purchase invoices for the sampled fixed asset additions, submitted for review against the capitalisation policy.',
    uploadedBy: 'Bob Smith',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Dubai',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 2' : 'External Audit',
    files: [
      { name: 'fa-additions-invoices.pdf', size: 340000 },
    ],
  },
  {
    id: 'EV-016',
    title: 'Expense Claims Compliance Sample',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Branch Operations / Operational Controls' : 'Expense Management',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Operational Review',
    taskId: 'TSK-055', taskTitle: 'Expense claims compliance testing',
    findingId: 'F-088', findingTitle: 'Minor policy deviations in travel claims',
    createdDate: new Date('2026-06-25'), isActive: true, status: 'accepted', risk: 'Low',
    description: 'The 40-claim expense sample and supporting receipts accepted as sufficient evidence for the compliance test conclusion.',
    uploadedBy: 'Bob Smith',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe UAE',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Abu Dhabi',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 2' : 'Finance',
    files: [
      { name: 'expense-claims-sample.xlsx', size: 132000 },
    ],
  },
  {
    id: 'EV-017',
    title: 'PO Approval Matrix — Superseded Version',
    evidenceType: 'document',
    scope: IS_INTERNAL_AUDIT_CLIENT ? 'Administration / Outsourcing of Functions' : 'Procurement',
    subscope: IS_INTERNAL_AUDIT_CLIENT ? '' : 'Purchase Order Controls',
    taskId: 'TSK-056', taskTitle: 'PO approval matrix testing',
    findingId: 'F-091', findingTitle: 'Purchase orders approved above authorisation limit',
    createdDate: new Date('2026-06-29'), isActive: true, status: 'rejected', risk: 'High',
    description: 'The submitted PO approval matrix was superseded by a newer authorisation policy; rejected pending resubmission of the current version.',
    uploadedBy: 'Bob Smith',
    company: IS_INTERNAL_AUDIT_CLIENT ? 'DAR Exchange' : 'Crowe KSA',
    branch: IS_INTERNAL_AUDIT_CLIENT ? 'OPS' : 'Riyadh',
    department: IS_INTERNAL_AUDIT_CLIENT ? 'BRANCH 1' : 'Procurement',
    files: [
      { name: 'po-approval-matrix-v1.xlsx', size: 175000 },
    ],
  },
];

/* ── Internal-audit org filter sources ────────────────────────────────────
 * When CLIENT_MODE_VALUE is 'internal-audit', the Company / Division /
 * Sub-Division / Scope filter dropdowns below are populated from the real
 * DAR Exchange org structure in the *-indi-org.data.ts seed files, instead
 * of being derived from whatever company/branch/department/scope values
 * happen to appear on individual MOCK_EVIDENCE rows above (which is still
 * how the 'audit-firm' mode filters behave, since that taxonomy doesn't
 * apply across arbitrary client companies).
 *
 * The MOCK_EVIDENCE rows above already carry matching company/branch/
 * department values in internal-audit mode (see the doc comment above
 * MOCK_EVIDENCE), so picking a Company/Division/Sub-Division option here
 * does filter real rows rather than coming up empty. ── */

function uniqueSorted(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

const ORG_COMPANY_NAMES = COMPANIES_SEED.map(c => c.companyName);

/** All Division (branch) names in the DAR org seed, optionally scoped to a set of company names. */
function orgDivisionNames(companyFilter: string[]): string[] {
  const companies = companyFilter.length
    ? DIVISION_INDI_ORG_COMPANIES.filter(c => companyFilter.includes(c.companyName))
    :DIVISION_INDI_ORG_COMPANIES;
  return uniqueSorted(companies.flatMap(c => c.divisions.map(b => b.divisionName)));
}

/** All Sub-Division (department) names in the DAR org seed, optionally scoped to company + division names. */
function orgSubDivisionNames(companyFilter: string[], divisionFilter: string[]): string[] {
  const companies = companyFilter.length
    ? SUB_DIVISION_INDI_ORG_COMPANIES.filter(c => companyFilter.includes(c.companyName))
    : SUB_DIVISION_INDI_ORG_COMPANIES;
  // Divisions flagged `hasSubDivision: false` contribute no sub-divisions.
  const branches = companies
    .flatMap(c => c.divisions)
    .filter(b => b.hasSubDivision !== false)
    .filter(b => !divisionFilter.length || divisionFilter.includes(b.divisionName));
  return uniqueSorted(branches.flatMap(b => b.subDivisions.map((d: { subDivisionName: string }) => d.subDivisionName)));
}

/** True unless at least one division is selected and every selected division is
 *  flagged `hasSubDivision: false`. Names not found in `divisions` count as having sub-divisions. */
function selectionHasSubDivisions(
  divisions: { divisionName: string; hasSubDivision?: boolean }[],
  divisionFilter: string[],
): boolean {
  if (!divisionFilter.length) return true;
  return divisionFilter.some(name => {
    const matches = divisions.filter(d => d.divisionName === name);
    return !matches.length || matches.some(d => d.hasSubDivision !== false);
  });
}

/** Whether the Sub-Division filter applies to the selected divisions in the DAR org seed. */
function orgSubDivisionFilterVisible(companyFilter: string[], divisionFilter: string[]): boolean {
  const companies = companyFilter.length
    ? DIVISION_INDI_ORG_COMPANIES.filter(c => companyFilter.includes(c.companyName))
    : DIVISION_INDI_ORG_COMPANIES;
  return selectionHasSubDivisions(companies.flatMap(c => c.divisions), divisionFilter);
}

/** Companies in company-org-data.ts, narrowed to the selected company names. */
function orgStaticCompanies(companyFilter: string[]) {
  return ORG_STATIC_DATA.filter(c => !companyFilter.length || companyFilter.includes(c.companyName));
}

/** Divisions in company-org-data.ts, narrowed to the selected company + division names. */
function orgStaticDivisions(companyFilter: string[], divisionFilter: string[]) {
  return orgStaticCompanies(companyFilter)
    .flatMap(c => c.divisions)
    .filter(d => !divisionFilter.length || divisionFilter.includes(d.divisionName));
}

/** All Company names in company-org-data.ts. */
function staticCompanyNames(): string[] {
  return uniqueSorted(ORG_STATIC_DATA.map(c => c.companyName));
}

/** All Division names in company-org-data.ts, optionally scoped to a set of company names. */
function staticDivisionNames(companyFilter: string[]): string[] {
  return uniqueSorted(orgStaticDivisions(companyFilter, []).map(d => d.divisionName));
}

/** All Sub-Division names in company-org-data.ts, optionally scoped to company + division names. */
function staticSubDivisionNames(companyFilter: string[], divisionFilter: string[]): string[] {
  return uniqueSorted(
    orgStaticDivisions(companyFilter, divisionFilter)
      .filter(d => d.hasSubDivision !== false)
      .flatMap(d => d.subDivisions.map(sd => sd.subDivisionName)),
  );
}

/** Whether the Sub-Division filter applies to the selected divisions in company-org-data.ts. */
function staticSubDivisionFilterVisible(companyFilter: string[], divisionFilter: string[]): boolean {
  return selectionHasSubDivisions(orgStaticDivisions(companyFilter, []), divisionFilter);
}

/** All Scope names in company-org-data.ts, optionally scoped to company + division +
 *  sub-division names. Division-level scopes (divisions with `hasSubDivision: false`)
 *  are included only while no Sub-Division is selected, since they don't sit under one. */
function staticScopeNames(companyFilter: string[], divisionFilter: string[], subDivisionFilter: string[]): string[] {
  const divisions = orgStaticDivisions(companyFilter, divisionFilter);
  const subDivisionScopes = divisions
    .flatMap(d => d.subDivisions)
    .filter(sd => !subDivisionFilter.length || subDivisionFilter.includes(sd.subDivisionName))
    .flatMap(sd => sd.scopes);
  const divisionScopes = subDivisionFilter.length ? [] : divisions.flatMap(d => d.scopes ?? []);
  return uniqueSorted([...divisionScopes, ...subDivisionScopes].map(s => s.scopeName));
}

/** All top-level audit-scope names in the DAR org seed, optionally scoped to company + division + sub-division names. */
function orgScopeNames(companyFilter: string[], divisionFilter: string[], subDivisionFilter: string[]): string[] {
  const companies = companyFilter.length
    ? SCOPE_INDI_ORG_COMPANIES.filter(c => companyFilter.includes(c.companyName))
    : SCOPE_INDI_ORG_COMPANIES;
  const branches = companies
    .flatMap(c => c.divisions)
    .filter(b => !divisionFilter.length || divisionFilter.includes(b.divisionName));
  const departments = branches
    .flatMap(b => b.subDivisions)
    .filter(d => !subDivisionFilter.length || subDivisionFilter.includes(d.subDivisionName));
  // Only top-level scopes (parentScopeId === null) — sub-scopes back the
  // Evidence.subscope field, which has no filter control of its own yet.
  return uniqueSorted(
    departments.flatMap(d => d.scopes.filter(s => s.parentScopeId === null).map(s => s.scopeName)),
  );
}

/* ── Lookups ───────────────────────────────────────────────────────────────
   AddEvidenceComponent's Company/Division/Sub-Division fields (renamed
   there from Branch/Department) read from the same company-org-data.ts
   file as this page's filters and use the real company/branch/department
   *names* as their option values directly, so no code<->label translation
   is needed for those three fields — the old COMPANY_LABELS/BRANCH_LABELS/
   DEPARTMENT_LABELS maps (which assumed AddEvidenceComponent emitted coded
   values like 'crowe_uae'/'dubai'/'internal_audit') have been removed.
   AddEvidenceComponent's own form fields are named division/subDivision
   (not branch/department), so f.company/f.division/f.subDivision are
   mapped onto Evidence.company/Evidence.branch/Evidence.department below,
   and the same mapping runs in reverse (e.company/e.branch/e.department ->
   company/division/subDivision) when seeding the edit drawer. TASK_TITLES
   is unrelated to that and is kept as-is. ── */
/** TODO: replace with the real signed-in user once an auth/session service is wired in. */
const CURRENT_USER_NAME = 'You';

const TASK_TITLES: Record<string, string> = {
  'TSK-001': 'Review payment controls',
  'TSK-002': 'User access audit',
  'TSK-003': 'HR compliance review',
  'TSK-004': 'Vendor due diligence',
  'TSK-005': 'Patch compliance check',
};

const EVIDENCE_STATUS_DISPLAY: Record<EvidenceReviewStatus, string> = {
  requested: 'Requested',
  uploaded: 'Uploaded',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  document: 'Document',
  screenshot: 'Screenshot',
  interview_notes: 'Interview Notes',
  system_log: 'Log File',
  email: 'Email',
  physical_inspection: 'Physical Inspection',
  other: 'Other',
};

function formatEvidenceDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Count of evidence items uploaded by the given name, matching an exact display status (null = total). */
export function countEvidenceForAuditorByStatus(auditorName: string, displayStatus: string | null): number {
  return MOCK_EVIDENCE.filter(e =>
    e.uploadedBy === auditorName &&
    (displayStatus === null || (EVIDENCE_STATUS_DISPLAY[e.status ?? 'uploaded']) === displayStatus),
  ).length;
}

/**
 * Every evidence item uploaded by the given name, shaped for the
 * auditor-execution tab's "My Evidences" table.
 */
export function getEvidenceForAuditor(auditorName: string): {
  evidence: string; scope: string; type: string; risk: string; status: string; dueDate: string;
  detail: Evidence;
}[] {
  return MOCK_EVIDENCE
    .filter(e => e.uploadedBy === auditorName)
    .map(e => ({
      evidence: e.title,
      scope: e.scope,
      type: EVIDENCE_TYPE_LABELS[e.evidenceType],
      risk: e.risk ?? 'Medium',
      status: EVIDENCE_STATUS_DISPLAY[e.status ?? 'uploaded'],
      dueDate: formatEvidenceDate(e.createdDate),
      detail: e,
    }));
}

/* ── Component ──────────────────────────────────────────────────────────── */

@Component({
  selector: 'app-evidence-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    TooltipModule,
    TagModule,
    PopoverModule,
    ConfirmActionDialogComponent,
    PaginationBarComponent,
  
    DrawIconComponent,],
  templateUrl: './evidence-list.component.html',
  styleUrl: './evidence-list.component.scss',
})
export class EvidenceListComponent implements OnInit {
  @ViewChild('filterPanel') filterPanel!: Popover;
  @ViewChild('filesPopover') filesPopover!: Popover;

  private readonly drawer     = inject(RightDrawerService);
  private readonly downloader = inject(FileDownloadService);

  /* ── Data ── */
  readonly evidence = signal<Evidence[]>(MOCK_EVIDENCE);

  /* ── View mode ── */
  readonly viewMode = signal<'list' | 'grid'>('grid');

  /* ── Filters ── */
  readonly searchQuery         = signal('');
  readonly selectedFindings    = signal<string[]>([]);
  readonly selectedTypes       = signal<EvidenceType[]>([]);
  readonly selectedScopes      = signal<string[]>([]);
  readonly selectedTasks       = signal<string[]>([]);
  readonly selectedCompanies    = signal<string[]>([]);
  /** "Division" in the UI (renamed from Branch). */
  readonly selectedDivisions    = signal<string[]>([]);
  /** "Sub-Division" in the UI (renamed from Department). */
  readonly selectedSubDivisions = signal<string[]>([]);
  readonly selectedAuditors     = signal<string[]>([]);
  readonly dateRange           = signal<(Date | null)[] | null>(null);
  /** Scope to a specific review-workflow status (from the auditor-execution "My Evidences" cards). */
  readonly statusFilter        = signal<EvidenceReviewStatus | null>(null);

  /* ── Sort ── */
  readonly sortColumn    = signal<SortColumn | null>('createdDate');
  readonly sortDirection = signal<SortDir>('desc');

  /* ── Pagination ── */
  readonly pageSize    = signal(8);
  readonly currentPage = signal(1);

  /** Options for the "items per page" dropdown in the pagination footer. */
  readonly pageSizeOptions: number[] = [8, 25, 50, 100];

  /* ── Files popover ── */
  readonly moreFilesEvidence = signal<Evidence | null>(null);

  /* ── Confirmation dialog ── */
  readonly displayConfirmation = signal(false);
  readonly confirmationAction  = signal<'Activate' | 'Deactivate'>('Deactivate');
  private readonly pendingEvidence = signal<Evidence | null>(null);
  readonly confirmationTarget  = this.pendingEvidence;

  /* ── Filter options ── */
  readonly evidenceTypeOptions: { label: string; value: EvidenceType }[] = [
    { label: 'Document',            value: 'document'            },
    { label: 'Screenshot',          value: 'screenshot'          },
    { label: 'Interview Notes',     value: 'interview_notes'     },
    { label: 'System Log',          value: 'system_log'          },
    { label: 'Email',               value: 'email'               },
    { label: 'Physical Inspection', value: 'physical_inspection' },
    { label: 'Other',               value: 'other'               },
  ];

  readonly scopeFilterOptions = computed(() => {
    if (IS_INTERNAL_AUDIT_CLIENT) {
      return orgScopeNames(this.selectedCompanies(), this.selectedDivisions(), this.selectedSubDivisions())
        .map(s => ({ label: s, value: s }));
    }
    return staticScopeNames(this.selectedCompanies(), this.selectedDivisions(), this.selectedSubDivisions())
      .map(s => ({ label: s, value: s }));
  });

  readonly taskFilterOptions = computed(() => {
    const map = new Map<string, string>();
    this.evidence().forEach(e => map.set(e.taskId, e.taskTitle));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, label]) => ({ label: `${value} — ${label}`, value }));
  });

  readonly companyFilterOptions = computed(() => {
    if (IS_INTERNAL_AUDIT_CLIENT) {
      return uniqueSorted(ORG_COMPANY_NAMES).map(v => ({ label: v, value: v }));
    }
    return staticCompanyNames().map(v => ({ label: v, value: v }));
  });

  /** "Division" filter options (renamed from Branch). */
  readonly divisionFilterOptions = computed(() => {
    if (IS_INTERNAL_AUDIT_CLIENT) {
      return orgDivisionNames(this.selectedCompanies()).map(v => ({ label: v, value: v }));
    }
    return staticDivisionNames(this.selectedCompanies()).map(v => ({ label: v, value: v }));
  });

  /** "Sub-Division" filter options (renamed from Department). */
  readonly subDivisionFilterOptions = computed(() => {
    if (IS_INTERNAL_AUDIT_CLIENT) {
      return orgSubDivisionNames(this.selectedCompanies(), this.selectedDivisions()).map(v => ({ label: v, value: v }));
    }
    return staticSubDivisionNames(this.selectedCompanies(), this.selectedDivisions()).map(v => ({ label: v, value: v }));
  });

  /** Hidden when every selected division is flagged `hasSubDivision: false`. */
  readonly subDivisionFilterVisible = computed(() => {
    if (IS_INTERNAL_AUDIT_CLIENT) {
      return orgSubDivisionFilterVisible(this.selectedCompanies(), this.selectedDivisions());
    }
    return staticSubDivisionFilterVisible(this.selectedCompanies(), this.selectedDivisions());
  });

  readonly auditorFilterOptions = computed(() => {
    const set = new Set(this.evidence().map(e => e.uploadedBy).filter(Boolean) as string[]);
    return Array.from(set).sort().map(v => ({ label: v, value: v }));
  });

  /* ── Active filter count & chips ── */
  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedTypes().length)       count++;
    if (this.selectedScopes().length)      count++;
    if (this.selectedTasks().length)       count++;
    if (this.selectedCompanies().length)    count++;
    if (this.selectedDivisions().length)    count++;
    if (this.selectedSubDivisions().length) count++;
    if (this.selectedAuditors().length)     count++;
    if (this.dateRange()?.[0] || this.dateRange()?.[1]) count++;
    return count;
  });

  readonly activeFilterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.selectedTypes().length)
      chips.push({ key: 'types',       label: `Type: ${this.selectedTypes().length}` });
    if (this.selectedScopes().length)
      chips.push({ key: 'scopes',      label: `Scope: ${this.selectedScopes().length}` });
    if (this.selectedTasks().length)
      chips.push({ key: 'tasks',       label: `Task: ${this.selectedTasks().length}` });
    if (this.selectedCompanies().length)
      chips.push({ key: 'companies',    label: `Company: ${this.selectedCompanies().length}` });
    if (this.selectedDivisions().length)
      chips.push({ key: 'divisions',    label: `Division: ${this.selectedDivisions().length}` });
    if (this.selectedSubDivisions().length)
      chips.push({ key: 'subdivisions', label: `Sub-Division: ${this.selectedSubDivisions().length}` });
    if (this.selectedAuditors().length)
      chips.push({ key: 'auditors',    label: `Auditor: ${this.selectedAuditors().length}` });
    if (this.dateRange()?.[0] || this.dateRange()?.[1])
      chips.push({ key: 'date',        label: 'Date range' });
    return chips;
  });

  removeFilter(key: string): void {
    switch (key) {
      case 'types':       this.selectedTypes.set([]);       break;
      case 'scopes':      this.selectedScopes.set([]);      break;
      case 'tasks':       this.selectedTasks.set([]);       break;
      case 'companies':    this.selectedCompanies.set([]);    this.selectedDivisions.set([]); this.selectedSubDivisions.set([]); break;
      case 'divisions':    this.selectedDivisions.set([]);    this.selectedSubDivisions.set([]); break;
      case 'subdivisions': this.selectedSubDivisions.set([]); break;
      case 'auditors':     this.selectedAuditors.set([]);     break;
      case 'date':        this.dateRange.set(null);         break;
    }
    this.currentPage.set(1);
  }

  /* ── Derived: filtered + sorted list ── */
  readonly filtered = computed(() => {
    let list = this.evidence();

    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(e =>
      e.id.toLowerCase().includes(q) ||
      e.title.toLowerCase().includes(q) ||
      (e.findingId ?? '').toLowerCase().includes(q),
    );

    const findings = this.selectedFindings();
    if (findings.length) list = list.filter(e => !!e.findingId && findings.includes(e.findingId));

    const types = this.selectedTypes();
    if (types.length) list = list.filter(e => types.includes(e.evidenceType));

    const scopes = this.selectedScopes();
    if (scopes.length) list = list.filter(e => scopes.includes(e.scope));

    const tasks = this.selectedTasks();
    if (tasks.length) list = list.filter(e => tasks.includes(e.taskId));

    const companies = this.selectedCompanies();
    if (companies.length) list = list.filter(e => e.company && companies.includes(e.company));

    const divisions = this.selectedDivisions();
    if (divisions.length) list = list.filter(e => e.branch && divisions.includes(e.branch));

    const subDivisions = this.selectedSubDivisions();
    // Ignored while the Sub-Division filter is hidden so a stale selection can't apply.
    if (subDivisions.length && this.subDivisionFilterVisible()) list = list.filter(e => e.department && subDivisions.includes(e.department));

    const auditors = this.selectedAuditors();
    if (auditors.length) list = list.filter(e => e.uploadedBy && auditors.includes(e.uploadedBy));

    const status = this.statusFilter();
    if (status) list = list.filter(e => (e.status ?? 'uploaded') === status);

    const range = this.dateRange();
    if (range?.[0] || range?.[1]) {
      const from = range[0]?.getTime();
      const to   = range[1]?.getTime();
      list = list.filter(e => {
        const t = e.createdDate.getTime();
        if (from !== undefined && t < from) return false;
        if (to   !== undefined && t > to)   return false;
        return true;
      });
    }

    const col = this.sortColumn();
    if (col) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = this.sortValue(a, col);
        const bv = this.sortValue(b, col);
        if (av < bv) return -1 * dir;
        if (av > bv) return  1 * dir;
        return 0;
      });
    }
    return list;
  });

  readonly paginated = computed(() => {
    const all  = this.filtered();
    const size = this.pageSize();
    const max  = Math.max(1, Math.ceil(all.length / size));
    const page = Math.min(this.currentPage(), max);
    return all.slice((page - 1) * size, page * size);
  });

  readonly hasActiveFilters = computed(() =>
    !!this.searchQuery().trim() ||
    !!this.selectedFindings().length ||
    !!this.selectedTypes().length ||
    !!this.selectedScopes().length ||
    !!this.selectedTasks().length ||
    !!this.selectedCompanies().length ||
    !!this.selectedDivisions().length ||
    !!this.selectedSubDivisions().length ||
    !!this.selectedAuditors().length ||
    !!(this.dateRange()?.[0] || this.dateRange()?.[1]),
  );

  private readonly route = inject(ActivatedRoute);

  /**
   * Pre-applies filters when navigated from a dashboard card, e.g.
   * /evidencelist?status=under_review&auditorId=Bob%20Smith
   */
  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const auditorId = params.get('auditorId');
      const status = params.get('status') as EvidenceReviewStatus | null;
      if (auditorId) this.selectedAuditors.set([auditorId]);
      this.statusFilter.set(
        status && (['requested', 'uploaded', 'under_review', 'accepted', 'rejected'] as const).includes(status)
          ? status
          : null,
      );
      if (auditorId || status) this.currentPage.set(1);
    });
  }

  /* ── Filter handlers ── */
  onSearchChange(q: string)                    { this.searchQuery.set(q);              this.currentPage.set(1); }
  onFindingsChange(v: string[])                { this.selectedFindings.set(v ?? []);   this.currentPage.set(1); }
  onTypesChange(v: EvidenceType[])             { this.selectedTypes.set(v ?? []);      this.currentPage.set(1); }
  onScopesChange(v: string[])                  { this.selectedScopes.set(v ?? []);     this.currentPage.set(1); }
  onTasksChange(v: string[])                   { this.selectedTasks.set(v ?? []);      this.currentPage.set(1); }
  onCompaniesChange(v: string[])               { this.selectedCompanies.set(v ?? []);   this.selectedDivisions.set([]); this.selectedSubDivisions.set([]); this.currentPage.set(1); }
  /** Division filter (renamed from Branch). */
  onDivisionsChange(v: string[])               { this.selectedDivisions.set(v ?? []);   this.selectedSubDivisions.set([]); this.currentPage.set(1); }
  /** Sub-Division filter (renamed from Department). */
  onSubDivisionsChange(v: string[])            { this.selectedSubDivisions.set(v ?? []); this.currentPage.set(1); }
  onAuditorsChange(v: string[])                { this.selectedAuditors.set(v ?? []);    this.currentPage.set(1); }
  onDateRangeChange(r: (Date | null)[] | null) { this.dateRange.set(r);                this.currentPage.set(1); }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedFindings.set([]);
    this.selectedTypes.set([]);
    this.selectedScopes.set([]);
    this.selectedTasks.set([]);
    this.selectedCompanies.set([]);
    this.selectedDivisions.set([]);
    this.selectedSubDivisions.set([]);
    this.selectedAuditors.set([]);
    this.dateRange.set(null);
    this.currentPage.set(1);
  }

  /* ── Sort ── */
  onSort(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }
  sortIconFor(col: SortColumn): string {
    if (this.sortColumn() !== col) return '';
    return this.sortDirection() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down';
  }
  private sortValue(e: Evidence, col: SortColumn): string | number {
    switch (col) {
      case 'id':           return parseInt(e.id.replace(/\D/g, ''), 10) || 0;
      case 'title':        return e.title.toLowerCase();
      case 'evidenceType': return e.evidenceType;
      case 'scope':        return e.scope.toLowerCase();
      case 'findingId':    return (e.findingId ?? '').toLowerCase();
      case 'createdDate':  return e.createdDate.getTime();
      case 'files':        return e.files.length;
    }
  }

  evidenceTypeLabel(t: EvidenceType): string {
    return this.evidenceTypeOptions.find(o => o.value === t)?.label ?? t;
  }

  /* ── Pagination ── */
  /** <app-pagination-bar> emits a zero-based page index. */
  onPageChange(page: number): void {
    this.currentPage.set(page + 1);
  }

  /** Called when the "items per page" dropdown changes. Resets to page 1
   *  so the visible slice stays consistent with the new page size. */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  setViewMode(m: 'list' | 'grid'): void { this.viewMode.set(m); }

  /* ── Actions ── */
  async openAdd(): Promise<void> {
    const ref = this.drawer.open<AddEvidenceResult, AddEvidenceDrawerData>(
      AddEvidenceComponent,
      { width: '720px', data: { mode: 'create' } },
    );
    const result = await ref.afterClosed;
    if (result) this.addEvidenceFromResult(result);
  }

  async openEdit(e: Evidence): Promise<void> {
    const ref = this.drawer.open<AddEvidenceResult, AddEvidenceDrawerData>(
      AddEvidenceComponent,
      {
        width: '720px',
        data: {
          mode: 'edit',
          // company/division/subDivision/scope/subscope/taskId are included so
          // the drawer's cascading dropdowns pre-fill correctly (see the
          // ordering note on AddEvidenceComponent.ngOnInit) — previously only
          // title/description were passed, so every other field re-opened blank.
          // AddEvidenceComponent's form fields are named division/subDivision
          // (renamed from branch/department there), so Evidence.branch /
          // Evidence.department are mapped onto those keys here.
          existing: {
            id: e.id,
            title: e.title,
            description: e.description,
            evidenceType: e.evidenceType,
            company: e.company,
            division: e.branch,
            subDivision: e.department,
            scope: e.scope,
            subscope: e.subscope,
            taskId: e.taskId,
          },
        },
      },
    );
    const result = await ref.afterClosed;
    if (result) this.updateEvidenceFromResult(e.id, result);
  }

  /**
   * Turns the Add Evidence drawer's raw form result into a full `Evidence`
   * record and puts it straight into the list — previously this just
   * console.info'd the result, so a newly added item never actually showed
   * up anywhere. Prepending plus resetting to page 1 means it's visible
   * immediately regardless of the current sort column (the default sort is
   * Created ↓, which already puts it first on its own).
   */
  private addEvidenceFromResult(result: AddEvidenceResult): void {
    const form = result.form;
    const newEvidence: Evidence = {
      id: this.nextEvidenceId(),
      title: form.title,
      evidenceType: form.evidenceType as EvidenceType,
      scope: form.scope,
      subscope: form.subscope,
      taskId: form.taskId,
      taskTitle: TASK_TITLES[form.taskId] ?? '',
      createdDate: new Date(),
      files: this.toEvidenceFiles(form.documents),
      description: form.description,
      uploadedBy: CURRENT_USER_NAME,
      company: form.company,
      // AddEvidenceComponent's form fields are division/subDivision
      // (renamed from branch/department there) — mapped back onto
      // Evidence.branch/Evidence.department here.
      branch: form.division,
      department: form.subDivision ?? undefined,
      isActive: true,
      status: 'uploaded',
    };
    this.evidence.update(list => [newEvidence, ...list]);
    this.currentPage.set(1);

    // Temporary bridge: also surface this freshly submitted evidence in the
    // Pending Approvals queue, awaiting review — the two lists are still
    // separate mock stores, so this just mirrors the essentials across.
    // Risk rating defaults to 'medium' since Add Evidence doesn't collect
    // one yet; adjust here once it does.
    const pendingItem: PendingItem = {
      id: newEvidence.id,
      type: 'evidence',
      status: 'pending_review',
      riskRating: 'medium',
      title: newEvidence.title,
      description: newEvidence.description ?? '',
      submittedBy: CURRENT_USER_NAME,
      submittedDate: newEvidence.createdDate,
      company: newEvidence.company ?? '',
      division: newEvidence.branch ?? '',
      subDivision: newEvidence.department ?? '',
    };
    addPendingItem(pendingItem);
  }

  /** Applies an edit-drawer result back onto the matching record in the list. */
  private updateEvidenceFromResult(id: string, result: AddEvidenceResult): void {
    const form = result.form;
    const newFiles = this.toEvidenceFiles(form.documents);
    this.evidence.update(list => list.map(c => c.id !== id ? c : {
      ...c,
      title: form.title,
      evidenceType: form.evidenceType as EvidenceType,
      scope: form.scope,
      subscope: form.subscope,
      taskId: form.taskId,
      taskTitle: TASK_TITLES[form.taskId] ?? c.taskTitle,
      description: form.description,
      company: form.company,
      // AddEvidenceComponent's form fields are division/subDivision
      // (renamed from branch/department there) — mapped back onto
      // Evidence.branch/Evidence.department here.
      branch: form.division,
      department: form.subDivision ?? undefined,
      // Keep the existing files unless the user actually attached new ones
      // in the edit drawer (the drawer doesn't currently show previously
      // uploaded files back to the user, so an empty selection here just
      // means "didn't touch the attachments").
      files: newFiles.length ? newFiles : c.files,
    }));
  }

  private toEvidenceFiles(documents?: File[]): EvidenceFile[] {
    return (documents ?? []).map(f => ({ name: f.name, size: f.size, file: f }));
  }

  /** Next sequential EV-### id, based on the highest numeric id currently in the list. */
  private nextEvidenceId(): string {
    const max = this.evidence().reduce(
      (m, e) => Math.max(m, parseInt(e.id.replace(/\D/g, ''), 10) || 0), 0,
    );
    return `EV-${String(max + 1).padStart(3, '0')}`;
  }

  openView(e: Evidence): void {
    this.drawer.open<EvidenceDetailComponent, EvidenceDetailDrawerData>(
      EvidenceDetailComponent,
      { width: '720px', data: { evidence: e } },
    );
  }

  /* ── Activate / Deactivate ── */
  openConfirmation(evidence: Evidence): void {
    this.pendingEvidence.set(evidence);
    this.confirmationAction.set(evidence.isActive ? 'Deactivate' : 'Activate');
    this.displayConfirmation.set(true);
  }

  closeConfirmation(): void {
    this.displayConfirmation.set(false);
    this.pendingEvidence.set(null);
  }

  confirmToggleBlocked(): void {
    const e = this.pendingEvidence();
    if (e) {
      this.evidence.update(list =>
        list.map(c => c.id === e.id ? { ...c, isActive: !c.isActive } : c)
      );
    }
    this.closeConfirmation();
  }

  /* ── Files popover ── */
  showMoreFiles(e: Evidence, event: MouseEvent): void {
    this.moreFilesEvidence.set(e);
    this.filesPopover.toggle(event);
  }

  /* ── Helpers ── */
  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':                    return 'pi-file-pdf';
      case 'doc': case 'docx':       return 'pi-file-word';
      case 'xls': case 'xlsx':       return 'pi-file-excel';
      case 'png': case 'jpg':
      case 'jpeg': case 'gif':       return 'pi-image';
      case 'zip': case 'rar':        return 'pi-folder';
      default:                       return 'pi-file';
    }
  }

  downloadFile(f: EvidenceFile): void {
    const source = f.file ?? f.url;
    if (source) this.downloader.download(source, f.name);
  }

  trackById = (_: number, e: Evidence) => e.id;
}