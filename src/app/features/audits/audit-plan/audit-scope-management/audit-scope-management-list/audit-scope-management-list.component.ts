import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { Popover, PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { AddAuditScopeComponent } from '@/app/features/audits/audit-plan/audit-scope-management/add-audit-scope/add-audit-scope.component';
import { ScopeProfileComponent } from '@/app/features/audits/audit-plan/audit-scope-management/scope-profile/scope-profile.component';
import type { AddAuditScopeDrawerData, AddAuditScopeDrawerResult, ScopeProfileDrawerData } from '../models/audit-scope-drawer.model';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { AUDITOR_PROFILES } from '@/app/features/audits/organization/divisions/divisions-list/divisions-list.component';
import type { StaticScope, ScopeStatus } from '../models/audit-scope.model';
import type { EnrichedScope, AuditorScopeRow } from '../models/audit-scope-list.model';
import {
  AUDIT_SCOPE_STATIC_COMPANIES,
  findStaticScopeById,
  subScopesOf,
  upsertStaticScope,
  editStaticScope,
  setScopeStatus,
} from '../audit-scope-static-data';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';
import { SUB_DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-data';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { divisionAllowsSubDivisions, noSubDivisionMessage, resolveScopeOrgLabels } from '@/app/shared/utils/no-sub-division-message';


/**
 * Count of scopes (or sub-scopes) where the given id is an assigned auditor
 * OR reviewer — used by the auditor overview's "Assigned Scopes"/"Assigned
 * Sub-scopes" KPI cards.
 */
export function countScopesForAuditor(auditorId: string, level: 'scope' | 'subscope'): number {
  let count = 0;
  for (const companyRec of AUDIT_SCOPE_STATIC_COMPANIES) {
    for (const division of companyRec.divisions) {
      for (const dept of division.subDivisions) {
        for (const scope of dept.scopes) {
          const isSubscope = !!scope.parentScopeId;
          if ((level === 'subscope') !== isSubscope) continue;
          if (scope.assignedAuditors?.includes(auditorId) || scope.assignedReviewers?.includes(auditorId)) {
            count++;
          }
        }
      }
    }
  }
  return count;
}

/**
 * Count of scopes/sub-scopes (both levels combined) assigned to the given
 * auditor as auditor OR reviewer, matching an exact `workflowStatus` when
 * given (pass null for "Total", which doesn't filter by status). Used by
 * the auditor-my-audits-scopes tab's summary cards, so each card's count
 * always matches what audit-scope-management shows when the card is
 * clicked with the same status passed as a query param.
 */
export function countScopesForAuditorByStatus(auditorId: string, status: ScopeStatus | null): number {
  let count = 0;
  for (const companyRec of AUDIT_SCOPE_STATIC_COMPANIES) {
    for (const division of companyRec.divisions) {
      for (const dept of division.subDivisions) {
        for (const scope of dept.scopes) {
          if (!(scope.assignedAuditors?.includes(auditorId) || scope.assignedReviewers?.includes(auditorId))) continue;
          if (status === null || (scope.workflowStatus ?? 'Not Started') === status) count++;
        }
      }
    }
  }
  return count;
}

/** Illustrative progress % derived from status (scopes have no real completion-% field). */
function progressForScopeStatus(status: ScopeStatus): number {
  if (status === 'Completed') return 100;
  if (status === 'Not Started' || status === 'Planned') return 0;
  if (status === 'Overdue') return 40;
  return 60; // In Progress
}

const RISK_TO_PRIORITY: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/**
 * Every scope/sub-scope assigned to the given auditor, shaped for the
 * auditor-my-audits-scopes tab's "Assigned Scopes"/"Assigned Sub-scopes"
 * tables.
 */
export function getScopeRowsForAuditor(auditorId: string, level: 'scope' | 'subscope'): AuditorScopeRow[] {
  const rows: AuditorScopeRow[] = [];
  for (const companyRec of AUDIT_SCOPE_STATIC_COMPANIES) {
    for (const division of companyRec.divisions) {
      for (const dept of division.subDivisions) {
        for (const scope of dept.scopes) {
          const isSubscope = !!scope.parentScopeId;
          if ((level === 'subscope') !== isSubscope) continue;
          if (!(scope.assignedAuditors?.includes(auditorId) || scope.assignedReviewers?.includes(auditorId))) continue;
          const status = scope.workflowStatus ?? 'Not Started';
          const parent = isSubscope ? findStaticScopeById(scope.parentScopeId) : undefined;
          rows.push({
            scope: scope.scopeName,
            audit: dept.subDivisionName,
            parentScopeName: parent?.scopeName,
            priority: RISK_TO_PRIORITY[scope.riskRating ?? ''] ?? 'Medium',
            status,
            progress: progressForScopeStatus(status),
            dueDate: scope.endDate
              ? new Date(scope.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            scopeLevel: level,
          });
        }
      }
    }
  }
  return rows;
}

@Component({
  selector: 'app-audit-scope-management-list',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    MultiSelectModule,
    PopoverModule,
    ButtonModule,
    AvatarModule,
    PaginatorModule,
    TooltipModule,
    TagModule,
    DividerModule,
    ConfirmActionDialogComponent,
    PaginationBarComponent,
    DrawIconComponent
  ],
  templateUrl: './audit-scope-management-list.component.html',
  styleUrl: './audit-scope-management-list.component.scss',
})
export class AuditScopeManagementListComponent implements OnInit {

  @ViewChild('filterPanel') filterPanel!: Popover;

  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  viewMode: 'grid' | 'list' = 'grid';
  Math = Math;

  searchQuery = '';
  selectedCompanies: string[] = [];
  selectedDivisions: string[] = [];
  selectedSubDivisions: string[] = [];
  selectedAuditors: string[] = [];
  selectedStatuses: string[] = [];

  /** Status filter options. */
  readonly statusOptions: { label: string; value: ScopeStatus }[] = [
    { label: 'Not Started', value: 'Not Started' },
    { label: 'Planned',     value: 'Planned'     },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Overdue',     value: 'Overdue'     },
    { label: 'Completed',   value: 'Completed'   },
    { label: 'Pending Review', value: 'Pending Review' },
    { label: 'Approved',       value: 'Approved'       },
    { label: 'Rejected',       value: 'Rejected'       },
  ];

  /** Set when arriving from the dashboard "High-Risk Scopes Not Started" card. */
  highRiskNotStartedOnly = false;

  /**
   * Auditor id passed via query param (e.g. from the "Assigned Scopes" /
   * "Assigned Sub-scopes" overview KPI cards). When set, the list is scoped
   * to items assigned to this auditor.
   */
  auditorId: string | null = null;

  /**
   * Restricts the list to a single level when arriving from the overview cards:
   *  • 'scope'    → "Assigned Scopes"
   *  • 'subscope' → "Assigned Sub-scopes"
   */
  scopeLevelFilter: 'scope' | 'subscope' | null = null;

  pageSize = 6;
  firstIndex = 0;

  ngOnInit(): void {
    this.refreshScopes();

    this.route.queryParamMap.subscribe(params => {
      this.highRiskNotStartedOnly = params.get('filter') === 'high-risk-not-started';

      /* Allow deep-linking a status filter, e.g. ?status=Overdue */
      const status = params.get('status');
      if (status && this.statusOptions.some(o => o.value === status)) {
        this.selectedStatuses = [status];
      }

      /* Scope to a specific auditor (from the overview "Assigned Scopes/Sub-scopes" cards). */
      this.auditorId = params.get('auditorId');

      /* Restrict to scopes or sub-scopes when specified. */
      const scopeLevel = params.get('scopeLevel');
      this.scopeLevelFilter =
        scopeLevel === 'scope' || scopeLevel === 'subscope' ? scopeLevel : null;

      this.firstIndex = 0;
    });
  }

  /** Clears the high-risk quick filter and removes it from the URL. */
  clearHighRiskFilter(): void {
    this.highRiskNotStartedOnly = false;
    this.firstIndex = 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * A scope counts as "high-risk & not started" for the dashboard drill-down.
   * NOTE: heuristic fallback — replace with your real data when the scope model
   * carries an explicit risk rating / status.
   */
  private isHighRiskNotStarted(s: EnrichedScope): boolean {
    return (s.riskRating === 'High' || s.riskRating === 'Critical') && s.started === false;
  }

  /**
   * Derives a display status. Prefers an explicit status on the raw scope,
   * otherwise infers from the started flag and the end date.
   * NOTE: heuristic — swap for your real status data when available.
   */
  private deriveStatus(started: boolean, endDate?: string, raw?: string): ScopeStatus {
    if (raw) {
      const r = raw.toLowerCase();
      if (r.includes('complete'))  return 'Completed';
      if (r.includes('overdue'))   return 'Overdue';
      if (r.includes('progress'))  return 'In Progress';
      if (r.includes('plan'))      return 'Planned';
      if (r.includes('not'))       return 'Not Started';
    }
    if (!started) return 'Not Started';
    const end = endDate ? new Date(endDate).getTime() : NaN;
    if (!isNaN(end) && end < Date.now()) return 'Overdue';
    return 'In Progress';
  }

  /** PrimeNG tag severity for a status badge. */
  statusSeverity(status?: ScopeStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'Completed':   return 'success';
      case 'In Progress': return 'info';
      case 'Overdue':     return 'danger';
      case 'Planned':     return 'secondary';
      case 'Pending Review': return 'warn';
      case 'Approved':       return 'success';
      case 'Rejected':       return 'danger';
      default:            return 'warn'; // Not Started
    }
  }

  get companyOptions() {
    return this.companyDataService.all
      .filter(c => !c.blocked)
      .map(c => ({ label: c.companyName, value: c.id }));
  }

  /** The REAL division list (division-static-data.ts), not this file's own
   *  scope-grouping wrapper array, so a division added via divisions.ts's Add
   *  Division flow appears here immediately, even before it has any scopes. */
  private get allStaticDivisions() {
    return DIVISION_STATIC_COMPANIES.flatMap(c => c.divisions);
  }

  get availableDivisionOptions() {
    const companies = this.selectedCompanies;
    const seen = new Set<string>();
    return this.allStaticDivisions
      .filter(b => companies.length === 0 || companies.includes(b.company))
      .filter(b => b.status === 'active' && !this.companyDataService.isCompanyBlocked(b.company))
      .filter(b => { if (seen.has(b.divisionCode)) return false; seen.add(b.divisionCode); return true; })
      .map(b => ({ label: b.divisionName, value: b.divisionCode }));
  }

  /** Set when the selected divisions have no sub-divisions — disables the Sub-Division filter. */
  get subDivisionDisabledMessage(): string | null {
    return noSubDivisionMessage(this.selectedDivisions);
  }

  /** How many scopes (audit-scope-static-data.ts, the real scope source) exist
   *  for a given real division/sub-division, so the sub-division FILTER can keep its
   *  "only sub-divisions that already have scopes" restriction while sourcing
   *  the actual sub-division list from sub-division-static-data.ts. */
  private getScopeCountForSubDivision(divisionCode: string, subDivisionName: string): number {
    for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
      const division = company.divisions.find(b => b.divisionCode === divisionCode);
      const dept = division?.subDivisions.find(d => d.subDivisionName === subDivisionName);
      if (dept) return dept.scopes.length;
    }
    return 0;
  }

  get availableSubDivisionOptions() {
    const companies = this.selectedCompanies;
    const divisions = this.selectedDivisions;
    const seen = new Set<string>();
    const opts: { label: string; value: string }[] = [];
    for (const c of SUB_DIVISION_STATIC_COMPANIES) {
      if (companies.length > 0 && !companies.includes(c.id)) continue;
      for (const b of c.divisions) {
        if (divisions.length > 0 && !divisions.includes(b.divisionCode)) continue;
        if (!divisionAllowsSubDivisions(b.divisionCode, c.id)) continue;
        for (const d of b.subDivisions) {
          if (seen.has(d.subDivisionName)) continue;
          if (d.status !== 'active') continue;
          if (this.getScopeCountForSubDivision(b.divisionCode, d.subDivisionName) > 0) {
            seen.add(d.subDivisionName);
            opts.push({ label: d.subDivisionName, value: d.subDivisionName });
          }
        }
      }
    }
    return opts;
  }

  /**
   * Distinct auditor names across all scopes, for the auditor filter.
   * Mirrors the evidence-list auditor filter (flat, filterable list).
   */
  get auditorOptions() {
    const set = new Set<string>();
    for (const s of this.allEnrichedScopes) {
      for (const name of s.auditorNames) if (name) set.add(name);
    }
    return Array.from(set).sort().map(name => ({ label: name, value: name }));
  }

  /** Maps AUDITOR_PROFILES keys (e.g. 'alice') to display names, for the auditor filter/list. */
  private auditorDisplayNames(ids: string[] | undefined): string[] {
    if (!ids) return [];
    return ids.map(id => AUDITOR_PROFILES[id]?.displayName ?? id);
  }

  /**
   * Mock high-risk, not-started scopes so the dashboard "High-Risk Scopes
   * Not Started" drill-down always has data to show.
   * NOTE: demo data — remove once real scopes carry riskRating/started.
   */
  private readonly mockHighRiskScopes: Omit<EnrichedScope, 'org'>[] = [
    {
      id: 'MOCK-9001', name: 'Cybersecurity Threat Assessment',
      description: 'End-to-end review of perimeter, endpoint and identity controls against the latest threat landscape.',
      avatarUrl: 'images/avatars/default-avatar.jpg', timePeriod: '2026-01-01 - 2026-03-31',
      auditors: '0 Auditors', auditorNames: [], budget: '$48,000', model: 'Full',
      company: 'Cygnus Aura', divisionCode: 'DXB-HQ', divisionName: 'Dubai HQ',
      subDivisionName: 'IT', scopeLevel: 'scope',
      riskRating: 'Critical', started: false, status: 'Not Started',
      createdAt: '2026-01-01T08:00:00.000Z',
    },
    {
      id: 'MOCK-9002', name: 'AML / CFT Sanctions Screening Review',
      description: 'Assessment of transaction monitoring and sanctions-screening effectiveness across high-risk jurisdictions.',
      avatarUrl: 'images/avatars/default-avatar.jpg', timePeriod: '2026-02-01 - 2026-04-30',
      auditors: '0 Auditors', auditorNames: [], budget: '$36,500', model: 'Thematic',
      company: 'Cygnus Aura', divisionCode: 'AUH-BR', divisionName: 'Abu Dhabi Division',
      subDivisionName: 'Compliance', scopeLevel: 'scope',
      riskRating: 'High', started: false, status: 'Not Started',
      createdAt: '2026-02-01T08:00:00.000Z',
    },
    {
      id: 'MOCK-9003', name: 'Treasury & Liquidity Risk Audit',
      description: 'Review of treasury controls, liquidity buffers and counterparty exposure limits.',
      avatarUrl: 'images/avatars/default-avatar.jpg', timePeriod: '2026-01-15 - 2026-03-15',
      auditors: '0 Auditors', auditorNames: [], budget: '$52,000', model: 'Full',
      company: 'Subsidiary Co.', divisionCode: 'RUH-BR', divisionName: 'Riyadh Division',
      subDivisionName: 'Finance', scopeLevel: 'scope',
      riskRating: 'Critical', started: false, status: 'Not Started',
      createdAt: '2026-01-15T08:00:00.000Z',
    },
    {
      id: 'MOCK-9004', name: 'Data Privacy Impact Assessment',
      description: 'PDPL/GDPR gap assessment for customer data processing across CRM and marketing platforms.',
      avatarUrl: 'images/avatars/default-avatar.jpg', timePeriod: '2026-03-01 - 2026-05-31',
      auditors: '0 Auditors', auditorNames: [], budget: '$29,000', model: 'Limited',
      company: 'Subsidiary Co.', divisionCode: 'SHJ-BR', divisionName: 'Sharjah Division',
      subDivisionName: 'Legal', scopeLevel: 'scope',
      riskRating: 'High', started: false, status: 'Not Started',
      createdAt: '2026-03-01T08:00:00.000Z',
    },
  ];

  // Cached rather than recomputed on every access — this getter used to walk the
  // entire AUDIT_SCOPE_STATIC_COMPANIES tree, build two Maps, and re-sort a fresh
  // array on every read. As a plain getter it re-ran on every Angular change-detection
  // cycle (read from auditorOptions and filteredScopes), the same anti-pattern that
  // caused an out-of-memory crash on the RFI Management pages. refreshScopes()
  // recomputes it only when the underlying static data can actually have changed
  // (init, add/edit scope, activate/deactivate).
  private _allEnrichedScopes: EnrichedScope[] = [];

  private get allEnrichedScopes(): EnrichedScope[] {
    return this._allEnrichedScopes;
  }

  private refreshScopes(): void {
    // const result: EnrichedScope[] = [...this.mockHighRiskScopes];
    const result: EnrichedScope[] = [];
    // Flatten every scope/sub-scope once (keyed by id) so a sub-scope's
    // parent can always be looked up, regardless of division/sub-division bucket.
    const allScopes: {
      scope: StaticScope; company: string; divisionCode: string; divisionName: string; subDivisionName: string | null;
    }[] = [];
    for (const companyRec of AUDIT_SCOPE_STATIC_COMPANIES) {
      for (const division of companyRec.divisions) {
        // Division-level scopes (sit directly under the division).
        for (const scope of division.scopes ?? []) {
          // Skip division-level scopes under a division that has sub-divisions — unless the
          // scope was explicitly added/edited at division level (`hasSubDivision: false`).
          if (division.hasSubDivision && scope.hasSubDivision !== false) continue;
          allScopes.push({
            scope, company: companyRec.id, divisionCode: division.divisionCode,
            divisionName: division.divisionName, subDivisionName: null,
          });
        }
        // Skip leftover sub-division records under a division that has no sub-divisions.
        if (!divisionAllowsSubDivisions(division.divisionCode, companyRec.id)) continue;
        for (const dept of division.subDivisions) {
          for (const scope of dept.scopes) {
            allScopes.push({
              scope, company: companyRec.id, divisionCode: division.divisionCode,
              divisionName: division.divisionName, subDivisionName: dept.subDivisionName,
            });
          }
        }
      }
    }
    const byId = new Map(allScopes.map(e => [e.scope.id, e]));
    const subScopeCounts = new Map<string, number>();
    for (const { scope } of allScopes) {
      if (scope.parentScopeId) {
        subScopeCounts.set(scope.parentScopeId, (subScopeCounts.get(scope.parentScopeId) ?? 0) + 1);
      }
    }

    const riskLabel: Record<string, EnrichedScope['riskRating']> = {
      low: 'Low', medium: 'Medium', high: 'High',
    };

    for (const { scope, company, divisionCode, divisionName, subDivisionName } of allScopes) {
      const hours = scope.estimatedHours ?? 0;
      const rate = scope.hourlyRate ?? 0;
      const budget = hours && rate ? `$${(hours * rate).toLocaleString()}` : '—';
      const auditorCount = scope.assignedAuditors?.length ?? 0;
      const auditorNames = this.auditorDisplayNames(scope.assignedAuditors);
      const auditorIds = scope.assignedAuditors ?? [];
      const reviewerIds = scope.assignedReviewers ?? [];

      const started = scope.workflowStatus ? scope.workflowStatus !== 'Not Started' : auditorCount > 0;
      const status = scope.workflowStatus ?? this.deriveStatus(started, scope.endDate);
      const isSubscope = !!scope.parentScopeId;
      const parent = isSubscope ? byId.get(scope.parentScopeId!) : undefined;

      result.push({
        id: scope.id,
        name: scope.scopeName,
        description: scope.objective ?? '',
        avatarUrl: 'images/avatars/default-avatar.jpg',
        timePeriod: `${scope.startDate} - ${scope.endDate}`,
        auditors: `${auditorCount} Auditor${auditorCount !== 1 ? 's' : ''}`,
        auditorNames,
        auditorIds,
        reviewerIds,
        budget,
        model: scope.modeOfAudit,
        subScopeCount: !isSubscope ? (subScopeCounts.get(scope.id) || undefined) : undefined,
        company,
        divisionCode,
        divisionName,
        subDivisionName,
        org: resolveScopeOrgLabels(company, divisionCode, subDivisionName),
        scopeLevel: isSubscope ? 'subscope' : 'scope',
        parentScopeName: isSubscope ? parent?.scope.scopeName : undefined,
        riskRating: scope.riskRating ? riskLabel[scope.riskRating] : undefined,
        started,
        status,
        createdAt: scope.createdAt,
      });
    }

    // Newest-first: a scope/sub-scope just added via the drawer gets the
    // current timestamp (see upsertStaticScope), so it always sorts to the top.
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    this._allEnrichedScopes = result;
  }

  get filteredScopes(): EnrichedScope[] {
    const q = this.searchQuery.toLowerCase().trim();
    const companies = this.selectedCompanies;
    const divisions = this.selectedDivisions;
    const depts = this.selectedSubDivisions;
    const auditors = this.selectedAuditors;
    const statuses = this.selectedStatuses;
    const auditorId = this.auditorId;
    const level = this.scopeLevelFilter;
    return this.allEnrichedScopes.filter(s => {
      if (this.highRiskNotStartedOnly && !this.isHighRiskNotStarted(s)) return false;
      if (level && s.scopeLevel !== level) return false;
      if (auditorId &&
          !(s.auditorIds?.includes(auditorId)) &&
          !(s.reviewerIds?.includes(auditorId)) &&
          !s.auditorNames.includes(auditorId.toLowerCase())) return false;
      if (companies?.length > 0 && !companies.includes(s.company)) return false;
      if (divisions?.length > 0 && !divisions.includes(s.divisionCode)) return false;
      // Division-level scopes have no sub-division, so a sub-division filter excludes them.
      if (depts?.length > 0 && (!s.subDivisionName || !depts.includes(s.subDivisionName))) return false;
      if (auditors?.length > 0 && !s.auditorNames.some(a => auditors.includes(a))) return false;
      if (statuses?.length > 0 && !statuses.includes(s.status ?? '')) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }

    /** Zero-based current page index, derived from firstIndex/pageSize for the shared pagination bar. */
  get currentPage(): number {
    return this.pageSize > 0 ? Math.floor(this.firstIndex / this.pageSize) : 0;
  }

  get pagedScopes(): EnrichedScope[] {
    return this.filteredScopes.slice(this.firstIndex, this.firstIndex + this.pageSize);
  }

  get lastIndex(): number {
    return Math.min(this.firstIndex + this.pageSize, this.filteredScopes.length);
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  onSearch(): void { this.firstIndex = 0; }

  onPageChange(page: number): void {
    this.firstIndex = page * this.pageSize;
  }

  onRowsChange(rows: number): void {
    this.pageSize = rows;
    this.firstIndex = 0;
  }

  async onAddNewScope(): Promise<void> {
    const result = await this.drawer.open<AddAuditScopeDrawerResult, AddAuditScopeDrawerData>(
      AddAuditScopeComponent,
      {
        width: '700px',
        styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
        data: { mode: 'add' },
      },
    ).afterClosed;

    if (!result?.scope) return;
    const company = this.companyDataService.getById(result.scope.company);
    upsertStaticScope(result.scope.company, result.scope.divisionCode, result.scope.subDivisionName, result.scope, company ? {
      companyName: company.companyName,
      tag: company.tag,
      color: company.color,
    } : undefined);
    this.refreshScopes();
  }

  viewScope(enriched: EnrichedScope): void {
    const record = findStaticScopeById(enriched.id);
    if (!record) return;

    // `record` is the lighter static shape (audit-scope-static-data.ts), not the
    // original `Scope`/`SubScope` type this drawer is normally fed with — its
    // label/severity mappers use the same value domains so it renders correctly.
    // One shape difference the drawer DOES care about: it expects a scope's
    // sub-scopes nested as `scope.subScopes[]` (with `subScopeName`/`subScopeType`
    // fields), whereas our static data stores them as flat sibling records
    // linked via `parentScopeId` — adapt that here, at the call site, rather
    // than touching the (untouched) drawer itself.
    if (record.parentScopeId) {
      const parent = findStaticScopeById(record.parentScopeId);
      this.drawer.open(ScopeProfileComponent, {
        width: '720px',
        styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
        data: {
          scope: parent ?? null,
          subscope: { ...record, subScopeName: record.scopeName, subScopeType: record.scopeType },
          parentName: parent?.scopeName,
        } as unknown as ScopeProfileDrawerData,
      });
      return;
    }

    const subScopes = subScopesOf(record.id).map(s => ({
      ...s, subScopeName: s.scopeName, subScopeType: s.scopeType,
    }));
    this.drawer.open(ScopeProfileComponent, {
      width: '720px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { scope: { ...record, subScopes } } as unknown as ScopeProfileDrawerData,
    });
  }

  async editScope(enriched: EnrichedScope): Promise<void> {
    const scope = findStaticScopeById(enriched.id);
    if (!scope) return;

    const result = await this.drawer.open<AddAuditScopeDrawerResult, AddAuditScopeDrawerData>(
      AddAuditScopeComponent,
      {
        width: '700px',
        styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
        data: { mode: 'edit', scope },
      },
    ).afterClosed;

    if (!result?.scopeUpdate) return;
    editStaticScope(enriched.id, result.scopeUpdate);
    this.refreshScopes();
  }

  onCompanyChange(): void {
    this.selectedDivisions = [];
    this.selectedSubDivisions = [];
    this.firstIndex = 0;
  }

  onDivisionChange(): void {
    this.selectedSubDivisions = [];
    this.firstIndex = 0;
  }

  onSubDivisionChange(): void { this.firstIndex = 0; }

  onAuditorChange(): void { this.firstIndex = 0; }

  onStatusChange(): void { this.firstIndex = 0; }

  // p-multiselect's clear (×) button only emits `onClear`, not `onChange`, and
  // resets the model to `null` rather than `[]` — reset explicitly and cascade
  // the same way the corresponding onChange handler does.
  onCompanyClear(): void {
    this.selectedCompanies = [];
    this.onCompanyChange();
  }

  onDivisionClear(): void {
    this.selectedDivisions = [];
    this.onDivisionChange();
  }

  onSubDivisionClear(): void {
    this.selectedSubDivisions = [];
    this.onSubDivisionChange();
  }

  onAuditorClear(): void {
    this.selectedAuditors = [];
    this.onAuditorChange();
  }

  onStatusClear(): void {
    this.selectedStatuses = [];
    this.onStatusChange();
  }

  /* ── Popover filter helpers (mirrors evidence-list) ──────────────────────── */
  get hasActiveFilters(): boolean {
    return !!this.searchQuery.trim()
      || this.selectedCompanies?.length > 0
      || this.selectedDivisions?.length > 0
      || this.selectedSubDivisions?.length > 0
      || this.selectedAuditors?.length > 0
      || this.selectedStatuses?.length > 0;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.selectedCompanies.length)   count++;
    if (this.selectedDivisions?.length)    count++;
    if (this.selectedSubDivisions?.length) count++;
    if (this.selectedAuditors?.length)    count++;
    if (this.selectedStatuses?.length)    count++;
    return count;
  }

  get activeFilterChips(): { key: string; label: string }[] {
    const chips: { key: string; label: string }[] = [];
    if (this.selectedCompanies.length)
      chips.push({ key: 'companies',   label: `Company: ${this.selectedCompanies.length}` });
    if (this.selectedDivisions.length)
      chips.push({ key: 'divisions',    label: `Division: ${this.selectedDivisions.length}` });
    if (this.selectedSubDivisions.length)
      chips.push({ key: 'sub-divisions', label: `Dept: ${this.selectedSubDivisions.length}` });
    if (this.selectedAuditors.length)
      chips.push({ key: 'auditors',    label: `Auditor: ${this.selectedAuditors.length}` });
    if (this.selectedStatuses.length)
      chips.push({ key: 'statuses',    label: `Status: ${this.selectedStatuses.length}` });
    return chips;
  }

  removeFilter(key: string): void {
    switch (key) {
      case 'companies':   this.selectedCompanies = []; this.selectedDivisions = []; this.selectedSubDivisions = []; break;
      case 'divisions':    this.selectedDivisions = []; this.selectedSubDivisions = []; break;
      case 'subDivisions': this.selectedSubDivisions = []; break;
      case 'auditors':    this.selectedAuditors = []; break;
      case 'statuses':    this.selectedStatuses = []; break;
    }
    this.firstIndex = 0;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedCompanies = [];
    this.selectedDivisions = [];
    this.selectedSubDivisions = [];
    this.selectedAuditors = [];
    this.selectedStatuses = [];
    this.auditorId = null;
    this.scopeLevelFilter = null;
    this.firstIndex = 0;
  }

  /* ── Deactivate / activate ──────────────────────────────────────────────── */
  blockedIds = new Set<string>();
  showConfirmDialog = false;
  confirmTarget: { id: string; name: string } | null = null;

  // Real (static-data-backed) rows persist Activate/Deactivate on the actual
  // record; the dashboard's mock high-risk rows have no backing static record,
  // so they keep falling back to the local `blockedIds` Set as before.
  isBlocked(id: string): boolean {
    const scope = findStaticScopeById(id);
    return scope ? scope.status === 'inactive' : this.blockedIds.has(id);
  }

  openConfirm(id: string, name: string): void {
    this.confirmTarget = { id, name };
    this.showConfirmDialog = true;
  }

  closeConfirm(): void {
    this.showConfirmDialog = false;
    this.confirmTarget = null;
  }

  confirmToggle(): void {
    if (!this.confirmTarget) return;
    const { id } = this.confirmTarget;
    const scope = findStaticScopeById(id);
    if (scope) {
      setScopeStatus(id, scope.status === 'inactive' ? 'active' : 'inactive');
      this.refreshScopes();
    } else if (this.blockedIds.has(id)) {
      this.blockedIds.delete(id);
    } else {
      this.blockedIds.add(id);
    }
    this.closeConfirm();
  }

  truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }
}