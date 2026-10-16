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
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { Popover, PopoverModule } from 'primeng/popover';
import { ActivatedRoute } from '@angular/router';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { AuditPlanViewComponent } from '../audit-plan-view/audit-plan-view.component';
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import {
  AuditPlan,
  AuditPlanStatus,
  MOCK_PLANS,
  periodLabel as getPeriodLabel,
  planTitle as getPlanTitle,
  planYear as getPlanYear,
  planHasAuditor,
} from '@/app/features/audits/audit-plan/audit-plan/audit-plan-data';

// ── CLIENT_MODE-aware Organization/Division/Sub-Division option sources ────────
// Same switch every *-data.service.ts already makes off CLIENT_MODE_VALUE
// (see client-mode.ts): audit-firm builds keep reading the existing
// multi-company ORG_STATIC_DATA roster for all three filters, while
// internal-audit builds (single company auditing itself) read Organization
// names from the company seed, Division names from the division seed, and
// Sub-Division names from the sub-division seed — each is its own file because
// each one trims/keeps a different subset of the full roster (see the header
// comments in those three files).
//
// NOTE: adjust these three import paths (and the client-mode import) if they
// don't sit next to this component the same way `company-org-data` does —
// same caveat audit-plan-data.ts already calls out for its own import.
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';
import { COMPANIES_SEED } from '@/app/features/audits/organization/company/company-static-indi-org.data';
import { DIVISION_INDI_ORG_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-indi-org.data';
import { SUB_DIVISION_INDI_ORG_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-indi-org.data';

// Re-export the model types from here too: other files in the app (e.g.
// AuditPlanViewComponent, which this component opens with `data: p`) very
// likely import `AuditPlan`/`Sub-Division`/`AuditScope`/etc. from
// './audit-plan-list.component' the way this file used to define them
// locally. Keeping these re-exports means moving the model into
// `audit-plan-data.ts` doesn't break those imports.
export type {
  AuditPlan,
  AuditPlanStatus,
  RiskRating,
  InstanceStatus,
  Frequency,
  ScopeJob,
  AuditScope,
  SubDivision
} from '@/app/features/audits/audit-plan/audit-plan/audit-plan-data';
export { FREQ_LABELS, MONTH_LABELS } from '@/app/features/audits/audit-plan/audit-plan/audit-plan-data';

// Shared Company → Division → Sub-Division static data — the same file every
// other Company/Division/Sub-Division filter in the app now reads from. The
// Company/Division/Sub-Division filter option lists below used to be *derived*
// from whatever values happened to be present on MOCK_PLANS itself (fake
// names like "Crowe UAE" / "Crowe KSA" / "Crowe Qatar" / "Crowe Oman" with
// divisions "Dubai" / "Riyadh" / "Doha" / "Muscat" / "Sharjah" / "Jeddah" /
// "Abu Dhabi", and sub-division names like "Finance / Accounts", "AML / CFT
// Compliance", "IT", "HR", "Risk", "Procurement" — none of which exist
// anywhere in company-org-data.ts). Options now come from the real roster,
// cascading Division off selectedOrganizations() and Sub-Division off
// selectedOrganizations() + selectedDivisions(), same pattern as every other
// filter panel in the app. MOCK_PLANS' organizationName/divisionName/
// sub-division names below have also been remapped to real triples so the
// filters actually match rows.
//
// The plan model (types), MOCK_PLANS data, and the planYear/planTitle/
// periodLabel helpers now live in `audit-plan-data.ts` — shared with
// `audit-overview.component.ts` so the dashboard's KPIs and charts are
// always computed from these exact same rows instead of a second,
// independently-hardcoded dataset. `planHasAuditor` (used below to scope
// the list to a single auditor, e.g. from the overview's "My Active
// Audits" KPI card) lives there too, for the same reason.
//
// The auditor-aggregation helpers just below (countActivePlansForAuditor,
// getActivePlansForAuditor, getAllPlansForAuditor) stayed here rather than
// moving to audit-plan-data.ts — auditor-overview.ts and
// auditor-my-audits-scopes.ts both import them from this component file,
// so they need to keep being exported from here.

/** Deterministic (id-seeded) illustrative progress percentage, since plans don't carry a real % field. */
function progressForPlan(p: AuditPlan): number {
  const seed = p.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return 30 + (seed % 60); // 30–89%
}

/** Count of in-progress plans assigned to the given auditor — used by the auditor overview KPI card. */
export function countActivePlansForAuditor(auditorName: string): number {
  return MOCK_PLANS.filter(p => p.status === 'in_progress' && planHasAuditor(p, auditorName)).length;
}

/**
 * The auditor's in-progress plans, as {name, progress} — same scope as
 * countActivePlansForAuditor() above. Used by the auditor overview's
 * "Audit Progress" widget, so it always lists exactly the plans counted
 * by the "My Active Audits" KPI card.
 */
export function getActivePlansForAuditor(auditorName: string): { name: string; progress: number }[] {
  return MOCK_PLANS
    .filter(p => p.status === 'in_progress' && planHasAuditor(p, auditorName))
    .map(p => ({
      name: p.subDivisions[0]?.scopes[0]?.name ?? `${p.organizationName} — ${p.divisionName}`,
      progress: progressForPlan(p),
    }));
}

/** Display status label for a plan, aligned to the vocabulary the auditor-dashboard tabs use elsewhere. */
const PLAN_STATUS_LABELS: Record<AuditPlanStatus, string> = {
  draft: 'Not Started',
  planned: 'Not Started',
  in_progress: 'In Progress',
  overdue: 'Overdue',
  completed: 'Completed',
  on_hold: 'Pending',
  cancelled: 'Cancelled',
};

const PLAN_PHASE_LABELS: Record<AuditPlanStatus, string> = {
  draft: 'Planning',
  planned: 'Planning',
  in_progress: 'Fieldwork',
  overdue: 'Fieldwork',
  completed: 'Reporting',
  on_hold: 'Fieldwork',
  cancelled: 'Cancelled',
};

function progressForPlanStatus(p: AuditPlan): number {
  if (p.status === 'completed') return 100;
  if (p.status === 'draft' || p.status === 'planned' || p.status === 'cancelled') return 0;
  return progressForPlan(p);
}

function formatPlanDate(d?: Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export interface AuditorPlanRow {
  audit: string;
  subDivision: string;
  phase: string;
  progress: number;
  dueDate: string;
  status: string;
}

/**
 * Every plan (any status) assigned to the given auditor — used by the
 * auditor dashboard's "My Assigned Audits" table.
 */
export function getAllPlansForAuditor(auditorName: string): AuditorPlanRow[] {
  return MOCK_PLANS
    .filter(p => planHasAuditor(p, auditorName))
    .map(p => ({
      audit: p.subDivisions[0]?.scopes[0]?.name ?? `${p.organizationName} — ${p.divisionName}`,
      subDivision: p.subDivisions[0] && !p.subDivisions[0].isDivisionLevel ? p.subDivisions[0].name : '—',
      phase: PLAN_PHASE_LABELS[p.status],
      progress: progressForPlanStatus(p),
      dueDate: formatPlanDate(p.endDate),
      status: PLAN_STATUS_LABELS[p.status],
    }));
}

type SortColumn = 'organizationName' | 'divisionName';
type SortDir = 'asc' | 'desc';

/**
 * Minimal shape the Division/Sub-Division filter-option computeds actually need,
 * independent of which per-mode seed supplies the data. `divisionSourceCompanies()`
 * and `subDivisionSourceCompanies()` below pick between two structurally-similar
 * but nominally distinct company/division/sub-division type hierarchies — the
 * multi-company `ORG_STATIC_DATA` roster (Company/OrgDivision/OrgSubDivision from
 * company-org-data.ts) vs. the single-company indi-org seeds (StaticCompany/
 * StaticDivision/StaticSubDivision). Left untyped, TS infers those methods'
 * return type as a union of the two concrete array types (e.g.
 * `StaticDivision[] | OrgDivision[]`), and calling `.filter()`/`.flatMap()` on
 * that union breaks down (TS2322/TS18046) because the two element types
 * disagree on unrelated fields like `subDivisionType`. Declaring the return
 * type as this narrower common shape sidesteps that: both concrete arrays
 * are structurally assignable to it since assigning a variable (not an
 * object literal) skips excess-property checks.
 */
interface FilterSourceSubDivision {
  subDivisionName: string;
}
interface FilterSourceDivision {
  divisionName: string;
  hasSubDivision?: boolean;
  subDivisions: FilterSourceSubDivision[];
}
interface FilterSourceCompany {
  companyName: string;
  divisions: FilterSourceDivision[];
}

/* ── Component ──────────────────────────────────────────────────────────── */

@Component({
  selector: 'app-audit-plan-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    MultiSelectModule,
    PaginatorModule,
    TooltipModule,
    TagModule,
    PopoverModule,DrawIconComponent
  ],
  templateUrl: './audit-plan-list.component.html',
  styleUrl: './audit-plan-list.component.scss',
})
export class AuditPlanListComponent implements OnInit {
  @ViewChild('filterPanel') filterPanel!: Popover;
  @ViewChild('subDivisionsPopover') subDivisionsPopover!: Popover;

  private readonly drawer = inject(RightDrawerService);
  private readonly route  = inject(ActivatedRoute);

  /* ── Data ── */
  readonly plans = signal<AuditPlan[]>(MOCK_PLANS);

  /* ── View mode ── */
  readonly viewMode = signal<'list' | 'grid'>('grid');

  /* ── Filters ── */
  readonly searchQuery         = signal('');
  readonly selectedOrganizations = signal<string[]>([]);
  readonly selectedDivisions      = signal<string[]>([]);
  readonly selectedSubDivisions   = signal<string[]>([]);
  readonly selectedStatuses      = signal<AuditPlanStatus[]>([]);
  readonly selectedYears         = signal<number[]>([]);

  /** Scope to a specific auditor (from the overview "My Active Audits" card) — matches display name. */
  readonly auditorId = signal<string | null>(null);

  /* ── Sort ── */
  readonly sortColumn    = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDir>('asc');

  /* ── Pagination ── */
  readonly pageSize    = 8;
  readonly currentPage = signal(1);

  /* ── Popovers ── */
  readonly moreSubDivisionsPlan = signal<AuditPlan | null>(null);

  /* ── Filter options ── */
  readonly statusOptions: { label: string; value: AuditPlanStatus }[] = [
    { label: 'Draft',       value: 'draft'       },
    { label: 'Planned',     value: 'planned'     },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Overdue',     value: 'overdue'     },
    { label: 'Completed',   value: 'completed'   },
    { label: 'On Hold',     value: 'on_hold'     },
    { label: 'Cancelled',   value: 'cancelled'   },
  ];

  /**
   * Division/Sub-Division cascading source, switched by CLIENT_MODE_VALUE —
   * 'internal-audit' builds cascade off the division/sub-division indi-org seeds
   * (single company, DAR Exchange) instead of the multi-company
   * ORG_STATIC_DATA roster. Only the *name* lookups switch here; MOCK_PLANS
   * rows and everything else about the list are unaffected.
   */
  private divisionSourceCompanies(): FilterSourceCompany[] {
    return CLIENT_MODE_VALUE === 'internal-audit' ? DIVISION_INDI_ORG_COMPANIES : ORG_STATIC_DATA;
  }

  private subDivisionSourceCompanies(): FilterSourceCompany[] {
    return CLIENT_MODE_VALUE === 'internal-audit' ? SUB_DIVISION_INDI_ORG_COMPANIES : ORG_STATIC_DATA;
  }

  /** Sourced from company-org-data.ts (see import comment above) — replacing
   *  the previous "derive from whatever's on MOCK_PLANS" approach, which
   *  only ever showed companies that already had a mock row.
   *
   *  In 'internal-audit' mode, Organization names instead come from
   *  COMPANIES_SEED (company-static-indi-org.data.ts) — the single-company
   *  seed used by CompanyDataService for that client mode. */
  readonly organizationFilterOptions = computed<{ label: string; value: string }[]>(() => {
    const names = CLIENT_MODE_VALUE === 'internal-audit'
      ? COMPANIES_SEED.map(c => c.companyName)
      : ORG_STATIC_DATA.map(c => c.companyName);
    return names
      .map(label => ({ label, value: label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly divisionFilterOptions = computed<{ label: string; value: string }[]>(() => {
    const orgs = this.selectedOrganizations();
    const source = this.divisionSourceCompanies();
    const companies = orgs.length
      ? source.filter(c => orgs.includes(c.companyName))
      : source;
    const names = new Set(companies.flatMap(c => c.divisions).map(b => b.divisionName));
    return [...names].sort().map(v => ({ label: v, value: v }));
  });

  readonly subDivisionFilterOptions = computed<{ label: string; value: string }[]>(() => {
    const orgs      = this.selectedOrganizations();
    const divisions  = this.selectedDivisions();
    const source    = this.subDivisionSourceCompanies();
    const companies = orgs.length
      ? source.filter(c => orgs.includes(c.companyName))
      : source;
    // Divisions flagged hasSubDivision:false still carry a subDivisions array
    // in the seed data, so skip them explicitly.
    const divisionList = companies.flatMap(c => c.divisions)
      .filter(b => b.hasSubDivision !== false)
      .filter(b => !divisions.length || divisions.includes(b.divisionName));
    const names = new Set(divisionList.flatMap(b => b.subDivisions).map(d => d.subDivisionName));
    return [...names].sort().map(v => ({ label: v, value: v }));
  });

  /** Linked Sub-Division filter is hidden only when every selected Division
   *  (looked up in the same source the Division options use) is flagged
   *  hasSubDivision:false. Unknown divisions count as having sub-divisions. */
  readonly subDivisionFilterVisible = computed<boolean>(() => {
    const divisions = this.selectedDivisions();
    if (!divisions.length) return true;
    const orgs      = this.selectedOrganizations();
    const source    = this.divisionSourceCompanies();
    const companies = orgs.length
      ? source.filter(c => orgs.includes(c.companyName))
      : source;
    const divisionList = companies.flatMap(c => c.divisions);
    return divisions.some(name => {
      const matches = divisionList.filter(b => b.divisionName === name);
      return !matches.length || matches.some(b => b.hasSubDivision !== false);
    });
  });

  readonly yearFilterOptions = computed(() => {
    const set = new Set(this.plans().map(p => this.planYear(p)));
    return Array.from(set).sort((a, b) => b - a).map(v => ({ label: String(v), value: v }));
  });

  /* ── Active filter count & chips ── */
  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedOrganizations().length) count++;
    if (this.selectedDivisions().length)      count++;
    if (this.selectedSubDivisions().length)   count++;
    if (this.selectedStatuses().length)      count++;
    if (this.selectedYears().length)         count++;
    return count;
  });

  readonly activeFilterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.selectedOrganizations().length)
      chips.push({ key: 'organizations', label: `Company: ${this.selectedOrganizations().length}` });
    if (this.selectedDivisions().length)
      chips.push({ key: 'divisions',      label: `Division: ${this.selectedDivisions().length}` });
    if (this.selectedSubDivisions().length)
      chips.push({ key: 'subDivisions',   label: `Sub-Division: ${this.selectedSubDivisions().length}` });
    if (this.selectedStatuses().length)
      chips.push({ key: 'statuses',      label: `Status: ${this.selectedStatuses().length}` });
    if (this.selectedYears().length)
      chips.push({ key: 'years',         label: `Year: ${this.selectedYears().length}` });
    return chips;
  });

  removeFilter(key: string): void {
    switch (key) {
      case 'organizations': this.selectedOrganizations.set([]); this.selectedDivisions.set([]); this.selectedSubDivisions.set([]); break;
      case 'divisions':      this.selectedDivisions.set([]);      this.selectedSubDivisions.set([]); break;
      case 'subDivisions':   this.selectedSubDivisions.set([]);   break;
      case 'statuses':      this.selectedStatuses.set([]);      break;
      case 'years':         this.selectedYears.set([]);         break;
    }
    this.currentPage.set(1);
  }

  /* ── Derived: filtered + sorted list ── */
  readonly filtered = computed(() => {
    let list = this.plans();

    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.id.toLowerCase().includes(q) ||
      p.organizationName.toLowerCase().includes(q) ||
      p.divisionName.toLowerCase().includes(q) ||
      p.subDivisions.some(d => d.name.toLowerCase().includes(q)) ||
      this.planTitle(p).toLowerCase().includes(q),
    );

    const orgs = this.selectedOrganizations();
    if (orgs.length) list = list.filter(p => orgs.includes(p.organizationName));

    const divisions = this.selectedDivisions();
    if (divisions.length) list = list.filter(p => divisions.includes(p.divisionName));

    // Ignored while the Sub-Division filter is hidden so a stale selection can't apply.
    const subDivisions = this.subDivisionFilterVisible() ? this.selectedSubDivisions() : [];
    // Division-level lanes carry the division's name, so they must not match a sub-division of the same name.
    if (subDivisions.length) list = list.filter(p => p.subDivisions.some(d => !d.isDivisionLevel && subDivisions.includes(d.name)));

    const statuses = this.selectedStatuses();
    if (statuses.length) list = list.filter(p => statuses.includes(p.status));

    const years = this.selectedYears();
    if (years.length) list = list.filter(p => years.includes(this.planYear(p)));

    const auditorId = this.auditorId();
    if (auditorId) list = list.filter(p => planHasAuditor(p, auditorId));

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
    const max  = Math.max(1, Math.ceil(all.length / this.pageSize));
    const page = Math.min(this.currentPage(), max);
    return all.slice((page - 1) * this.pageSize, page * this.pageSize);
  });

  readonly pageRangeLabel = computed(() => {
    const total = this.filtered().length;
    if (!total) return 'No results';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end   = Math.min(start + this.pageSize - 1, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  readonly hasActiveFilters = computed(() =>
    !!this.searchQuery().trim() ||
    !!this.selectedOrganizations().length ||
    !!this.selectedDivisions().length ||
    !!this.selectedSubDivisions().length ||
    !!this.selectedStatuses().length ||
    !!this.selectedYears().length,
  );

  ngOnInit(): void {
    /* load from service here */

    /* Apply status filter passed via query param (e.g. from the overview KPI cards). */
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status && this.statusOptions.some(o => o.value === status)) {
      this.selectedStatuses.set([status as AuditPlanStatus]);
    }

    /* Apply auditor filter passed via query param (e.g. from the overview "My Active Audits" card). */
    this.auditorId.set(this.route.snapshot.queryParamMap.get('auditorId'));
  }

  /* ── Filter handlers ── */
  onSearchChange(q: string)          { this.searchQuery.set(q);                 this.currentPage.set(1); }
  onOrganizationsChange(v: string[]) { this.selectedOrganizations.set(v ?? []); this.selectedDivisions.set([]); this.selectedSubDivisions.set([]); this.currentPage.set(1); }
  onDivisionsChange(v: string[])      { this.selectedDivisions.set(v ?? []);      this.selectedSubDivisions.set([]); this.currentPage.set(1); }
  onSubDivisionsChange(v: string[])   { this.selectedSubDivisions.set(v ?? []);   this.currentPage.set(1); }
  onStatusesChange(v: AuditPlanStatus[]) { this.selectedStatuses.set(v ?? []);  this.currentPage.set(1); }
  onYearsChange(v: number[])         { this.selectedYears.set(v ?? []);         this.currentPage.set(1); }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedOrganizations.set([]);
    this.selectedDivisions.set([]);
    this.selectedSubDivisions.set([]);
    this.selectedStatuses.set([]);
    this.selectedYears.set([]);
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
  private sortValue(p: AuditPlan, col: SortColumn): string | number {
    switch (col) {
      case 'organizationName': return p.organizationName.toLowerCase();
      case 'divisionName':       return p.divisionName.toLowerCase();
    }
  }

  /* ── Title / year / period helpers — delegate to the shared data module so
   *    the list and the dashboard always compute these identically. ── */
  planYear(p: AuditPlan): number {
    return getPlanYear(p);
  }

  planTitle(p: AuditPlan): string {
    return getPlanTitle(p);
  }

  periodLabel(p: AuditPlan): string {
    return getPeriodLabel(p);
  }

  /* ── Pagination ── */
  onPageChange(ev: PaginatorState): void {
    if (ev.page !== undefined) this.currentPage.set(ev.page + 1);
  }

  setViewMode(m: 'list' | 'grid'): void { this.viewMode.set(m); }

  /* ── Actions ── */
  openView(p: AuditPlan): void {
    this.drawer.open(AuditPlanViewComponent, { data: p, width: '720px' });
  }

  /* ── Popovers ── */
  showMoreSubDivisions(p: AuditPlan, event: MouseEvent): void {
    this.moreSubDivisionsPlan.set(p);
    this.subDivisionsPopover.toggle(event);
  }

  trackById = (_: number, p: AuditPlan) => p.id;
}