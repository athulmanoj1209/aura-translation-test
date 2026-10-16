import { Component, DestroyRef, Input, OnInit, OnChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { ScopeProfileComponent, ScopeProfileDrawerData } from '@/app/features/client/audit-scope-summary/scope-profile/scope-profile.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';

// Real, live scope data — same in-memory store the Admin's Audit Scope Management page reads
// and writes (via upsertStaticScope()/editStaticScope()) — pooled here across all 8 client
// companies (per the CFO-view scoping decision made when this data source was wired in).
// `ScopeStatus` below is audit-scope-management's own workflow-status type — NOT the unrelated,
// same-named `ScopeStatus` exported by '@/app/shared/models/client-dashboard.model' (a completely different
// vocabulary: 'On track' | 'In progress' | 'At risk' | ...). Importing it from that other module
// is what caused the "'Not Started' does not exist... did you mean 'Not started'?" build error —
// if an IDE auto-import "fix" ever redirects this back to '@/app/shared/models/client-dashboard.model', that
// error will return.
import type { StaticScope, ScopeStatus } from '@/app/features/audits/audit-plan/audit-scope-management/models/audit-scope.model';
import { AUDIT_SCOPE_STATIC_COMPANIES, getAllStaticScopes } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data';
import { ScopeType } from '@/app/features/audits/organization/company/company-org-data';


// Local alias, kept separate from the plain re-exported `ScopeStatus` import above (rather than
// `import { ScopeStatus as StaticWorkflowStatus }`) purely for readability at the usage site
// below — some bundler/type-checker setups are pickier about aliasing a type-only import inline.
type StaticWorkflowStatus = ScopeStatus;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientRole = 'cfo' | 'sub-division-head';

/** One card in the summary row — data-driven so the row can gain/lose/reorder cards from a
 *  single array instead of duplicating a template block per card. */
export interface ScopeSummaryCard {
  key: 'total' | 'inprogress' | 'notstarted' | 'overdue' | 'completed';
  label: string;
  value: number;
  icon: string;
}

/**
 * This dashboard's own display status vocabulary. Additively expanded (not replaced) from the
 * original 3 values to also cover the real data's 'planned'/'overdue' workflow states — see
 * WORKFLOW_STATUS_MAP below for how auditscopestaticdata.ts's `ScopeStatus` ('Not Started' |
 * 'Planned' | 'In Progress' | 'Overdue' | 'Completed') maps onto this lowercase-hyphen form.
 */
export type ClientScopeStatus = 'not-started' | 'planned' | 'in-progress' | 'overdue' | 'completed';

export interface ClientScope {
  id: string;
  scopeName: string;
  scopeLevel: 'scope' | 'subscope';           // maps to admin's scopeType being a parent or child
  scopeType: 'departmental' | 'functional' | 'independent';
  division?: string;                            // real divisionCode, e.g. 'ANJ-DXB-01' — not required for sub-scopes
  divisionName?: string;                        // display name of `division`, e.g. 'Dubai Division'
  /** The sub-division the scope sits under; null for a division-level scope (sits directly under its division). */
  subDivisionName?: string | null;
  linkedSubDivisions: string[];                 // real sub-division names, e.g. ['Finance & Accounts']
  auditFrequency: string;
  modeOfAudit: string;
  startDate: Date | string;
  endDate: Date | string;
  assignedAuditors: string[];
  objective?: string;
  budget?: string;
  estimatedHours?: number;
  hourlyRate?: number;
  riskRating?: 'low' | 'medium' | 'high' | null;
  parentScopeName?: string;                     // populated for sub-scopes
  subScopeCount?: number;                       // populated for parent scopes
  status: ClientScopeStatus;
  progressPercent?: number;
  openRfiCount?: number;
  totalRfiCount?: number;

}

/**
 * auditscopestaticdata.ts's real workflowStatus vocabulary → this page's display vocabulary.
 * The scope-approval states ('Pending Review'/'Approved'/'Rejected', written by the approval-
 * requests workflow via setScopeWorkflowStatus()) don't have their own client-facing display
 * status here — they fold onto the closest existing one: 'Pending Review' reads as still active
 * work ('in-progress'), 'Approved' as finalized ('completed'), and 'Rejected' as needing to
 * restart ('not-started').
 */
const WORKFLOW_STATUS_MAP: Record<StaticWorkflowStatus, ClientScopeStatus> = {
  'Not Started': 'not-started',
  Planned: 'planned',
  'In Progress': 'in-progress',
  Overdue: 'overdue',
  Completed: 'completed',
  'Pending Review': 'in-progress',
  Approved: 'completed',
  Rejected: 'not-started',
};

/**
 * Maps one real record from auditscopestaticdata.ts onto this component's own ClientScope
 * shape, which the rest of this file (and its template) is built around. `scopeLevel` is
 * derived from `parentScopeId` (the real data doesn't have a separate scopeLevel field);
 * `workflowStatus` (the progress state) — not `status` (which is really the real data's
 * active/inactive Activate-Deactivate flag, a different axis entirely, filtered out before
 * this mapping runs — see loadScopes() below) — drives `status` via WORKFLOW_STATUS_MAP.
 * `budget` is derived from estimatedHours × hourlyRate since the real data doesn't carry a
 * pre-formatted budget string (this page doesn't currently render it either way).
 */
/** A scope's division display name, looked up from the same scope directory by company + code. */
function divisionNameFor(company: string, divisionCode: string): string | undefined {
  return AUDIT_SCOPE_STATIC_COMPANIES
    .find(c => c.id === company)?.divisions
    .find(d => d.divisionCode === divisionCode)?.divisionName;
}

function toClientScope(s: StaticScope): ClientScope {
  return {
    id: s.id,
    scopeName: s.scopeName,
    scopeLevel: s.parentScopeId === null ? 'scope' : 'subscope',
    scopeType: s.scopeType as ScopeType,
    division: s.divisionCode,
    divisionName: divisionNameFor(s.company, s.divisionCode),
    subDivisionName: s.subDivisionName,
    linkedSubDivisions: s.linkedSubDivisions,
    auditFrequency: s.auditFrequency,
    modeOfAudit: s.modeOfAudit,
    startDate: s.startDate,
    endDate: s.endDate,
    assignedAuditors: s.assignedAuditors,
    objective: s.objective,
    budget: s.estimatedHours && s.hourlyRate ? `$${(s.estimatedHours * s.hourlyRate).toLocaleString()}` : undefined,
    estimatedHours: s.estimatedHours ?? undefined,
    hourlyRate: s.hourlyRate ?? undefined,
    riskRating: s.riskRating ?? null,
    status: WORKFLOW_STATUS_MAP[s.workflowStatus ?? 'Not Started'],
  };
}

/**
 * Loads every scope/sub-scope live from auditscopestaticdata.ts, mapped to this component's
 * own ClientScope shape via toClientScope(). Deactivated records (`status: 'inactive'` — the
 * Admin's Activate/Deactivate flag, unrelated to workflow progress) are excluded: a scope the
 * auditor has deactivated is treated as withdrawn from the client-facing summary entirely
 * (unlike the RFI side, which still shows a deactivated RFI to the client but blocks
 * interaction — happy to switch this to the same "shown but blocked" pattern if that's
 * preferred here too).
 *
 * Exported (not just used internally) so other pages — e.g. the client dashboard's Scope tab
 * — can pull the identical, live data instead of keeping their own separately-typed-in copy
 * that can drift out of sync. Swap the body of this function, not the import above, when this
 * becomes a real API call (e.g. `return this.scopeService.getScopesForClient(...)`).
 */
export function getAllClientScopes(): ClientScope[] {
  return getAllStaticScopes()
    .filter((s) => s.status === 'active')
    .map(toClientScope);
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-client-scope-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    PaginationBarComponent,DrawIconComponent
  ],
  templateUrl: './audit-scope-summary.component.html',
  styleUrl: './audit-scope-summary.component.scss',
})
export class AuditScopeSummaryComponent implements OnInit, OnChanges {
private readonly drawer = inject(RightDrawerService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  /**
   * 'cfo'                 → sees all scopes, full filter bar
   * 'sub-division-head'   → auto-filtered to their sub-division, no sub-division filter shown
   *
   * This is only the INITIAL value. Because this component is now surfaced
   * from a single menu item and needs to show both perspectives, the actual
   * view is driven by `activeRole` below, which the user can flip with the
   * on-screen "Viewing as" toggle.
   */
  @Input() role: ClientRole = 'cfo';

  /**
   * For sub-division-head role: which sub-division this user belongs to.
   * Must match values in linkedSubDivisions (real sub-division names, e.g. 'Finance & Accounts').
   * Used as the initial value for `selectedSubDivisionForView` below.
   */
  @Input() userSubDivision: string = '';

  /** Emitted when user clicks View on a scope card */
  @Input() onViewScope?: (scope: ClientScope) => void;

  // ── Role toggle (Admin / Sub-Division Head) ─────────────────────────────
  /** The role actually driving the current view — flipped via the toggle. */
  activeRole: ClientRole = 'cfo';

  /** Sub-division being "viewed as" when activeRole is 'sub-division-head'. */
  selectedSubDivisionForView: string = '';

  // ── View mode ────────────────────────────────────────────────────────────
  viewMode: 'grid' | 'list' = 'grid';

  // ── Filter state ────────────────────────────────────────────────────────
  searchQuery = '';
  filterDivision: string | null = null;
  filterSubDivision: string | null = null;
  filterStatus: string | null = null;
  filterRisk: string | null = null;
  filterFrequency:string | null=null;

  allScopes: ClientScope[] = [];
  filteredScopes: ClientScope[] = [];

  // ── Pagination ──────────────────────────────────────────────────────────
  // Same <app-pagination-bar> pattern used on the Companies page: 1-based currentPage/pageSize
  // state here, sliced into pagedScopes below; the bar itself works in 0-based pages, converted
  // at the template binding / onPageChange() below.
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions: number[] = [10, 25, 50, 100];

  // ── Option lists ────────────────────────────────────────────────────────
  // Derived live from AUDIT_SCOPE_STATIC_COMPANIES (pooled across all 8 companies, per the
  // CFO-view scoping decision) instead of a hand-typed list — division names repeat across
  // companies (every company has a "Dubai Division"/"Abu Dhabi Division"/"Sharjah Division"), so each
  // option is labelled with its company name to stay unambiguous; `value` stays the real,
  // globally-unique divisionCode (e.g. 'ANJ-DXB-01') that ClientScope.division actually holds.
  readonly divisionOptions = AUDIT_SCOPE_STATIC_COMPANIES.flatMap((c) =>
    c.divisions.map((b) => ({ label: `${c.companyName} – ${b.divisionName}`, value: b.divisionCode })),
  );

  get filteredSubDivisionOptions(): { label: string; value: string }[] {
    if (!this.filterDivision) return [];
    for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
      const division = company.divisions.find((b) => b.divisionCode === this.filterDivision);
      if (division) return division.subDivisions.map((d) => ({ label: d.subDivisionName, value: d.subDivisionName }));
    }
    return [];
  }

  get isSubDivisionFilterEnabled(): boolean {
    return !!this.filterDivision;
  }

  readonly statusOptions = [
    { label: 'Not Started', value: 'not-started' },
    { label: 'Planned', value: 'planned' },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Completed', value: 'completed' },
  ];

  readonly frequencyOptions = [
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Annually', value: 'annually' },
    { label: 'Monthly', value: 'monthly' },
  ];

  // ── Label maps ──────────────────────────────────────────────────────────
  // Real sub-division names (auditscopestaticdata.ts) are already human-readable, so this is an
  // identity map now rather than a short-code → label lookup — kept as a Record (rather than
  // dropped) so getSubDivisionChips()/pageSubtitle below don't need to change, and so a
  // sub-division can still be relabelled in one place if ever needed. 'Finance & Accounts' is
  // listed first so it becomes viewSubDivisionOptions[0] — the fallback sub-division for the
  // Sub-Division Head persona.
  readonly subDivisionLabels: Record<string, string> = {
    'Finance & Accounts': 'Finance & Accounts',
    'Finance & Accounting': 'Finance & Accounting',
    'Retail Operations': 'Retail Operations',
    'Inventory & Warehouse': 'Inventory & Warehouse',
    'Inventory & Warehousing': 'Inventory & Warehousing',
    'Compliance & AML': 'Compliance & AML',
    'Human Resources': 'Human Resources',
    'IT & Systems': 'IT & Systems',
    'Procurement': 'Procurement',
    'Quality Assurance': 'Quality Assurance',
    'Logistics': 'Logistics',
    'Customer Service': 'Customer Service',
  };

  readonly modeLabels: Record<string, string> = {
    full: 'Full', limited: 'Limited', thematic: 'Thematic',
    'follow-up': 'Follow-up', continuous: 'Continuous',
  };

  // Full real auditor roster (auditscopestaticdata.ts's assignedAuditors ids), matching the
  // names already established on the RFI side for these same ids.
  readonly auditorLabels: Record<string, string> = {
    alice: 'Alice Johnson', bob: 'Bob Smith', carol: 'Carol White', david: 'David Lee',
    emma: 'Emma Clarke', felix: 'Felix Rahman', grace: 'Grace Kim', henry: 'Henry Patel',
    irene: 'Irene Thomas', james: 'James Wilson', karen: 'Karen Osei', liam: 'Liam George',
    mia: 'Mia Fernandes',
  };

  /**
   * Sub-divisions the "viewing as" dropdown lets you pick from in sub-division-head mode.
   * Derived live from AUDIT_SCOPE_STATIC_COMPANIES (like divisionOptions/filteredSubDivisionOptions
   * above) rather than from the hardcoded `subDivisionLabels` map — the real data contains spelling
   * variants across companies (e.g. 'Finance & Accounting' vs 'Finance & Accounts',
   * 'Inventory & Warehouse' vs 'Inventory & Warehousing') that `subDivisionLabels` didn't cover,
   * so picking one of those mismatched values here filtered every scope out in applyFilters().
   */
  get viewSubDivisionOptions(): { label: string; value: string }[] {
    const names = new Set<string>();
    for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
      for (const division of company.divisions) {
        for (const subDivision of division.subDivisions) {
          names.add(subDivision.subDivisionName);
        }
      }
    }
    return Array.from(names)
      .sort()
      .map((name) => ({ label: this.subDivisionLabels[name] ?? name, value: name }));
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Seed the toggle from whatever the host passed in (defaults still work
    // if this component is embedded elsewhere with a fixed role).
    this.activeRole = this.role;
    this.selectedSubDivisionForView = this.userSubDivision || this.viewSubDivisionOptions[0]?.value || '';

    // Subscribed, not a one-time `route.snapshot` read: the dashboard's CFO and Sub-Division
    // Head scope cards both navigate to this SAME route (only role/sub-division/status query
    // params differ), so Angular reuses this component instance across those clicks rather
    // than destroying/recreating it — a one-time snapshot read here would only ever see the
    // params from whichever card was clicked FIRST, silently keeping a stale role/sub-division
    // on every click after that. Subscribing to queryParamMap re-runs this on every such
    // navigation instead (this is the same fix applied to rfi-management-client.ts).
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        // Loaded live on every navigation (not just once, outside this callback) so a scope
        // the Admin activates/deactivates or edits elsewhere is reflected the next time this
        // client-facing page is opened, without a full page reload. Replace with a real API
        // call (this.scopeService.getScopesForClient(role, subDivision)) when this stops being static
        // mock data — getAllClientScopes() itself is the single seam to change.
        this.allScopes = getAllClientScopes();

        const role = params.get('role');
        this.activeRole = role === 'cfo' || role === 'sub-division-head' ? role : this.role;

        const subDivision = params.get('sub-division');
        this.selectedSubDivisionForView = subDivision || (this.userSubDivision || this.viewSubDivisionOptions[0]?.value || '');

        // Pre-apply a status filter passed via query param (e.g. from the dashboard scope
        // stats) — reset it when a fresh navigation doesn't carry one, so a prior visit's
        // filter doesn't linger on this reused instance either.
        const status = params.get('status');
        this.filterStatus = status && this.statusOptions.some((o) => o.value === status) ? status : null;

        this.applyFilters();
      });
  }

  ngOnChanges(): void {
    this.applyFilters();
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get isCfo(): boolean {
    return this.activeRole === 'cfo';
  }

  get pageTitle(): string {
    return this.isCfo ? 'Audit Scope Overview' : 'Your Sub-Division Audit Scopes';
  }

  get pageSubtitle(): string {
    if (this.isCfo) return 'All active audit scopes across the organisation';
    return `Scopes assigned to ${this.subDivisionLabels[this.selectedSubDivisionForView] ?? this.selectedSubDivisionForView}`;
  }

  get totalCount(): number { return this.filteredScopes.length; }
  get inProgressCount(): number { return this.filteredScopes.filter(s => s.status === 'in-progress').length; }
  // 'planned' scopes fold into this roll-up count (per the confirmed decision) while still
  // rendering their own distinct 'Planned' tag/label in the list and grid views below.
  get notStartedCount(): number { return this.filteredScopes.filter(s => s.status === 'not-started' || s.status === 'planned').length; }
  get overdueCount(): number { return this.filteredScopes.filter(s => s.status === 'overdue').length; }
  get completedCount(): number { return this.filteredScopes.filter(s => s.status === 'completed').length; }
  get openRfiTotal(): number { return this.filteredScopes.reduce((n, s) => n + (s.openRfiCount ?? 0), 0); }

  /**
   * Drives the summary row in the template via a single `@for` loop instead of hand-duplicated
   * `<div class="summary-card">` blocks — each card's value is read straight off the getters
   * above (which are themselves derived live from `filteredScopes`), so there's exactly one
   * place to add, remove, or reorder a card. `card.key` supplies both the `-val`/`-icon` CSS
   * suffixes (e.g. `overdue-val`, `overdue-icon` — added alongside this in the SCSS) so no
   * template changes are needed to add a card beyond this array.
   */
  get summaryCards(): ScopeSummaryCard[] {
    return [
      { key: 'total',      label: 'Total Scopes', value: this.totalCount,      icon: 'pi pi-folder-open' },
      { key: 'inprogress', label: 'In Progress',   value: this.inProgressCount, icon: 'pi pi-history' },
      { key: 'notstarted', label: 'Not Started',   value: this.notStartedCount, icon: 'pi pi-clock' },
      { key: 'overdue',    label: 'Overdue',       value: this.overdueCount,    icon: 'pi pi-exclamation-triangle' },
      { key: 'completed',  label: 'Completed',     value: this.completedCount,  icon: 'pi pi-check-circle' },
    ];
  }

  /** The current page's slice of filteredScopes — this, not filteredScopes directly, is what
   *  the list/grid @for loops iterate over. */
  get pagedScopes(): ClientScope[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredScopes.slice(start, start + this.pageSize);
  }

  get activeFilterCount(): number {
    return [this.filterDivision, this.filterSubDivision, this.filterStatus, this.filterFrequency, this.searchQuery]
      .filter(v => !!v).length;
  }

  // ── Role toggle ──────────────────────────────────────────────────────────
  setRole(role: ClientRole): void {
    if (this.activeRole === role) return;
    this.activeRole = role;

    // CFO-only filters (division/sub-division) don't apply once we flip to the
    // sub-division-head view, so clear them out rather than leaving stale state.
    this.filterDivision = null;
    this.filterSubDivision = null;

    if (role === 'sub-division-head' && !this.selectedSubDivisionForView) {
      this.selectedSubDivisionForView = this.userSubDivision || this.viewSubDivisionOptions[0]?.value || '';
    }

    this.applyFilters();
  }

  onViewSubDivisionChange(): void {
    this.applyFilters();
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  onDivisionChange(): void {
    // Reset sub-division when division changes
    this.filterSubDivision = null;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.allScopes];

    // Always show only top-level scopes (never sub-scopes)
    result = result.filter(s => s.scopeLevel === 'scope');

    // Sub-Division Head: hard-restrict to the sub-division currently selected in the toggle
    if (!this.isCfo && this.selectedSubDivisionForView) {
      result = result.filter(s => s.linkedSubDivisions.includes(this.selectedSubDivisionForView));
    }

    // CFO: division filter
    if (this.isCfo && this.filterDivision) {
      result = result.filter(s => s.division === this.filterDivision || !s.division);
    }

    // CFO: sub-division filter (only active when division is selected)
    if (this.isCfo && this.filterSubDivision) {
      result = result.filter(s => s.linkedSubDivisions.includes(this.filterSubDivision!));
    }

    // Status
    if (this.filterStatus) {
      result = result.filter(s => s.status === this.filterStatus);
    }

    // Risk
    if (this.filterFrequency) {
      result = result.filter(s => s.auditFrequency === this.filterFrequency);
    }

    // Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(s =>
        s.scopeName.toLowerCase().includes(q) ||
        (s.objective ?? '').toLowerCase().includes(q)
      );
    }

    this.filteredScopes = result;

    // Every filter/role/sub-division change (and the initial load) rebuilds filteredScopes from
    // scratch, so the previously-viewed page number is almost never still meaningful against the
    // new result set — reset to page 1 rather than risk landing on an empty page.
    this.currentPage = 1;
  }

  /** <app-pagination-bar> emits a zero-based page index. */
  onPageChange(page: number): void {
    this.currentPage = page + 1;
  }

  /** Resets to page 1 so the visible slice stays consistent with the new page size. */
  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.filterDivision = null;
    this.filterSubDivision = null;
    this.filterStatus = null;
    this.filterRisk = null;
    this.filterFrequency=null;
    this.searchQuery = '';
    this.applyFilters();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  getSubDivisionChips(subDivisions: string[]): string[] {
    return subDivisions.map(d => this.subDivisionLabels[d] ?? d);
  }

  getAuditorCount(auditors: string[]): string {
    return auditors.length === 1 ? '1 Auditor' : `${auditors.length} Auditors`;
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'secondary' | 'danger' {
    if (status === 'completed') return 'success';
    if (status === 'in-progress') return 'info';
    if (status === 'overdue') return 'danger';
    // 'not-started' and 'planned' both read as secondary/neutral — they're distinguished by
    // getStatusLabel() below, not by tag colour.
    return 'secondary';
  }

  getStatusLabel(status: string): string {
    if (status === 'completed') return 'Completed';
    if (status === 'in-progress') return 'In Progress';
    if (status === 'overdue') return 'Overdue';
    if (status === 'planned') return 'Planned';
    return 'Not Started';
  }

  getRiskClass(risk?: string | null): string {
    if (risk === 'high') return 'risk-high';
    if (risk === 'medium') return 'risk-medium';
    if (risk === 'low') return 'risk-low';
    return '';
  }

  formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  truncate(text: string, max = 100): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // ── Participants expand/collapse ────────────────────────────────────────
  expandedAuditors = new Set<string>();

  toggleAuditors(id: string): void {
    if (this.expandedAuditors.has(id)) {
      this.expandedAuditors.delete(id);
    } else {
      this.expandedAuditors.add(id);
    }
  }

  getVisibleAuditors(scope: ClientScope): string[] {
    if (this.expandedAuditors.has(scope.id) || scope.assignedAuditors.length <= 2) {
      return scope.assignedAuditors;
    }
    return scope.assignedAuditors.slice(0, 2);
  }

  getInitials(name: string): string {
    return name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  }

viewScope(scope: ClientScope): void {

    this.drawer.open(ScopeProfileComponent, {
      width: '600px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { scope ,isClientPortal: true } as unknown as ScopeProfileDrawerData,
    });
  }

}