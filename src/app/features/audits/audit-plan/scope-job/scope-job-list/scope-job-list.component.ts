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
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { Popover, PopoverModule } from 'primeng/popover';
import { ActivatedRoute } from '@angular/router';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { ScopeJobProfileComponent, ScopeJobProfileDrawerData } from '../scope-job-details/scope-job-details.component';
import { EditScopeJobComponent, EditScopeJobDrawerData } from '../manage-scope-job/manage-scope-job.component';
import { StatusUpdateDrawerComponent, StatusUpdateDrawerData, StatusUpdateResult } from '../scope-job-status-update/scope-job-status-update.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
// Same client-mode switch audit-scope-static-data.ts uses to decide between
// AUDIT_FIRM_SCOPE_COMPANIES and SCOPE_INDI_ORG_COMPANIES — reused here so the
// Scope Jobs page automatically follows whichever roster Audit Scope
// Management is showing, instead of drifting out of sync with its own toggle.
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';
import { StaticCompany } from '@/app/features/audits/audit-plan/audit-scope-management/models/audit-scope.model';
import { SCOPE_INDI_ORG_COMPANIES } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-indi-org.data';
// Company / Division / Sub-Division filter options come from the shared static
// org directory (same source as the sibling list pages) instead of being
// scraped off the job records — ORG_STATIC_DATA_INTERNAL_AUDIT in
// 'internal-audit' client mode, otherwise ORG_STATIC_DATA. See `orgData` below.
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';
import { ORG_STATIC_DATA_INTERNAL_AUDIT } from '@/app/features/audits/Org-data-internal-audit';
// Real scope records — DAR Exchange's scope jobs are generated FROM these
// (filtered to workflowStatus === 'Approved') instead of being hand-written,
// so this list stays in sync with whatever Audit Scope Management shows as
// approved instead of drifting out of sync with it.




/* ── Models ────────────────────────────────────────────────────────────────── */

export type AuditFrequency = 'monthly' | 'quarterly' | 'annually';
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type ModeOfAudit = 'full' | 'limited' | 'thematic' | 'follow-up' | 'continuous';

export interface ScopeJob {
  id: string;
  title: string;       // e.g. "Financial Controls Review — Jan 2025"
  scopeId: string;
  scopeName: string;
  company: string;
  division: string;
  subDivision: string | null; // '—' = division-level scope
  auditFrequency: AuditFrequency;
  modeOfAudit: ModeOfAudit;
  periodLabel: string;   // e.g. "Jan 2025", "Q1 2025", "FY 2025"
  periodStart: Date;
  periodEnd: Date;
  assignedAuditors: string[];
  assignedReviewers: string[];
  status: JobStatus;
  createdDate: Date;
  isActive: boolean;
  objective?: string;
  subscopes?: string[];
}

/* ── Auditor / Reviewer profile types ──────────────────────────────────────── */

export interface AuditorProfile {
  id:              string;
  name:            string;
  initials:        string;
  role:            string;
  experienceYears: number;
  expertise:       string[];
  workloadPct:     number;
}

export interface ReviewerProfile {
  id:               string;
  name:             string;
  initials:         string;
  role:             string;
  experienceYears:  number;
  reviewsCompleted: number;
  reviewsPending:   number;
}

export const AUDITOR_REGISTRY: Record<string, AuditorProfile> = {
  alice: { id: 'alice', name: 'Alice Johnson', initials: 'AJ', role: 'Senior Auditor',   experienceYears: 8,  expertise: ['Finance', 'Internal Controls'],   workloadPct: 75 },
  bob:   { id: 'bob',   name: 'Bob Smith',     initials: 'BS', role: 'Audit Lead',        experienceYears: 12, expertise: ['IT Audit', 'Risk Management'],     workloadPct: 60 },
  carol: { id: 'carol', name: 'Carol White',   initials: 'CW', role: 'Auditor',           experienceYears: 4,  expertise: ['Compliance', 'Regulatory'],        workloadPct: 80 },
  david: { id: 'david', name: 'David Lee',     initials: 'DL', role: 'Senior Auditor',   experienceYears: 6,  expertise: ['HR Audit', 'Operational Risk'],    workloadPct: 55 },
  // Added alongside the DAR Exchange AML/CFT Compliance scope jobs (SC-5000)
  // below, so the Auditor filter shows a real name instead of the raw id
  // "emma" when CLIENT_MODE_VALUE === 'internal-audit'.
  emma:  { id: 'emma',  name: 'Emma Davis',    initials: 'ED', role: 'Compliance Auditor', experienceYears: 7,  expertise: ['AML/CFT', 'Compliance'],          workloadPct: 65 },
};

export const REVIEWER_REGISTRY: Record<string, ReviewerProfile> = {
  emma:  { id: 'emma',  name: 'Emma Davis',   initials: 'ED', role: 'Audit Manager',     experienceYears: 10, reviewsCompleted: 48, reviewsPending: 3 },
  frank: { id: 'frank', name: 'Frank Miller', initials: 'FM', role: 'Senior Reviewer',   experienceYears: 9,  reviewsCompleted: 35, reviewsPending: 2 },
  grace: { id: 'grace', name: 'Grace Wilson', initials: 'GW', role: 'Reviewer',          experienceYears: 5,  reviewsCompleted: 22, reviewsPending: 4 },
  henry: { id: 'henry', name: 'Henry Brown',  initials: 'HB', role: 'Senior Reviewer',   experienceYears: 11, reviewsCompleted: 60, reviewsPending: 1 },
};

type SortColumn =
  | 'id' | 'title' | 'scopeName' | 'periodStart' | 'periodEnd'
  | 'status' | 'company' | 'subDivision' | 'createdDate';
type SortDir = 'asc' | 'desc';

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function monthLabel(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function quarterLabel(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

/** Generate scope jobs from a parent scope definition. */
function generateJobs(
  scopeId: string,
  scopeName: string,
  company: string,
  division: string,
  subDivision: string | null,
  frequency: AuditFrequency,
  modeOfAudit: ModeOfAudit,
  startDate: Date,
  endDate: Date,
  auditors: string[],
  reviewers: string[],
  idPrefix: string,
  idStart: number,
  objective?: string,
  subscopes?: string[],
): ScopeJob[] {
  const jobs: ScopeJob[] = [];
  const now = new Date();

  let cursor = new Date(startDate);
  let idx = idStart;

  while (cursor <= endDate) {
    let periodStart = new Date(cursor);
    let periodEnd: Date;
    let periodLabel: string;

    if (frequency === 'monthly') {
      periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); // last day of month
      periodLabel = monthLabel(periodStart);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    } else if (frequency === 'quarterly') {
      const q = Math.floor(cursor.getMonth() / 3);
      periodEnd = new Date(cursor.getFullYear(), (q + 1) * 3, 0);
      periodLabel = quarterLabel(periodStart);
      cursor = new Date(cursor.getFullYear(), (q + 1) * 3, 1);
    } else {
      // annually
      periodEnd = new Date(cursor.getFullYear(), 11, 31);
      periodLabel = `FY ${cursor.getFullYear()}`;
      cursor = new Date(cursor.getFullYear() + 1, 0, 1);
    }

    if (periodStart > endDate) break;
    if (periodEnd > endDate) periodEnd = new Date(endDate);

    let status: JobStatus;
    if (periodEnd < now) {
      status = Math.random() > 0.3 ? 'completed' : 'overdue';
    } else if (periodStart <= now && periodEnd >= now) {
      status = 'in_progress';
    } else {
      status = 'pending';
    }

    jobs.push({
      id: `${idPrefix}-${String(idx).padStart(3, '0')}`,
      title: `${scopeName} — ${periodLabel}`,
      scopeId,
      scopeName,
      company,
      division,
      subDivision,
      auditFrequency: frequency,
      modeOfAudit,
      periodLabel,
      periodStart,
      periodEnd,
      assignedAuditors: auditors,
      assignedReviewers: reviewers,
      status,
      createdDate: new Date(startDate),
      isActive: true,
      ...(objective  ? { objective }  : {}),
      ...(subscopes  ? { subscopes }  : {}),
    });

    idx++;
  }

  return jobs;
}

/* ── Mock data ──────────────────────────────────────────────────────────────── */

/** Default (multi-company audit-firm) demo roster — shown whenever
 *  CLIENT_MODE_VALUE !== 'internal-audit'. Unchanged from before; only its
 *  name changed (was the exported MOCK_SCOPE_JOBS) so it can sit alongside
 *  DAR_EXCHANGE_SCOPE_JOBS below the same way AUDIT_FIRM_SCOPE_COMPANIES
 *  sits alongside SCOPE_INDI_ORG_COMPANIES in audit-scope-static-data.ts. */
const AUDIT_FIRM_SCOPE_JOBS: ScopeJob[] = [
  // Monthly scope: Jan–Dec 2026 → 12 jobs (spans past, current, and future periods
  // so pending / in-progress / completed / overdue all occur relative to today)
  ...generateJobs(
    'SC-001', 'Financial Controls Review',
    'Crowe UAE', 'Dubai', 'Internal Audit',
    'monthly', 'full',
    new Date('2026-01-01'), new Date('2026-12-31'),
    ['fatima', 'arjun', 'bob'], ['karim'],
    'SJ', 1,
    'Assess the design and operating effectiveness of key financial controls across revenue, expenditure, and payroll cycles to ensure accuracy and completeness of financial reporting.',
    ['Revenue Cycle Controls', 'Expenditure & AP Controls', 'Payroll Verification', 'Journal Entry Review', 'Bank Reconciliation'],
  ),

  // Quarterly scope: Jan–Dec 2025 → 4 jobs
  ...generateJobs(
    'SC-002', 'IT Security Baseline',
    'Crowe UAE', 'Abu Dhabi', 'IT',
    'quarterly', 'thematic',
    new Date('2025-01-01'), new Date('2025-12-31'),
    ['carol'], ['frank'],
    'SJ', 101,
    'Evaluate the adequacy of IT general controls including access management, change management, and incident response to safeguard organisational data and systems.',
    ['Access Management', 'Change Management', 'Incident Response', 'Data Backup & Recovery'],
  ),

  // Annual scope: 2025 → 1 job
  ...generateJobs(
    'SC-003', 'HR Compliance Audit',
    'Crowe UAE', 'Sharjah', 'External Audit',
    'annually', 'limited',
    new Date('2025-01-01'), new Date('2027-12-31'),
    ['fatima', 'bob'], ['noura'],
    'SJ', 201,
    'Review HR policies, recruitment practices, and employee lifecycle processes to verify compliance with UAE Labour Law and internal HR governance standards.',
    ['Recruitment & Onboarding', 'Leave & Attendance', 'Performance Management', 'Termination Procedures'],
  ),

  // Monthly scope: Jan–Jun 2025 → 6 jobs
  ...generateJobs(
    'SC-004', 'AML / CFT Monitoring',
    'Crowe KSA', 'Riyadh', 'Regulatory',
    'monthly', 'continuous',
    new Date('2025-01-01'), new Date('2025-06-30'),
    ['alice', 'carol'], ['henry'],
    'SJ', 301,
    'Monitor transactional patterns and client due diligence processes to ensure compliance with AML/CFT regulations and SAMA guidelines, and identify suspicious activity indicators.',
    ['Customer Due Diligence (CDD)', 'Transaction Monitoring', 'Suspicious Activity Reporting', 'Sanctions Screening'],
  ),

  // Quarterly scope: 2025 → 4 jobs
  ...generateJobs(
    'SC-005', 'Operational Risk Register Review',
    'Crowe Qatar', 'Doha', 'Risk Management',
    'quarterly', 'follow-up',
    new Date('2026-01-01'), new Date('2026-12-31'),
    ['miguel', 'bob', 'priya'], ['karim', 'james'],
    'SJ', 401,
    'Follow up on prior-period operational risk findings to verify management action plan implementation and assess residual risk levels across key business processes.',
    ['Action Plan Tracking', 'Residual Risk Assessment', 'Control Remediation', 'Risk Register Update'],
  ),
];

/**
 * Builds ScopeJob[] for every scope across the given companies whose
 * workflowStatus is literally 'Approved' — a scope still Not Started /
 * Planned / Pending Review / Rejected isn't on the plan yet, and one already
 * past Approved into In Progress / Completed / Overdue doesn't get new scope
 * jobs generated here either. This mirrors the same 'Approved' filter the
 * Audit Plan's adapter uses, so Scope Jobs and Audit Plan always agree on
 * which scopes are "live" for the year.
 *
 * Jobs run across the full fiscal year (1 Jan – 31 Dec of the scope's own
 * start-date year) at the scope's own auditFrequency, the same way the
 * original hand-written SC-5000 entry expanded its Q1-only engagement
 * window into 4 quarterly jobs — one per quarter — instead of just one.
 */
function jobsForApprovedScopes(companies: StaticCompany[], idPrefix: string): ScopeJob[] {
  const jobs: ScopeJob[] = [];
  const allScopes = companies.flatMap(company =>
    company.divisions.flatMap(division =>
      division.subDivisions.flatMap(subDivision =>
        subDivision.scopes.map(scope => ({ scope, company, divisionName: division.divisionName })),
      ),
    ),
  );
  const subscopeNamesOf = (scopeId: string) =>
    allScopes.filter(s => s.scope.parentScopeId === scopeId).map(s => s.scope.scopeName);

  let block = 0;
  for (const { scope, company, divisionName } of allScopes) {
    if (scope.workflowStatus !== 'Approved') continue;

    const year = scope.startDate ? new Date(scope.startDate).getFullYear() : new Date().getFullYear();
    const subscopes = subscopeNamesOf(scope.id);
    block += 1;

    jobs.push(...generateJobs(
      scope.id,
      scope.scopeName,
      company.companyName,
      divisionName,
      scope.subDivisionName,
      scope.auditFrequency,
      scope.modeOfAudit,
      new Date(year, 0, 1),
      new Date(year, 11, 31),
      scope.assignedAuditors,
      scope.assignedReviewers,
      idPrefix,
      block * 100 + 1,
      scope.objective,
      subscopes.length ? subscopes : undefined,
    ));
  }

  return jobs;
}

/** DAR Exchange's scope jobs, shown only when CLIENT_MODE_VALUE ===
 *  'internal-audit' — generated from SCOPE_INDI_ORG_COMPANIES's real,
 *  currently-Approved scopes instead of being hand-written per scope. */
const DAR_EXCHANGE_SCOPE_JOBS: ScopeJob[] = jobsForApprovedScopes(SCOPE_INDI_ORG_COMPANIES, 'SJ');

/** The live scope-job roster every consumer of this file gets — same
 *  CLIENT_MODE_VALUE switch as AUDIT_SCOPE_STATIC_COMPANIES in
 *  audit-scope-static-data.ts, so Scope Jobs always matches whichever
 *  roster Audit Scope Management is currently showing. */
export const MOCK_SCOPE_JOBS: ScopeJob[] =
  CLIENT_MODE_VALUE === 'internal-audit' ? DAR_EXCHANGE_SCOPE_JOBS : AUDIT_FIRM_SCOPE_JOBS;

/* ── Component ──────────────────────────────────────────────────────────────── */

@Component({
  selector: 'app-scope-job-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    MultiSelectModule,
    DatePickerModule,
    TooltipModule,
    TagModule,
    PopoverModule,
    ConfirmActionDialogComponent,
    PaginationBarComponent,

    DrawIconComponent,],
  templateUrl: './scope-job-list.component.html',
  styleUrl: './scope-job-list.component.scss',
})
export class ScopeJobListComponent implements OnInit {
  @ViewChild('filterPanel') filterPanel!: Popover;

  private readonly drawer = inject(RightDrawerService);
  private readonly route  = inject(ActivatedRoute);

  /* ── Data ── */
  readonly jobs = signal<ScopeJob[]>(MOCK_SCOPE_JOBS);

  /* ── View mode ── */
  readonly viewMode = signal<'list' | 'grid'>('grid');

  /* ── Filters ── */
  readonly searchQuery          = signal('');
  readonly selectedScopes       = signal<string[]>([]);
  readonly selectedStatuses     = signal<JobStatus[]>([]);
  readonly selectedFrequencies  = signal<AuditFrequency[]>([]);
  readonly selectedCompanies    = signal<string[]>([]);
  readonly selectedDivisions     = signal<string[]>([]);
  readonly selectedSubDivisions  = signal<string[]>([]);
  readonly selectedAuditors     = signal<string[]>([]);
  readonly periodRange          = signal<(Date | null)[] | null>(null);

  /* ── Sort ── */
  readonly sortColumn    = signal<SortColumn | null>('periodStart');
  readonly sortDirection = signal<SortDir>('asc');

  /* ── Pagination ── */
  readonly pageSize    = signal(10);
  readonly currentPage = signal(1);

  /** Options for the "items per page" dropdown in the pagination footer. */
  readonly pageSizeOptions: number[] = [10, 25, 50, 100];

  /* ── Confirmation dialog ── */
  readonly displayConfirmation = signal(false);
  readonly confirmationAction  = signal<'Activate' | 'Deactivate'>('Deactivate');
  private readonly pendingJob  = signal<ScopeJob | null>(null);
  readonly confirmationTarget  = this.pendingJob;

  /* ── Static filter options ── */
  readonly statusOptions: { label: string; value: JobStatus }[] = [
    { label: 'Pending',     value: 'pending'     },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed',   value: 'completed'   },
    { label: 'Overdue',     value: 'overdue'     },
  ];

  readonly frequencyOptions: { label: string; value: AuditFrequency }[] = [
    { label: 'Monthly',    value: 'monthly'    },
    { label: 'Quarterly',  value: 'quarterly'  },
    { label: 'Annually',   value: 'annually'   },
  ];

  /* ── Dynamic filter options (derived from data) ── */
  readonly scopeFilterOptions = computed(() => {
    const map = new Map<string, string>();
    this.jobs().forEach(j => map.set(j.scopeId, j.scopeName));
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ label: `${value} — ${label}`, value }));
  });

  /** Org directory for the current client mode — source of the org filters below. */
  readonly orgData = CLIENT_MODE_VALUE === 'internal-audit' ? ORG_STATIC_DATA_INTERNAL_AUDIT : ORG_STATIC_DATA;

  /** The selected companies, or every company when none is selected. */
  private scopedCompanies(names: string[]) {
    return names.length ? this.orgData.filter(c => names.includes(c.companyName)) : this.orgData;
  }

  /** Every company in the org directory. Values are company names (matching `j.company`). */
  readonly companyFilterOptions = computed(() =>
    this.orgData
      .map(c => ({ label: c.companyName, value: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /** Divisions of the selected companies (or all). Values are division names (matching `j.division`). */
  readonly divisionFilterOptions = computed(() => {
    const set = new Set(
      this.scopedCompanies(this.selectedCompanies()).flatMap(c => c.divisions.map(d => d.divisionName)),
    );
    return Array.from(set).sort().map(v => ({ label: v, value: v }));
  });

  /** Sub-Divisions of the selected companies + divisions (or all). Divisions
   *  flagged `hasSubDivision: false` contribute none. Values are sub-division
   *  names (matching `j.subDivision`). */
  readonly subDivisionFilterOptions = computed(() => {
    const divisions = this.selectedDivisions();
    const set = new Set(
      this.scopedCompanies(this.selectedCompanies())
        .flatMap(c => c.divisions)
        .filter(d => d.hasSubDivision !== false)
        .filter(d => !divisions.length || divisions.includes(d.divisionName))
        .flatMap(d => d.subDivisions.map(sd => sd.subDivisionName)),
    );
    return Array.from(set).sort().map(v => ({ label: v, value: v }));
  });

  /** False only when at least one Division is selected and every selected
   *  Division is flagged `hasSubDivision: false` — the Sub-Division field is
   *  then hidden (and its selection ignored). Unknown divisions count as
   *  having sub-divisions. */
  readonly subDivisionFilterVisible = computed(() => {
    const selected = this.selectedDivisions();
    if (!selected.length) return true;
    const divisions = this.scopedCompanies(this.selectedCompanies()).flatMap(c => c.divisions);
    return selected.some(name => {
      const matches = divisions.filter(d => d.divisionName === name);
      return !matches.length || matches.some(d => d.hasSubDivision !== false);
    });
  });

  readonly auditorFilterOptions = computed(() => {
    const set = new Set(this.jobs().flatMap(j => j.assignedAuditors));
    return Array.from(set)
      .map(id => ({ label: AUDITOR_REGISTRY[id]?.name ?? id, value: id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  /* ── Active filter count & chips ── */
  readonly activeFilterCount = computed(() => {
    let c = 0;
    if (this.selectedScopes().length)       c++;
    if (this.selectedStatuses().length)     c++;
    if (this.selectedFrequencies().length)  c++;
    if (this.selectedCompanies().length)    c++;
    if (this.selectedDivisions().length)     c++;
    if (this.selectedSubDivisions().length)  c++;
    if (this.selectedAuditors().length)     c++;
    if (this.periodRange()?.[0] || this.periodRange()?.[1]) c++;
    return c;
  });

  readonly activeFilterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.selectedScopes().length)
      chips.push({ key: 'scopes',       label: `Scope: ${this.selectedScopes().length}` });
    if (this.selectedStatuses().length)
      chips.push({ key: 'statuses',     label: `Status: ${this.selectedStatuses().length}` });
    if (this.selectedFrequencies().length)
      chips.push({ key: 'frequencies',  label: `Frequency: ${this.selectedFrequencies().length}` });
    if (this.selectedCompanies().length)
      chips.push({ key: 'companies',    label: `Company: ${this.selectedCompanies().length}` });
    if (this.selectedDivisions().length)
      chips.push({ key: 'divisions',    label: `Division: ${this.selectedDivisions().length}` });
    if (this.selectedSubDivisions().length)
      chips.push({ key: 'subDivisions', label: `Sub-Division: ${this.selectedSubDivisions().length}` });
    if (this.selectedAuditors().length)
      chips.push({ key: 'auditors',     label: `Auditor: ${this.selectedAuditors().length}` });
    if (this.periodRange()?.[0] || this.periodRange()?.[1])
      chips.push({ key: 'period',       label: 'Period range' });
    return chips;
  });

  readonly hasActiveFilters = computed(() =>
    !!this.searchQuery().trim() ||
    !!this.selectedScopes().length ||
    !!this.selectedStatuses().length ||
    !!this.selectedFrequencies().length ||
    !!this.selectedCompanies().length ||
    !!this.selectedDivisions().length ||
    !!this.selectedSubDivisions().length ||
    !!this.selectedAuditors().length ||
    !!(this.periodRange()?.[0] || this.periodRange()?.[1]),
  );

  removeFilter(key: string): void {
    switch (key) {
      case 'scopes':       this.selectedScopes.set([]);       break;
      case 'statuses':     this.selectedStatuses.set([]);     break;
      case 'frequencies':  this.selectedFrequencies.set([]);  break;
      case 'companies':    this.selectedCompanies.set([]); this.selectedDivisions.set([]); this.selectedSubDivisions.set([]); break;
      case 'divisions':    this.selectedDivisions.set([]);     this.selectedSubDivisions.set([]); break;
      case 'subDivisions': this.selectedSubDivisions.set([]);  break;
      case 'auditors':     this.selectedAuditors.set([]);     break;
      case 'period':       this.periodRange.set(null);        break;
    }
    this.currentPage.set(1);
  }

  /* ── Derived: filtered + sorted list ── */
  readonly filtered = computed(() => {
    let list = this.jobs();

    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(j =>
      j.id.toLowerCase().includes(q) ||
      j.title.toLowerCase().includes(q) ||
      j.scopeName.toLowerCase().includes(q) ||
      j.scopeId.toLowerCase().includes(q) ||
      j.periodLabel.toLowerCase().includes(q),
    );

    const scopes = this.selectedScopes();
    if (scopes.length) list = list.filter(j => scopes.includes(j.scopeId));

    const statuses = this.selectedStatuses();
    if (statuses.length) list = list.filter(j => statuses.includes(j.status));

    const freqs = this.selectedFrequencies();
    if (freqs.length) list = list.filter(j => freqs.includes(j.auditFrequency));

    const companies = this.selectedCompanies();
    if (companies.length) list = list.filter(j => companies.includes(j.company));

    const divisions = this.selectedDivisions();
    if (divisions.length) list = list.filter(j => divisions.includes(j.division));

    const subDivisions = this.selectedSubDivisions();
    // Ignored while the Sub-Division field is hidden, so it can't stay applied.
    if (subDivisions.length && this.subDivisionFilterVisible()) list = list.filter(j => j.subDivision ? subDivisions.includes(j.subDivision) : []);

    const auditors = this.selectedAuditors();
    if (auditors.length) list = list.filter(j => j.assignedAuditors.some(a => auditors.includes(a)));

    const range = this.periodRange();
    if (range?.[0] || range?.[1]) {
      const from = range[0]?.getTime();
      const to   = range[1]?.getTime();
      list = list.filter(j => {
        const t = j.periodStart.getTime();
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

  /* ── Summary stats ── */
  readonly stats = computed(() => {
    const all = this.jobs();
    return {
      total:      all.length,
      pending:    all.filter(j => j.status === 'pending').length,
      inProgress: all.filter(j => j.status === 'in_progress').length,
      completed:  all.filter(j => j.status === 'completed').length,
      overdue:    all.filter(j => j.status === 'overdue').length,
    };
  });

  ngOnInit(): void {
    /* load from service here */

    /* Pre-select a status filter passed via query param
       (e.g. from the Audit Plan "Scope Job Summary" cards). */
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status && this.statusOptions.some(o => o.value === status)) {
      this.selectedStatuses.set([status as JobStatus]);
    }
  }

  /* ── Filter event handlers ── */
  onSearchChange(q: string)                    { this.searchQuery.set(q);                  this.currentPage.set(1); }
  onScopesChange(v: string[])                  { this.selectedScopes.set(v ?? []);         this.currentPage.set(1); }
  onStatusesChange(v: JobStatus[])             { this.selectedStatuses.set(v ?? []);       this.currentPage.set(1); }
  onFrequenciesChange(v: AuditFrequency[])     { this.selectedFrequencies.set(v ?? []);    this.currentPage.set(1); }
  onCompaniesChange(v: string[])               { this.selectedCompanies.set(v ?? []); this.selectedDivisions.set([]); this.selectedSubDivisions.set([]); this.currentPage.set(1); }
  onDivisionsChange(v: string[])                { this.selectedDivisions.set(v ?? []);       this.selectedSubDivisions.set([]); this.currentPage.set(1); }
  onSubDivisionsChange(v: string[])             { this.selectedSubDivisions.set(v ?? []);    this.currentPage.set(1); }
  onAuditorsChange(v: string[])                { this.selectedAuditors.set(v ?? []);       this.currentPage.set(1); }
  onPeriodRangeChange(r: (Date | null)[] | null) { this.periodRange.set(r);                this.currentPage.set(1); }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedScopes.set([]);
    this.selectedStatuses.set([]);
    this.selectedFrequencies.set([]);
    this.selectedCompanies.set([]);
    this.selectedDivisions.set([]);
    this.selectedSubDivisions.set([]);
    this.selectedAuditors.set([]);
    this.periodRange.set(null);
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
    this.currentPage.set(1);
  }

  setViewMode(m: 'list' | 'grid'): void { this.viewMode.set(m); }

  /* ── Label helpers ── */
  statusLabel(s: JobStatus): string {
    const map: Record<JobStatus, string> = {
      pending:     'Pending',
      in_progress: 'In Progress',
      completed:   'Completed',
      overdue:     'Overdue',
    };
    return map[s];
  }

  statusSeverity(s: JobStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<JobStatus, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      pending:     'secondary',
      in_progress: 'info',
      completed:   'success',
      overdue:     'danger',
    };
    return map[s];
  }

  frequencyLabel(f: AuditFrequency): string {
    const map: Record<AuditFrequency, string> = {
      monthly:   'Monthly',
      quarterly: 'Quarterly',
      annually:  'Annually',
    };
    return map[f];
  }

  /* ── TrackBy ── */
  trackById(_: number, j: ScopeJob): string { return j.id; }

  /* ── Sort helpers ── */
  sortValue(j: ScopeJob, col: SortColumn): string | number {
    switch (col) {
      case 'id':          return j.id;
      case 'title':       return j.title.toLowerCase();
      case 'scopeName':   return j.scopeName.toLowerCase();
      case 'periodStart': return j.periodStart.getTime();
      case 'periodEnd':   return j.periodEnd.getTime();
      case 'status':      return j.status;
      case 'company':     return j.company.toLowerCase();
      case 'subDivision': return j?.subDivision ? j?.subDivision?.toLowerCase() : '';
      case 'createdDate': return j.createdDate.getTime();
      default:            return '';
    }
  }

  sortIconFor(col: SortColumn): Record<string, boolean> {
    const active = this.sortColumn() === col;
    const asc    = this.sortDirection() === 'asc';
    return {
      'pi-sort-alt':        !active,
      'pi-sort-amount-up':   active && asc,
      'pi-sort-amount-down': active && !asc,
    };
  }

  /* ── Drawers ── */
  openProfile(job: ScopeJob): void {
    this.drawer.open<ScopeJobProfileComponent, ScopeJobProfileDrawerData>(
      ScopeJobProfileComponent,
      { width: '720px', styleClass: 'scope-job-profile-drawer', data: { job } },
    );
  }

  editJob(job: ScopeJob): void {
    this.drawer.open<EditScopeJobComponent, EditScopeJobDrawerData>(
      EditScopeJobComponent, {
        width: '680px',
        styleClass: 'edit-scope-job-drawer',
        data: { job },
      },
    );
  }

  openStatusUpdate(job: ScopeJob): void {
    this.drawer.open<StatusUpdateDrawerComponent, StatusUpdateDrawerData>(
      StatusUpdateDrawerComponent,
      {
        width: '480px',
        styleClass: 'status-update-drawer',
        data: { target: 'job', job },
      },
    );
  }

  /* ── Confirmation dialog (activate / deactivate) ── */
  openConfirmation(job: ScopeJob): void {
    this.pendingJob.set(job);
    this.confirmationAction.set(job.isActive ? 'Deactivate' : 'Activate');
    this.displayConfirmation.set(true);
  }

  onConfirmAction(): void {
    const job = this.pendingJob();
    if (job) {
      this.jobs.update(list =>
        list.map(j => j.id === job.id ? { ...j, isActive: !j.isActive } : j),
      );
    }
    this.displayConfirmation.set(false);
    this.pendingJob.set(null);
  }

  onCancelAction(): void {
    this.displayConfirmation.set(false);
    this.pendingJob.set(null);
  }

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
}