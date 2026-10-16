import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
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
import { Popover, PopoverModule } from 'primeng/popover';

import {
  AuditFinding,
  FindingSeverity,
  FindingStatus,
} from '@/app/features/audits/audit-execution/findings/services/audit-finding.service';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import {
  AddFindingComponent,
  AddFindingDrawerData,
  AddFindingResult,
} from '../add-finding/add-finding.component';
import {
  FindingProfileComponent,
  FindingProfileData,
} from '../finding-profile/finding-profile.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';
import { ORG_STATIC_DATA_INTERNAL_AUDIT } from '@/app/features/audits/Org-data-internal-audit';
import { CLIENT_MODE } from '@/app/core/config/client-mode';
import { ACTIVE_STATUSES, RichAuditFinding, MOCK_FINDINGS, isOpenFinding } from '@/app/features/audits/audit-execution/findings/audit-finding-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// Company/Division/Sub-Division/Scope/Sub-scope filter options below come
// from the shared company-org-data.ts file (the same common Company ->
// Division -> Sub-Division -> Scope -> Sub-scope static data used by the
// Add Member modal, Members list, Companies list, Add Risk drawer, Risk
// Register, Scope Jobs, Evidence Repository and Observations filters)
// instead of being scraped off whatever values happen to appear on
// MOCK_FINDINGS — so the filter always offers the full canonical list.
// Division narrows to the selected Company(ies)' divisions, Sub-Division
// narrows to the selected Company(ies)+Division(s)' sub-divisions, Scope
// narrows to the selected .../Sub-Division(s)' scopes, and Sub-scope
// narrows to the selected .../Scope(s)' sub-scopes — same cascading
// behaviour as those other pages' multi-select filters.
//
// CLIENT_MODE support: when CLIENT_MODE is 'internal-audit' these filters
// (and the Add/Edit Finding drawer's cascading picker, once it's wired the
// same way) read from ORG_STATIC_DATA_INTERNAL_AUDIT — the DAR Exchange
// single-org seed built from company/division/audit-scope
// *-static-indi-org.data.ts — instead of the multi-company ORG_STATIC_DATA
// roster, exactly the same CLIENT_MODE ? … : … pattern CompanyDataService
// already uses. See `orgData` below.
// Adjust the '@/app/data/company-org-data' and
// '@/app/data/org-data-internal-audit.adapter' paths if those files live
// elsewhere.
//
// AuditFinding.company / .branch / .department / .scope / .subscope are
// plain display-name strings (not ids/codes), so the option *values* here
// are the company/division/sub-division/scope/subscope *names* themselves
// (the underlying data fields are still called .branch and .department —
// only the filter's own labels/variables have been renamed to Division and
// Sub-Division here; renaming the AuditFinding fields themselves would
// touch audit-finding.service.ts, which isn't part of this component). The
// 12 seed MOCK_FINDINGS records below have been aligned to real
// companies/divisions/sub-divisions from company-org-data.ts — they
// previously used unrelated placeholder names ('Crowe UAE'/'Crowe Oman'/
// 'Crowe Saudi Arabia'/'Crowe Qatar' with divisions like 'Dubai'/'Muscat'/
// 'Riyadh'/'Doha', and generic sub-division labels like 'Finance'/'IT
// Security'/'Treasury' that don't exist in company-org-data.ts under those
// exact names), which never matched anything and would have made these
// filters show zero records too.
//
// The "+ New Finding" drawer (AddFindingComponent) is now wired the same
// way (Company/Division/Sub-Division cascading, plus the fully cascading
// Company→Division→Sub-Division→Scope→Sub-scope picker, like Add
// Evidence's and Add Observation's drawers already had). Its option
// *values* are the same company/division/sub-division/scope/subscope
// *names* used here, so the old COMPANY_LABELS/BRANCH_LABELS/
// DEPARTMENT_LABELS/SCOPE_LABELS/SUBSCOPE_LABELS code-translation lookup
// that used to bridge between its local codes (crowe_uae, dubai,
// internal_audit, ...) and these display names is gone — onAddFinding()
// and onEditFinding() below now pass company/branch/department/scope/
// subscope straight through instead of translating (still named branch/
// department on the AddFindingComponent's own form contract). Risk isn't
// part of company-org-data.ts, so RISK_LABELS/RISK_VALUES stay as a local
// code ↔ label lookup, unchanged.


type SortColumn = 'id' | 'title' | 'subdivision' | 'severity' | 'status' | 'dueDate' | 'owner';
type SortDir    = 'asc' | 'desc';
type ViewMode   = 'list' | 'grid';

export interface EditFindingPayload {
  finding: AuditFinding;
  existing: {
    id:          string;
    title:       string;
    severity?:   string;
    subDivision?: string;
    status:      string;
    dueDate?:    Date | null;
  };
}

// RichAuditFinding and MOCK_FINDINGS now live in finding-data.ts — shared
// with audit-findings.component.ts (the Findings dashboard), so the two
// pages can never disagree about what a finding is or how many of them
// exist. See that file's doc comment for why this used to be a second,
// disconnected mock dataset here.
//
// The auditor-aggregation helpers below (countOpenFindingsForAuditor,
// countFindingsForAuditorByDisplayStatus, countHighRiskFindingsForAuditor,
// getFindingsForAuditor) stayed here rather than moving to
// audit-finding-data.ts — auditor-overview.ts and auditor-execution.ts both
// import them from this component file, so they need to keep being
// exported from here.

/** Count of open findings assigned to the given auditor id — used by the auditor overview KPI card. */
export function countOpenFindingsForAuditor(auditorId: string): number {
  return MOCK_FINDINGS.filter(f => f.status === 'open' && f.assignedAuditor?.id === auditorId).length;
}

/** Display label for the auditor-execution tab's Findings summary cards/table, per real FindingStatus. */
const FINDING_STATUS_DISPLAY: Record<FindingStatus, string> = {
  open: 'Draft',
  rejected: 'Draft',
  'in-progress': 'Submitted',
  responded: 'Under Review',
  escalated: 'Under Review',
  overdue: 'Under Review',
  verified: 'Approved',
  closed: 'Closed',
};

function findingRiskLabel(severity: FindingSeverity): 'High' | 'Medium' | 'Low' {
  if (severity === 'critical' || severity === 'high') return 'High';
  if (severity === 'medium') return 'Medium';
  return 'Low';
}

/** Count of findings assigned to the auditor, matching an exact display status (null = total). */
export function countFindingsForAuditorByDisplayStatus(auditorId: string, displayStatus: string | null): number {
  return MOCK_FINDINGS.filter(f =>
    f.assignedAuditor?.id === auditorId &&
    (displayStatus === null || FINDING_STATUS_DISPLAY[f.status] === displayStatus),
  ).length;
}

/** Count of high/critical-severity findings assigned to the auditor. */
export function countHighRiskFindingsForAuditor(auditorId: string): number {
  return MOCK_FINDINGS.filter(f => f.assignedAuditor?.id === auditorId && (f.severity === 'critical' || f.severity === 'high')).length;
}

/**
 * Every finding assigned to the given auditor, shaped for the
 * auditor-execution tab's "My Findings" table.
 */
export function getFindingsForAuditor(auditorId: string): {
  finding: string; audit: string; scope: string; risk: string; status: string; owner: string;
  detail: FindingProfileData;
}[] {
  return MOCK_FINDINGS
    .filter(f => f.assignedAuditor?.id === auditorId)
    .map(f => {
      const rich = f as RichAuditFinding;
      return {
        finding: rich.title,
        audit: rich.subDivision,
        scope: rich.scope ?? '—',
        risk: findingRiskLabel(rich.severity),
        status: FINDING_STATUS_DISPLAY[rich.status],
        owner: rich.owner?.fullName ?? '—',
        detail: {
          id: rich.id, title: rich.title, severity: rich.severity, status: rich.status,
          subDivision: rich.subDivision, scope: rich.scope, subscope: rich.subscope,
          taskId: rich.taskId, company: rich.company, division: rich.division, risk: rich.risk,
          dueDate: rich.dueDate, createdAt: rich.createdAt, owner: rich.owner,
          description: rich.description, observationIds: rich.observationIds,
          documents: rich.documents, financialImpact: rich.financialImpact,
          isRepeated: rich.isRepeated, flaggedForEscalation: rich.flaggedForEscalation,
          daysOverdue: rich.daysOverdue,
        },
      };
    });
}
// RichAuditFinding and MOCK_FINDINGS now live in finding-data.ts — shared
// with audit-findings.component.ts (the Findings dashboard), so the two
// pages can never disagree about what a finding is or how many of them
// exist. See that file's doc comment for why this used to be a second,
// disconnected mock dataset here.

/* ── Lookups: map AddFindingComponent's option "values" ↔ the display
   "labels" stored on finding records — NOTE: only RISK_LABELS/RISK_VALUES
   remain. AddFindingComponent's Company/Division/Sub-Division/Scope/Subscope
   options are now sourced from company-org-data.ts too (see
   add-finding.component.ts), using the same company/division/sub-division/
   scope/subscope *names* as this list, so the old COMPANY_LABELS/
   BRANCH_LABELS/DEPARTMENT_LABELS/SCOPE_LABELS/SUBSCOPE_LABELS
   code-translation lookups that used to bridge between its local codes and
   these display names are gone — onAddFinding()/onEditFinding() below now
   pass company/division/subDivision/scope/subscope straight through instead
   of translating (named division/subDivision on the underlying
   AuditFinding/form contract). Risk isn't part of company-org-data.ts, so
   it stays a local code ↔ label lookup as before. ── */
const RISK_LABELS: Record<string, string> = {
  finance: 'Risk related to accounts', hr: 'Risk in Human Resources', it: 'IT TAX risks',
};
const invert = (m: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(m).map(([value, label]) => [label, value]));
const RISK_VALUES = invert(RISK_LABELS);

@Component({
  selector: 'app-findings-tab',
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
    PopoverModule,
    PaginationBarComponent,
    DrawIconComponent
  ],
  templateUrl: './findings-list.component.html',
  styleUrls: ['./findings-list.component.scss'],
})
export class FindingsListComponent implements OnInit {

  @ViewChild('findingsPanel') findingsPanel!: Popover;

  private readonly drawer = inject(RightDrawerService);
  private readonly route  = inject(ActivatedRoute);
  private readonly clientMode = inject(CLIENT_MODE);

  /* ── Inputs ──────────────────────────────────────────────── */
  readonly findings  = input<AuditFinding[]>([]);
  readonly loadingId = input<string | null>(null);

  /* ── Outputs ─────────────────────────────────────────────── */
  readonly viewFinding        = output<AuditFinding>();
  readonly viewPrevOccurrence = output<AuditFinding>();
  readonly editFinding        = output<EditFindingPayload>();
  readonly toggleActive       = output<{ finding: AuditFinding; active: boolean }>();
  readonly addFinding         = output<void>();
  readonly exportPdf          = output<void>();
  readonly exportExcel        = output<void>();

  /* ── Internal data ───────────────────────────────────────── */
  private readonly _findings = signal<RichAuditFinding[]>([]);

  readonly deactivatedIds = signal<Set<string>>(new Set());

  /* ── Profile dialog state ────────────────────────────────── */
  readonly selectedFinding = signal<FindingProfileData | null>(null);
  readonly profileVisible  = signal(false);

  /* ── View mode ───────────────────────────────────────────── */
  readonly viewMode = signal<ViewMode>('grid');

  /* ── Filter state ────────────────────────────────────────── */
  readonly searchQuery          = signal('');
  readonly selectedSeverities   = signal<FindingSeverity[]>([]);
  readonly selectedStatuses     = signal<FindingStatus[]>([]);
  readonly selectedSubdivisions = signal<string[]>([]);
  readonly selectedCompanies    = signal<string[]>([]);
  readonly selectedDivisions    = signal<string[]>([]);
  readonly selectedScopes       = signal<string[]>([]);
  readonly selectedSubscopes    = signal<string[]>([]);
  readonly selectedAuditors     = signal<string[]>([]);
  /** Scope to a specific assigned auditor id (from the overview "Open Findings" card). */
  readonly auditorIdFilter     = signal<string | null>(null);
  readonly dateRange           = signal<(Date | null)[] | null>(null);
  /** Set when arriving from the dashboard "Repeated Findings" card. */
  readonly repeatedOnly        = signal(false);

  /* ── Sort state ──────────────────────────────────────────── */
  readonly sortColumn    = signal<SortColumn | null>('dueDate');
  readonly sortDirection = signal<SortDir>('asc');

  /* ── Pagination ──────────────────────────────────────────── */
  readonly pageSize    = signal(10);
  readonly currentPage = signal(1);

  /** Options for the "items per page" dropdown in the pagination footer. */
  readonly pageSizeOptions: number[] = [10, 25, 50, 100];
  readonly confirmPending = signal<{
    finding: AuditFinding;
    action:  'activate' | 'deactivate';
  } | null>(null);

  /* ── Static filter options ───────────────────────────────── */
  readonly severityFilterOptions: { label: string; value: FindingSeverity }[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'High',     value: 'high'     },
    { label: 'Medium',   value: 'medium'   },
    { label: 'Low',      value: 'low'      },
  ];

  readonly statusFilterOptions: { label: string; value: FindingStatus }[] = [
    { label: 'Open',        value: 'open'        },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Responded',   value: 'responded'   },
    { label: 'Verified',    value: 'verified'    },
    { label: 'Closed',      value: 'closed'      },
    { label: 'Overdue',     value: 'overdue'     },
    { label: 'Escalated',   value: 'escalated'   },
    { label: 'Rejected',    value: 'rejected'    },
  ];

  /* ── Dynamic filter options ──────────────────────────────── */

  /**
   * Active Company -> Division -> Sub-Division -> Scope -> Sub-scope
   * directory to build the filters below from — ORG_STATIC_DATA_INTERNAL_AUDIT
   * (the DAR Exchange single-org seed) when CLIENT_MODE is 'internal-audit',
   * otherwise the existing multi-company ORG_STATIC_DATA roster. Same
   * CLIENT_MODE ? … : … pattern CompanyDataService already uses, so this
   * list — and the Add/Edit Finding drawer, once it reads from here too —
   * automatically reflects whichever client mode the build is running in.
   */
  readonly orgData = computed(() =>
    this.clientMode === 'internal-audit' ? ORG_STATIC_DATA_INTERNAL_AUDIT : ORG_STATIC_DATA,
  );

  /**
   * Every company in the active org directory (see `orgData` above),
   * instead of scraping distinct values off this._findings() — so the
   * filter always offers the full canonical list, not just whatever
   * happens to appear in the current data. The option value is the company
   * *name* (AuditFinding.company is a plain display string, not an id) so
   * it lines up 1:1 with `f.company`.
   */
  readonly companyFilterOptions = computed(() =>
    this.orgData()
      .map(c => ({ label: c.companyName, value: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /**
   * Divisions for the selected companies (or every company, if none are
   * selected yet), sourced from the active org directory. Values are
   * division *names* (matching `f.branch`), not division codes.
   */
  readonly divisionFilterOptions = computed(() => {
    const companyNames = this.selectedCompanies();
    const companies = companyNames.length
      ? this.orgData().filter(c => companyNames.includes(c.companyName))
      : this.orgData();

    const names = new Set<string>();
    companies.forEach(c => c.divisions.forEach(d => names.add(d.divisionName)));

    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ label: name, value: name }));
  });

  /**
   * Sub-Divisions for the selected companies + divisions (or every division
   * under those companies, if no division is selected yet), sourced from
   * the active org directory. Values are sub-division *names* (matching
   * `f.subDivision`), not sub-division codes.
   */
  readonly subdivisionFilterOptions = computed(() => {
    const companyNames  = this.selectedCompanies();
    const divisionNames = this.selectedDivisions();
    const companies = companyNames.length
      ? this.orgData().filter(c => companyNames.includes(c.companyName))
      : this.orgData();

    const names = new Set<string>();
    companies.forEach(c =>
      c.divisions
        // Divisions flagged `hasSubDivision: false` contribute no sub-divisions.
        .filter(d => d.hasSubDivision !== false)
        .filter(d => !divisionNames.length || divisionNames.includes(d.divisionName))
        .forEach(d => d.subDivisions.forEach(sd => names.add(sd.subDivisionName))),
    );

    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ label: name, value: name }));
  });

  /**
   * Whether the Sub-Division filter is shown — false only when at least one
   * division is selected and every selected division (looked up in the
   * active org directory, within the selected companies) is flagged
   * `hasSubDivision: false`. Unknown divisions count as having sub-divisions.
   */
  readonly subDivisionFilterVisible = computed(() => {
    const companyNames  = this.selectedCompanies();
    const divisionNames = this.selectedDivisions();
    if (!divisionNames.length) return true;
    const companies = companyNames.length
      ? this.orgData().filter(c => companyNames.includes(c.companyName))
      : this.orgData();
    const divisions = companies.flatMap(c => c.divisions);
    return divisionNames.some(name => {
      const matches = divisions.filter(d => d.divisionName === name);
      return !matches.length || matches.some(d => d.hasSubDivision !== false);
    });
  });

  /**
   * Scopes for the selected companies + divisions + sub-divisions (or every
   * sub-division under those, if none is selected yet), sourced from the
   * active org directory. Values are scope *names* (matching `f.scope`).
   */
  readonly scopeFilterOptions = computed(() => {
    const companyNames     = this.selectedCompanies();
    const divisionNames    = this.selectedDivisions();
    const subdivisionNames = this.selectedSubdivisions();
    const companies = companyNames.length
      ? this.orgData().filter(c => companyNames.includes(c.companyName))
      : this.orgData();

    const names = new Set<string>();
    companies.forEach(c =>
      c.divisions
        .filter(d => !divisionNames.length || divisionNames.includes(d.divisionName))
        .forEach(d =>
          d.subDivisions
            .filter(sd => !subdivisionNames.length || subdivisionNames.includes(sd.subDivisionName))
            .forEach(sd => sd.scopes.forEach(s => names.add(s.scopeName))),
        ),
    );

    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ label: name, value: name }));
  });

  /**
   * Sub-scopes for the selected companies + divisions + sub-divisions +
   * scopes (or every scope under those, if none is selected yet), sourced
   * from the active org directory. Values are sub-scope *names* (matching
   * `f.subscope`).
   */
  readonly subscopeFilterOptions = computed(() => {
    const companyNames     = this.selectedCompanies();
    const divisionNames    = this.selectedDivisions();
    const subdivisionNames = this.selectedSubdivisions();
    const scopeNames       = this.selectedScopes();
    const companies = companyNames.length
      ? this.orgData().filter(c => companyNames.includes(c.companyName))
      : this.orgData();

    const names = new Set<string>();
    companies.forEach(c =>
      c.divisions
        .filter(d => !divisionNames.length || divisionNames.includes(d.divisionName))
        .forEach(d =>
          d.subDivisions
            .filter(sd => !subdivisionNames.length || subdivisionNames.includes(sd.subDivisionName))
            .forEach(sd =>
              sd.scopes
                .filter(s => !scopeNames.length || scopeNames.includes(s.scopeName))
                .forEach(s => (s.subScopes ?? []).forEach(sub => names.add(sub.subScopeName))),
            ),
        ),
    );

    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ label: name, value: name }));
  });

  readonly auditorFilterOptions = computed(() =>
    Array.from(new Set(
      this._findings().map(f => f.owner?.fullName).filter(Boolean) as string[],
    )).sort().map(v => ({ label: v, value: v })),
  );

  /* ── Filtered + sorted findings ──────────────────────────── */
  readonly filteredFindings = computed(() => {
    let list = this._findings() as RichAuditFinding[];

    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(f =>
      f.id.toLowerCase().includes(q) || f.title.toLowerCase().includes(q));

    const sevs = this.selectedSeverities();
    if (sevs.length) list = list.filter(f => sevs.includes(f.severity));

    const stats = this.selectedStatuses();
    if (stats.length) list = list.filter(f => stats.includes(f.status));

    const subdivisions = this.selectedSubdivisions();
    // Ignored while the Sub-Division filter is hidden so a stale selection can't apply.
    if (subdivisions.length && this.subDivisionFilterVisible())
      list = list.filter(f => subdivisions.includes(f.subDivision));

    const companies = this.selectedCompanies();
    if (companies.length)
      list = list.filter(f => f.company && companies.includes(f.company!));

    const divisions = this.selectedDivisions();
    if (divisions.length)
      list = list.filter(f => f.division && divisions.includes(f.division!));

    const scopes = this.selectedScopes();
    if (scopes.length)
      list = list.filter(f => f.scope && scopes.includes(f.scope!));

    const subscopes = this.selectedSubscopes();
    if (subscopes.length)
      list = list.filter(f => f.subscope && subscopes.includes(f.subscope!));

    const auditors = this.selectedAuditors();
    if (auditors.length)
      list = list.filter(f => f.owner?.fullName && auditors.includes(f.owner.fullName));

    const aId = this.auditorIdFilter();
    if (aId) list = list.filter(f => f.assignedAuditor?.id === aId);

    if (this.repeatedOnly()) list = list.filter(f => f.isRepeated);

    const range = this.dateRange();
    if (range?.[0] || range?.[1]) {
      const from = range[0]?.getTime();
      const to   = range[1]?.getTime();
      list = list.filter(f => {
        const due = f.dueDate.getTime();
        if (from !== undefined && due < from) return false;
        if (to   !== undefined && due > to)   return false;
        return true;
      });
    }

    const col = this.sortColumn();
    if (col) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = this.sortValue(a, col);
        const bv = this.sortValue(b, col);
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }

    return list;
  });

  readonly paginatedFindings = computed(() => {
    const all = this.filteredFindings();
    const size = this.pageSize();
    const maxPage = Math.max(1, Math.ceil(all.length / size));
    const page    = Math.min(this.currentPage(), maxPage);
    const start   = (page - 1) * size;
    return all.slice(start, start + size);
  });

  /* ── Filter metadata ─────────────────────────────────────── */
  readonly hasActiveFilters = computed(() =>
    !!this.searchQuery().trim() ||
    !!this.selectedSeverities().length ||
    !!this.selectedStatuses().length ||
    !!this.selectedSubdivisions().length ||
    !!this.selectedCompanies().length ||
    !!this.selectedDivisions().length ||
    !!this.selectedScopes().length ||
    !!this.selectedSubscopes().length ||
    !!this.selectedAuditors().length ||
    this.repeatedOnly() ||
    !!(this.dateRange()?.[0] || this.dateRange()?.[1]),
  );

  readonly activeFilterCount = computed(() => {
    let n = 0;
    if (this.selectedSeverities().length)   n++;
    if (this.selectedStatuses().length)     n++;
    if (this.selectedSubdivisions().length) n++;
    if (this.selectedCompanies().length)    n++;
    if (this.selectedDivisions().length)    n++;
    if (this.selectedScopes().length)       n++;
    if (this.selectedSubscopes().length)    n++;
    if (this.selectedAuditors().length)     n++;
    if (this.repeatedOnly())                n++;
    if (this.dateRange()?.[0] || this.dateRange()?.[1]) n++;
    return n;
  });

  readonly activeFilterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.selectedSeverities().length)   chips.push({ key: 'severities',   label: `Severity: ${this.selectedSeverities().length}`   });
    if (this.selectedStatuses().length)     chips.push({ key: 'statuses',     label: `Status: ${this.selectedStatuses().length}`       });
    if (this.selectedSubdivisions().length) chips.push({ key: 'subdivisions', label: `Sub-Division: ${this.selectedSubdivisions().length}` });
    if (this.selectedCompanies().length)    chips.push({ key: 'companies',    label: `Company: ${this.selectedCompanies().length}`     });
    if (this.selectedDivisions().length)    chips.push({ key: 'divisions',    label: `Division: ${this.selectedDivisions().length}`    });
    if (this.selectedScopes().length)       chips.push({ key: 'scopes',       label: `Scope: ${this.selectedScopes().length}`          });
    if (this.selectedSubscopes().length)    chips.push({ key: 'subscopes',    label: `Sub-scope: ${this.selectedSubscopes().length}`   });
    if (this.selectedAuditors().length)     chips.push({ key: 'auditors',     label: `Auditor: ${this.selectedAuditors().length}`      });
    if (this.repeatedOnly())                chips.push({ key: 'repeated',     label: 'Repeated' });
    if (this.dateRange()?.[0] || this.dateRange()?.[1]) chips.push({ key: 'date', label: 'Date range' });
    return chips;
  });

  /* ── KPI / side stats ────────────────────────────────────── */
  readonly counts = computed(() => {
    const list = this.filteredFindings();
    return {
      critical: list.filter(f => f.severity === 'critical').length,
      high:     list.filter(f => f.severity === 'high').length,
      medium:   list.filter(f => f.severity === 'medium').length,
      low:      list.filter(f => f.severity === 'low').length,
    };
  });

  /**
   * Every side-card number below is derived from the SAME `filteredFindings()`
   * list, each with its own explicit predicate, so a card's value can only
   * ever be what its label says it is. Previously "Open Findings" and
   * "Overdue" both bound to this computed's `overdueCount` (there was no
   * `openCount` at all), and "Repeated Findings" summed `financialImpact`
   * across every finding instead of just the repeated ones — both fixed
   * here. `verifyDataIntegrity()` below re-checks a couple of invariants on
   * every recompute so a future edit that reintroduces a mismatch like that
   * gets flagged in the console instead of shipping a silently wrong card.
   */
  readonly sideStats = computed(() => {
    const list         = this.filteredFindings();
    // Broad "open" — everything not closed/rejected (see `isOpenFinding` in
    // finding-data.ts) — so this card includes in-progress/responded/
    // verified/overdue/escalated findings, not just the literal 'open'
    // status. `closed` is defined as its exact complement so the two always
    // add up to `totalCount` (checked in `verifyDataIntegrity()` below).
    const open         = list.filter(isOpenFinding).length;
    const closed       = list.length - open;
    const overdueList  = list.filter(f => f.status === 'overdue' || f.status === 'escalated');
    const repeatedList = list.filter(f => f.isRepeated);
    return {
      openCount:        open,
      closedCount:      closed,
      totalCount:       list.length,
      repeatedCount:    repeatedList.length,
      repeatedImpact:   repeatedList.reduce((s, f) => s + (f.financialImpact ?? 0), 0),
      criticalHigh:     list.filter(f => f.severity === 'critical' || f.severity === 'high').length,
      aged30:           list.filter(f => (f.daysOverdue ?? 0) > 0 && (f.daysOverdue ?? 0) < 30).length,
      overdueCount:     overdueList.length,
      overdueDateRange: this.formatDueRange(overdueList),
    };
  });

  /** "Due {date}" / "Due {min} – {max}" for the Overdue card's sub-line —
   *  replaces the old hardcoded "Jan 1 – Mar 31, 2026" placeholder, which
   *  didn't correspond to any real filter or to the mock findings' actual
   *  due dates. */
  private formatDueRange(list: RichAuditFinding[]): string {
    if (!list.length) return 'No overdue findings';
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const times = list.map(f => f.dueDate.getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    return min.getTime() === max.getTime() ? `Due ${fmt(min)}` : `Due ${fmt(min)} – ${fmt(max)}`;
  }

  constructor() {
    // Re-validates the summary-card math every time the underlying data or
    // filters change. This is a safety net, not a fix by itself — see
    // `verifyDataIntegrity()`'s doc comment for what it actually checks.
    effect(() => this.verifyDataIntegrity());
  }

  /* ── Lifecycle ───────────────────────────────────────────── */
  ngOnInit(): void {
    const provided = this.findings();
    this._findings.set(provided.length ? (provided as RichAuditFinding[]) : MOCK_FINDINGS);
    this.applyViewFromQuery();
  }

  /**
   * Dev-time guard for the KPI cards: `counts()` and `sideStats()` each
   * reduce `filteredFindings()` down with their own predicates, so it's
   * possible for one of those reduces to quietly stop matching what its
   * card actually claims to show (that's exactly how "Open Findings" ended
   * up displaying the Overdue count, and "Repeated Findings" ended up
   * summing the financial impact of every finding instead of just the
   * repeated ones). This re-derives a few invariants that must always hold
   * and warns loudly in the console the moment one doesn't, so the next
   * regression like that is caught during development instead of shipping
   * a summary card that silently disagrees with the table underneath it.
   */
  private verifyDataIntegrity(): void {
    const list = this.filteredFindings();
    const c    = this.counts();
    const s    = this.sideStats();

    const severitySum = c.critical + c.high + c.medium + c.low;
    if (severitySum !== list.length) {
      console.warn(
        `[FindingsList] Severity KPI cards sum to ${severitySum} but ${list.length} findings are shown ` +
        `— a finding is missing a recognised severity value.`,
      );
    }

    const totalImpact = list.reduce((sum, f) => sum + (f.financialImpact ?? 0), 0);
    if (s.repeatedImpact > totalImpact) {
      console.warn(
        `[FindingsList] "Repeated Findings" financial impact (${s.repeatedImpact}) exceeds the total ` +
        `financial impact of all findings shown (${totalImpact}) — it should only ever be a subset.`,
      );
    }

    if (s.openCount > list.length || s.closedCount > list.length ||
        s.overdueCount > list.length || s.repeatedCount > list.length) {
      console.warn('[FindingsList] A side-stat count exceeds the number of findings currently shown.');
    }

    if (s.totalCount !== list.length) {
      console.warn(
        `[FindingsList] sideStats().totalCount (${s.totalCount}) doesn't match filteredFindings().length (${list.length}).`,
      );
    }

    if (s.openCount + s.closedCount !== s.totalCount) {
      console.warn(
        `[FindingsList] "Open" (${s.openCount}) + "Closed" (${s.closedCount}) doesn't add up to the total ` +
        `(${s.totalCount}) — every finding should be counted as exactly one or the other.`,
      );
    }
  }

  /**
   * Pre-applies filters when navigated from a dashboard KPI card
   * (e.g. /findings?view=overdue).
   */
  private applyViewFromQuery(): void {
    this.route.queryParamMap.subscribe(params => {
      this.auditorIdFilter.set(params.get('auditorId'));

      // Landed here from the auditor overview's "Raise Finding" quick
      // action — open the Add Finding drawer straight away.
      if (params.get('openAdd') === 'true') {
        this.onAddFinding();
      }

      const view = params.get('view');
      if (!view) return;

      // reset before applying so each drill-down starts clean
      this.selectedSeverities.set([]);
      this.selectedStatuses.set([]);
      this.repeatedOnly.set(false);

      switch (view) {
        // 'open' drill-throughs use the same broad ACTIVE_STATUSES set the
        // "Open Findings" KPI card is now computed from (see
        // isOpenFinding/ACTIVE_STATUSES in finding-data.ts), so the list a
        // KPI click lands on always shows exactly as many rows as the card
        // claimed — not just the literal single 'open' status.
        case 'open':               this.selectedStatuses.set(['open']); break;
        case 'closed':             this.selectedStatuses.set(['closed', 'rejected']); break;
        case 'overdue':            this.selectedStatuses.set(['overdue', 'escalated']); break;
        case 'repeated':           this.repeatedOnly.set(true); break;
        case 'critical-high-open':
          this.selectedSeverities.set(['critical', 'high']);
          this.selectedStatuses.set([...ACTIVE_STATUSES]);
          break;

        // ── auditor-execution "My Findings" cards (display-status buckets) ──
        case 'draft':              this.selectedStatuses.set(['open', 'rejected']); break;
        case 'submitted':          this.selectedStatuses.set(['in-progress']); break;
        case 'under-review':       this.selectedStatuses.set(['responded', 'escalated', 'overdue']); break;
        case 'approved':           this.selectedStatuses.set(['verified']); break;
        case 'my-closed':          this.selectedStatuses.set(['closed']); break;

        // ── auditor-reviews "Findings Reviews" card — everything actually
        // awaiting a reviewer/approver action (submitted-but-not-yet-reviewed
        // plus reviewed-but-not-yet-approved), excluding still-drafting
        // ('open'/'rejected') and already-finalised ('verified'/'closed') findings.
        case 'pending':            this.selectedStatuses.set(['in-progress', 'responded', 'escalated', 'overdue']); break;
        case 'high-risk':          this.selectedSeverities.set(['critical', 'high']); break;
      }
      this.currentPage.set(1);
    });
  }

  /* ── View mode ───────────────────────────────────────────── */
  setViewMode(m: ViewMode): void { this.viewMode.set(m); }

  /* ── Filter handlers ─────────────────────────────────────── */
  onSearchChange(q: string): void                    { this.searchQuery.set(q);              this.currentPage.set(1); }
  onSeveritiesChange(v: FindingSeverity[]): void     { this.selectedSeverities.set(v ?? []);  this.currentPage.set(1); }
  onStatusesChange(v: FindingStatus[]): void         { this.selectedStatuses.set(v ?? []);    this.currentPage.set(1); }
  onDateRangeChange(r: (Date | null)[] | null): void { this.dateRange.set(r);                 this.currentPage.set(1); }

  // Division/Sub-Division/Scope/Sub-scope now cascade off Company/Division/
  // Sub-Division/Scope respectively (see divisionFilterOptions/
  // subdivisionFilterOptions/scopeFilterOptions/subscopeFilterOptions
  // above, sourced from `orgData()`), so changing an upstream selection
  // clears whatever downstream selection is no longer valid — same
  // cascading reset behaviour as the Evidence Repository list's
  // Company/Division/Sub-Division filters.
  onCompaniesChange(v: string[]): void {
    this.selectedCompanies.set(v ?? []);
    this.selectedDivisions.set([]);
    this.selectedSubdivisions.set([]);
    this.selectedScopes.set([]);
    this.selectedSubscopes.set([]);
    this.currentPage.set(1);
  }
  onDivisionsChange(v: string[]): void {
    this.selectedDivisions.set(v ?? []);
    this.selectedSubdivisions.set([]);
    this.selectedScopes.set([]);
    this.selectedSubscopes.set([]);
    this.currentPage.set(1);
  }
  onSubdivisionsChange(v: string[]): void {
    this.selectedSubdivisions.set(v ?? []);
    this.selectedScopes.set([]);
    this.selectedSubscopes.set([]);
    this.currentPage.set(1);
  }
  onScopesChange(v: string[]): void {
    this.selectedScopes.set(v ?? []);
    this.selectedSubscopes.set([]);
    this.currentPage.set(1);
  }
  onSubscopesChange(v: string[]): void { this.selectedSubscopes.set(v ?? []); this.currentPage.set(1); }
  onAuditorsChange(v: string[]): void { this.selectedAuditors.set(v ?? []); this.currentPage.set(1); }

  removeFilter(key: string): void {
    switch (key) {
      case 'severities':   this.selectedSeverities.set([]);   break;
      case 'statuses':     this.selectedStatuses.set([]);     break;
      case 'subdivisions': this.selectedSubdivisions.set([]); this.selectedScopes.set([]); this.selectedSubscopes.set([]); break;
      case 'companies':    this.selectedCompanies.set([]);    this.selectedDivisions.set([]); this.selectedSubdivisions.set([]); this.selectedScopes.set([]); this.selectedSubscopes.set([]); break;
      case 'divisions':    this.selectedDivisions.set([]);    this.selectedSubdivisions.set([]); this.selectedScopes.set([]); this.selectedSubscopes.set([]); break;
      case 'scopes':       this.selectedScopes.set([]);       this.selectedSubscopes.set([]); break;
      case 'subscopes':    this.selectedSubscopes.set([]);    break;
      case 'auditors':     this.selectedAuditors.set([]);     break;
      case 'repeated':     this.repeatedOnly.set(false);      break;
      case 'date':         this.dateRange.set(null);          break;
    }
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedSeverities.set([]);
    this.selectedStatuses.set([]);
    this.selectedSubdivisions.set([]);
    this.selectedCompanies.set([]);
    this.selectedDivisions.set([]);
    this.selectedScopes.set([]);
    this.selectedSubscopes.set([]);
    this.selectedAuditors.set([]);
    this.repeatedOnly.set(false);
    this.dateRange.set(null);
    this.currentPage.set(1);
  }

  /* ── Sort handlers ───────────────────────────────────────── */
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

  private sortValue(f: AuditFinding, col: SortColumn): string | number {
    switch (col) {
      case 'id':          return parseInt(f.id.replace(/\D/g, ''), 10) || 0;
      case 'title':       return f.title.toLowerCase();
      case 'subdivision': return f.subDivision.toLowerCase();
      case 'severity':    return ({ low: 1, medium: 2, high: 3, critical: 4 } as const)[f.severity];
      case 'status':      return f.status;
      case 'dueDate':     return f.dueDate.getTime();
      case 'owner':       return f.owner.fullName.toLowerCase();
    }
  }

  /* ── Pagination ──────────────────────────────────────────── */
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

  /* ── Actions ─────────────────────────────────────────────── */

  /** Opens the profile dialog for a finding */
  onViewFinding(f: AuditFinding): void {
    const rich = f as RichAuditFinding;

    const profileData: FindingProfileData = {
      id:                   rich.id,
      title:                rich.title,
      severity:             rich.severity,
      status:               rich.status,
      subDivision:           rich.subDivision,
      scope:                rich.scope,
      subscope:             rich.subscope,
      taskId:               rich.taskId,
      company:              rich.company,
      division:               rich.division,
      risk:                 rich.risk,
      dueDate:              rich.dueDate,
      createdAt:            rich.createdAt,
      owner:                rich.owner,
      description:          rich.description,
      observationIds:       rich.observationIds,
      documents:            rich.documents,
      financialImpact:      rich.financialImpact,
      isRepeated:           rich.isRepeated,
      flaggedForEscalation: rich.flaggedForEscalation,
      daysOverdue:          rich.daysOverdue,
    };

    this.drawer.open<FindingProfileComponent, FindingProfileData>(
      FindingProfileComponent,
      { width: '760px', data: profileData },
    );

    this.viewFinding.emit(f);
  }

  viewPreviousOccurrence(f: AuditFinding): void { this.viewPrevOccurrence.emit(f); }
  onExportPdf(): void                           { this.exportPdf.emit(); }
  onExportExcel(): void                         { this.exportExcel.emit(); }

  /** Next sequential FND-### id based on the highest one currently in the list. */
  private nextFindingId(): string {
    const max = this._findings().reduce((m, f) => {
      const n = parseInt(f.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return `FND-${(max + 1).toString().padStart(3, '0')}`;
  }

  async onAddFinding(): Promise<void> {
    const ref = this.drawer.open<AddFindingResult, AddFindingDrawerData>(
      AddFindingComponent,
      { width: '720px', data: { mode: 'create' } },
    );
    const result = await ref.afterClosed;
    if (!result) return;

    const f = result.form;
    const newFinding: RichAuditFinding = {
      id: this.nextFindingId(),
      title: f.title,
      subDivision: f.subdivision ?? '',
      severity: (f.severity as FindingSeverity) ?? 'low',
      // No Status control exists in this form — every submission defaults
      // to 'Open'. New findings start as 'open'; see onEditFinding for why
      // status is never overwritten there.
      status: 'open' as FindingStatus,
      dueDate: f.dueDate ?? new Date(),
      daysOverdue: undefined,
      flaggedForEscalation: false,
      isRepeated: false,
      previousOccurrenceId: undefined,
      financialImpact: 0,
      owner: { fullName: 'Athul Manoj', avatarUrl: '', id: 'current-user' },
      company: f.company,
      division: f.division,
      scope: f.scope,
      subscope: f.subscope,
      taskId: f.taskId,
      risk: RISK_LABELS[f.risk ?? ''] ?? f.risk,
      createdAt: new Date(),
      description: f.description,
      observationIds: f.observationIds ?? [],
      documents: (f.documents ?? []).map(file => ({ name: file.name, size: file.size })),
    };

    // New entries appear first so they're immediately visible.
    this._findings.update(list => [newFinding, ...list]);
    this.currentPage.set(1);
    this.addFinding.emit();
  }

  async onEditFinding(f: AuditFinding): Promise<void> {
    const rich = f as RichAuditFinding;
    const ref = this.drawer.open<AddFindingResult, AddFindingDrawerData>(
      AddFindingComponent,
      {
        width: '720px',
        data: {
          mode: 'edit',
          // company/branch/department (Company/Division/Sub-Division) are
          // listed before scope/subscope/taskId here on purpose:
          // AddFindingComponent's FormGroup.patchValue() applies each key
          // of this object in the object's own property order, and its
          // cascade-reset subscriptions (company change clears
          // branch/department/scope/subscope i.e. Division/Sub-Division/
          // Scope/Sub-scope, department change clears scope/subscope,
          // etc.) fire as each key is patched. Listing a dependency after
          // its dependent field would let the reset fire *after* the real
          // value was set, silently blanking it — same bug already fixed
          // once for evidence-list.component.ts's openEdit().
          existing: {
            id:             f.id,
            company:        rich.company ?? '',
            division:         rich.division ?? '',
            subdivision:     f.subDivision ?? '',
            scope:          rich.scope ?? '',
            subscope:       rich.subscope ?? '',
            taskId:         rich.taskId ?? '',
            title:          f.title,
            severity:       f.severity,
            status:         f.status as any,
            dueDate:        f.dueDate,
            risk:           RISK_VALUES[rich.risk ?? ''] ?? '',
            observationIds: rich.observationIds ?? [],
            description:    rich.description ?? '',
          },
        },
      },
    );
    const result = await ref.afterClosed;
    if (!result) return;

    const r = result.form;
    this._findings.update(list =>
      list.map(item => item.id !== f.id ? item : {
        ...item,
        title: r.title,
        severity: (r.severity as FindingSeverity) ?? item.severity,
        subDivision: r.subdivision === null ? '' : (r.subdivision ?? item.subDivision),
        scope: r.scope ?? item.scope,
        subscope: r.subscope ?? item.subscope,
        taskId: r.taskId ?? item.taskId,
        risk: RISK_LABELS[r.risk ?? ''] ?? item.risk,
        company: r.company ?? item.company,
        division: r.division ?? item.division,
        description: r.description,
        observationIds: r.observationIds ?? item.observationIds,
        // status intentionally left untouched: the form has no Status
        // control, so every submission defaults to 'Open' — applying it
        // here would silently reset every edited finding back to Open.
      }),
    );

    this.editFinding.emit({
      finding: f,
      existing: {
        id:         f.id,
        title:      r.title,
        severity:   r.severity,
        subDivision: r.subdivision === null ? '' : (r.subdivision ?? f.subDivision),
        status:     f.status,
        dueDate:    f.dueDate,
      },
    });
  }

  isActive(id: string): boolean {
    return !this.deactivatedIds().has(id);
  }

  onToggleActive(f: AuditFinding): void {
    this.confirmPending.set({
      finding: f,
      action:  this.isActive(f.id) ? 'deactivate' : 'activate',
    });
  }

  confirmToggle(): void {
    const pending = this.confirmPending();
    if (!pending) return;
    const { finding, action } = pending;
    const current = new Set(this.deactivatedIds());
    if (action === 'deactivate') {
      current.add(finding.id);
    } else {
      current.delete(finding.id);
    }
    this.deactivatedIds.set(current);
    this.toggleActive.emit({ finding, active: action === 'activate' });
    this.confirmPending.set(null);
  }

  cancelToggle(): void {
    this.confirmPending.set(null);
  }

  /* ── Display helpers ─────────────────────────────────────── */
  severityLabel(s: FindingSeverity): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  statusLabel(s: FindingStatus): string {
    return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  initials(name: string): string {
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  severityColor(s: FindingSeverity): string {
    return ({ critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#94a3b8' })[s];
  }

  trackById = (_: number, f: AuditFinding) => f.id;
}