import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { Popover, PopoverModule } from 'primeng/popover';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { AddRfi } from '@/app/features/audits/audit-execution/rfi-management/add-rfi/add-rfi.component';
import { ViewRfi } from '@/app/features/audits/audit-execution/rfi-management/view-rfi/view-rfi.component';
import type { EnrichedRFI } from '../models/rfi.model';
import type { AddRfiDrawerData, ViewRfiDrawerData } from '../models/rfi-drawer.model';
import type { RfiFilterSubScope, RfiFilterScope, RfiFilterSubDivision, RfiRow } from '../models/rfi-list.model';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { getAllEnrichedRfis, setStaticRfiStatus } from '../rfi-static-data';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';
import { SUB_DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-data';
import { AUDIT_SCOPE_STATIC_COMPANIES } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { divisionAllowsSubDivisions, noSubDivisionMessage, resolveScopeOrgLabels } from '@/app/shared/utils/no-sub-division-message';

@Component({
  selector: 'app-rfi-management-list',
  imports: [
    CommonModule,
    SelectModule, ButtonModule, FormsModule,
    MultiSelectModule, PopoverModule, TagModule, TooltipModule, DatePipe, InputTextModule,
    ConfirmActionDialogComponent, PaginationBarComponent, DrawIconComponent
  ],
  templateUrl: './rfi-management-list.component.html',
  styleUrl: './rfi-management-list.component.scss',
})
export class RfiManagementListComponent implements OnInit {
  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);
  private readonly route  = inject(ActivatedRoute);

  @ViewChild('filterPanel') filterPanel!: Popover;

  viewMode: 'grid' | 'list' = 'grid';

  searchQuery = '';
  pageSize = 6;
  /** Zero-based current page index. */
  currentPage = 0;

  // ── Auditor filters ──────────────────────────────────────────────────
  selectedCompanies: string[] = [];
  selectedDivisions: string[] = [];
  selectedSubDivisions: RfiFilterSubDivision[] = [];
  selectedScopes: RfiFilterScope[] = [];
  selectedSubScopes: RfiFilterSubScope[] = [];
  selectedStatuses: string[] = [];
  selectedOwners: string[] = [];

  /**
   * Auditor id passed via query param (e.g. from the "Pending RFI Responses"
   * overview KPI card). When set, the list is scoped to RFIs belonging to this
   * auditor. Matches an RFI's auditor id(s) first, then falls back to the owner
   * value / label.
   */
  auditorId: string | null = null;

  readonly statusOptions = [
    { label: 'Pending',      value: 'pending' },
    { label: 'Overdue',      value: 'overdue' },
    { label: 'Under Review', value: 'under-review' },
    { label: 'Completed',    value: 'completed' },
    { label: 'Reopened',     value: 'reopened' },
  ];

  get companyOptions() {
    return this.companyDataService.all.map(c => ({ label: c.companyName, value: c.id }));
  }

  /** The REAL division list (division-static-data.ts), not this file's own
   *  RFI-grouping wrapper array, so a division added via divisions.ts's Add
   *  Division flow appears here immediately, even before it has any RFIs. */
  get availableDivisionOptions() {
    const companies = this.selectedCompanies;
    const seen = new Set<string>();
    return DIVISION_STATIC_COMPANIES
      .filter(c => companies.length === 0 || companies.includes(c.id))
      .flatMap(c => c.divisions)
      .filter(b => { if (seen.has(b.divisionCode)) return false; seen.add(b.divisionCode); return true; })
      .map(b => ({ label: b.divisionName, value: b.divisionCode }));
  }

  // Build sub-division/scope/subScope options for the auditor filters — sub-divisions
  // from the REAL sub-division list (sub-division-static-data.ts) and scopes/sub-scopes
  // from the REAL scope list (audit-scope-static-data.ts), cross-referenced by
  // divisionCode/subDivisionName, so newly added sub-divisions/scopes appear here
  // immediately even before an RFI has been attached to them. Scopes/sub-scopes
  // are a flat `scopes[]` per sub-division, differentiated by `parentScopeId`
  // (null = top-level scope, set = sub-scope of that scope).
  get subDivisions(): RfiFilterSubDivision[] {
    const companies = this.selectedCompanies;
    const divisions = this.selectedDivisions;
    const deptMap = new Map<string, RfiFilterSubDivision>();
    let dId = 100, sId = 200, ssId = 300;
    for (const company of SUB_DIVISION_STATIC_COMPANIES) {
      if (companies.length > 0 && !companies.includes(company.id)) continue;
      for (const b of company.divisions) {
        if (divisions.length > 0 && !divisions.includes(b.divisionCode)) continue;
        if (!divisionAllowsSubDivisions(b.divisionCode, company.id)) continue;
        for (const d of b.subDivisions) {
          const key = d.subDivisionName;
          if (!deptMap.has(key)) {
            deptMap.set(key, { id: dId++, label: d.subDivisionName, value: d.subDivisionName, owners: [], scopes: [] });
          }
          const dept = deptMap.get(key)!;
          const scopes = AUDIT_SCOPE_STATIC_COMPANIES
            .find(c => c.id === company.id)?.divisions
            .find(sb => sb.divisionCode === b.divisionCode)?.subDivisions
            .find(sd => sd.subDivisionName === d.subDivisionName)?.scopes ?? [];
          const topLevelScopes = scopes.filter(s => s.parentScopeId === null);
          for (const s of topLevelScopes) {
            let scopeEntry = dept.scopes.find(x => x.label === s.scopeName);
            if (!scopeEntry) {
              scopeEntry = { id: sId++, label: s.scopeName, value: s.scopeName, subScopes: [] };
              dept.scopes.push(scopeEntry);
            }
            for (const ss of scopes.filter(x => x.parentScopeId === s.id)) {
              if (!scopeEntry.subScopes.find(x => x.label === ss.scopeName)) {
                scopeEntry.subScopes.push({ id: ssId++, label: ss.scopeName, value: ss.scopeName });
              }
            }
          }
        }
      }
    }
    return Array.from(deptMap.values());
  }

  /** Set when the selected divisions have no sub-divisions — disables the Sub-Division filter. */
  get subDivisionDisabledMessage(): string | null {
    return noSubDivisionMessage(this.selectedDivisions);
  }

  /** Scope filter options: the selected sub-divisions' scopes when any are picked;
   *  otherwise every scope (division-level + sub-division) under the selected
   *  divisions — or under all divisions of the selected companies when no division
   *  is picked — from the REAL scope list (audit-scope-static-data.ts). */
  get availableScopes(): RfiFilterScope[] {
    const map = new Map<string, RfiFilterScope>();
    if (this.selectedSubDivisions.length > 0) {
      for (const dept of this.selectedSubDivisions) {
        for (const scope of dept.scopes) map.set(scope.value, scope);
      }
      return Array.from(map.values());
    }

    const companies = this.selectedCompanies;
    const divisions = this.selectedDivisions;
    // Cached per company/division selection — this getter runs on every change-detection
    // pass and walks the whole scope tree (see the _allDivisionRFIs note below).
    const cacheKey = `${companies.join('|')}::${divisions.join('|')}`;
    if (this._scopeOptionsCache?.key === cacheKey) return this._scopeOptionsCache.scopes;
    let sId = 500, ssId = 700;
    for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
      if (companies.length > 0 && !companies.includes(company.id)) continue;
      for (const b of company.divisions) {
        if (divisions.length > 0 && !divisions.includes(b.divisionCode)) continue;
        // A division without sub-divisions contributes only its own division-level scopes.
        const subDivisionScopes = divisionAllowsSubDivisions(b.divisionCode, company.id)
          ? b.subDivisions.map(sd => sd.scopes)
          : [];
        for (const scopes of [b.scopes ?? [], ...subDivisionScopes]) {
          for (const s of scopes.filter(x => x.parentScopeId === null)) {
            let scopeEntry = map.get(s.scopeName);
            if (!scopeEntry) {
              scopeEntry = { id: sId++, label: s.scopeName, value: s.scopeName, subScopes: [] };
              map.set(s.scopeName, scopeEntry);
            }
            for (const ss of scopes.filter(x => x.parentScopeId === s.id)) {
              if (!scopeEntry.subScopes.find(x => x.label === ss.scopeName)) {
                scopeEntry.subScopes.push({ id: ssId++, label: ss.scopeName, value: ss.scopeName });
              }
            }
          }
        }
      }
    }
    const scopes = Array.from(map.values());
    this._scopeOptionsCache = { key: cacheKey, scopes };
    return scopes;
  }

  private _scopeOptionsCache: { key: string; scopes: RfiFilterScope[] } | null = null;

  get availableSubScopes(): RfiFilterSubScope[] {
    const map = new Map<string, RfiFilterSubScope>();
    const source = this.selectedScopes.length ? this.selectedScopes : this.availableScopes;
    for (const scope of source) {
      for (const sub of scope.subScopes) map.set(sub.value, sub);
    }
    return Array.from(map.values());
  }

  /** Distinct owners across all RFIs, for the Owner filter. */
  get ownerOptions(): { label: string; value: string }[] {
    const map = new Map<string, string>();
    for (const r of this.allDivisionRFIs) {
      if (r.ownerValue) map.set(r.ownerValue, r.ownerLabel || r.ownerValue);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ label, value }));
  }

  // ── Flat RFI list derived from the RFI static data — newest-first ───────────────────
  // Cached rather than recomputed on every access: getAllEnrichedRfis() walks the entire
  // (large) RFI static-data tree and allocates a fresh array + Date objects every call. As
  // a plain getter this used to re-run on every Angular change-detection cycle — and it's
  // read from several other getters (stat counts, filteredRfis, findRfiById) plus once per
  // rendered card (isBlocked) — so a single render pass could trigger dozens of full tree
  // walks, and with CD firing on every mouse move (the Add RFI drawer's resize handle uses
  // a document:mousemove listener), that compounded fast enough to crash the tab with an
  // out-of-memory error. refreshRfis() recomputes it only when the underlying static data
  // can actually have changed (init, add/edit, activate/deactivate).
  private _allDivisionRFIs: RfiRow[] = [];

  private refreshRfis(): void {
    // Drop RFIs filed under sub-divisions of a division that has no sub-divisions
    // (leftover seed records), and division-level RFIs under a division that has
    // sub-divisions — unless the RFI was explicitly added at division level
    // (`hasSubDivision: false`). The list, stat cards and filters all read this.
    this._allDivisionRFIs = getAllEnrichedRfis()
      .filter(r => r.subDivisionValue
        ? divisionAllowsSubDivisions(r.divisionCode, r.company)
        : !divisionAllowsSubDivisions(r.divisionCode, r.company) || r.hasSubDivision === false)
      .map(r => ({ ...r, org: resolveScopeOrgLabels(r.company, r.divisionCode, r.subDivisionLabel) }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    this._scopeOptionsCache = null;
  }

  private get allDivisionRFIs(): RfiRow[] {
    return this._allDivisionRFIs;
  }

  // ── Stat row (matches the Audit Dashboard's kpi-grid card model) ────────
  get rfiKpis() {
    return [
      { label: 'Total RFIs',   value: String(this.totalCount),      icon: 'pi pi-folder-open',        accent: '' },
      { label: 'Pending',      value: String(this.pendingCount),     icon: 'pi pi-clock',              accent: 'warning' },
      { label: 'Overdue',      value: String(this.overdueCount),     icon: 'pi pi-exclamation-circle', accent: 'danger' },
      { label: 'Under Review', value: String(this.underReviewCount), icon: 'pi pi-eye',                accent: 'muted' },
      { label: 'Completed',    value: String(this.completedCount),   icon: 'pi pi-check-circle',       accent: 'success' },
      { label: 'Reopened',     value: String(this.reopenedCount),    icon: 'pi pi-refresh',             accent: 'warning' },
    ];
  }

  // ── Stat counts (based on all RFIs, no filters) ──────────────────────────
  get totalCount()       { return this.allDivisionRFIs.length; }
  get completedCount()   { return this.allDivisionRFIs.filter(r => r.status === 'completed').length; }
  get pendingCount()     { return this.allDivisionRFIs.filter(r => r.status === 'pending').length; }
  get overdueCount()     { return this.allDivisionRFIs.filter(r => r.status === 'overdue').length; }
  get underReviewCount() { return this.allDivisionRFIs.filter(r => r.status === 'under-review').length; }
  get reopenedCount()    { return this.allDivisionRFIs.filter(r => r.status === 'reopened').length; }

  /** True when the given RFI is assigned to the deep-linked auditor (not merely owned by them). */
  private matchesAuditor(r: EnrichedRFI, auditorId: string): boolean {
    return r.auditorId === auditorId
      || (r.auditorIds?.includes(auditorId) ?? false);
  }

  get filteredRfis(): RfiRow[] {
    const q = this.searchQuery.toLowerCase().trim();
    const companies = this.selectedCompanies;
    const divisions = this.selectedDivisions;
    const depts = this.selectedSubDivisions.map(d => d.value);
    const scopes = this.selectedScopes.map(s => s.value);
    const subScopes = this.selectedSubScopes.map(ss => ss.value);
    const statuses = this.selectedStatuses;
    const owners = this.selectedOwners;
    const auditorId = this.auditorId;

    return this.allDivisionRFIs.filter(r => {
      if (auditorId && !this.matchesAuditor(r, auditorId)) return false;
      if (companies.length > 0 && !companies.includes(r.company)) return false;
      if (divisions.length > 0 && !divisions.includes(r.divisionCode)) return false;
      if (depts.length > 0 && !depts.includes(r.subDivisionValue)) return false;
      if (scopes.length > 0 && (!r.scopeValue || !scopes.includes(r.scopeValue))) return false;
      if (subScopes.length > 0 && (!r.subScopeValue || !subScopes.includes(r.subScopeValue))) return false;
      if (statuses.length > 0 && !statuses.includes(r.status)) return false;
      if (owners.length > 0 && !owners.includes(r.ownerValue)) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  private get firstIndex(): number {
    return this.currentPage * this.pageSize;
  }

  get pagedRfis(): RfiRow[] {
    return this.filteredRfis.slice(this.firstIndex, this.firstIndex + this.pageSize);
  }

  ngOnInit(): void {
    this.refreshRfis();

    // Pre-filter when navigated from an RFI dashboard card
    // (e.g. /rfi-management?status=pending&auditorId=...)
    this.route.queryParamMap.subscribe(params => {
      const status = params.get('status');
      const valid = this.statusOptions.some(o => o.value === status);
      this.selectedStatuses = valid && status ? [status] : [];

      // Scope to a specific auditor (from the overview "Pending RFI Responses" card).
      this.auditorId = params.get('auditorId');

      this.currentPage = 0;

      // Arriving from the "Send RFI" quick action — open the Add RFI drawer
      // immediately so the auditor can create one right away.
      if (params.get('openAdd') === 'true') this.onAddNewRfi();
    });
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  onCompanyChange(): void {
    this.selectedDivisions = [];
    this.selectedSubDivisions = [];
    this.selectedScopes = [];
    this.selectedSubScopes = [];
  }

  onDivisionChange(): void {
    this.selectedSubDivisions = [];
    this.selectedScopes = [];
    this.selectedSubScopes = [];
  }

  onSubDivisionsChange(): void {
    this.selectedScopes = [];
    this.selectedSubScopes = [];
  }

  onScopesChange(): void {
    this.selectedSubScopes = [];
  }

  onSearch(): void { this.currentPage = 0; }

  /* ── Popover filter helpers (mirrors Evidence Repository filter panel) ───── */
  get hasActiveFilters(): boolean {
    return !!this.searchQuery.trim()
      || this.selectedCompanies.length > 0
      || this.selectedDivisions.length > 0
      || this.selectedSubDivisions.length > 0
      || this.selectedScopes.length > 0
      || this.selectedSubScopes.length > 0
      || this.selectedOwners.length > 0
      || this.selectedStatuses.length > 0;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.selectedCompanies.length)   count++;
    if (this.selectedDivisions.length)    count++;
    if (this.selectedSubDivisions.length) count++;
    if (this.selectedScopes.length)      count++;
    if (this.selectedSubScopes.length)   count++;
    if (this.selectedOwners.length)      count++;
    if (this.selectedStatuses.length)    count++;
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
    if (this.selectedScopes.length)
      chips.push({ key: 'scopes',      label: `Scope: ${this.selectedScopes.length}` });
    if (this.selectedSubScopes.length)
      chips.push({ key: 'subScopes',   label: `Sub-Scope: ${this.selectedSubScopes.length}` });
    if (this.selectedOwners.length)
      chips.push({ key: 'owners',      label: `Owner: ${this.selectedOwners.length}` });
    if (this.selectedStatuses.length)
      chips.push({ key: 'statuses',    label: `Status: ${this.selectedStatuses.length}` });
    return chips;
  }

  removeFilter(key: string): void {
    switch (key) {
      case 'companies':   this.selectedCompanies = []; this.selectedDivisions = []; this.selectedSubDivisions = []; this.selectedScopes = []; this.selectedSubScopes = []; break;
      case 'divisions':    this.selectedDivisions = []; this.selectedSubDivisions = []; this.selectedScopes = []; this.selectedSubScopes = []; break;
      case 'subDivisions': this.selectedSubDivisions = []; this.selectedScopes = []; this.selectedSubScopes = []; break;
      case 'scopes':      this.selectedScopes = []; this.selectedSubScopes = []; break;
      case 'subScopes':   this.selectedSubScopes = []; break;
      case 'owners':      this.selectedOwners = []; break;
      case 'statuses':    this.selectedStatuses = []; break;
    }
    this.currentPage = 0;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedCompanies = [];
    this.selectedDivisions = [];
    this.selectedSubDivisions = [];
    this.selectedScopes = [];
    this.selectedSubScopes = [];
    this.selectedOwners = [];
    this.selectedStatuses = [];
    this.currentPage = 0;
  }

  onOwnerChange(): void { this.currentPage = 0; }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  onRowsChange(rows: number): void {
    this.pageSize = rows;
    this.currentPage = 0;
  }

  async viewRfi(rfi: EnrichedRFI): Promise<void> {
    // if (rfi.recordStatus === 'inactive') return;
    await this.drawer.open(ViewRfi, {
      width: '850px',
      styleClass: 'add-rfi-drawer rounded-tl-[35px] rounded-bl-[35px]',
      data: { rfi, currentUser: 'auditor' } as ViewRfiDrawerData,
    }).afterClosed;
    this.refreshRfis();
  }

  async onAddNewRfi(): Promise<void> {
    await this.drawer.open(AddRfi, {
      width: '700px',
      styleClass: 'add-rfi-drawer rounded-tl-[35px] rounded-bl-[35px]',
      data: { currentUser: 'auditor' } as AddRfiDrawerData,
    }).afterClosed;
    this.refreshRfis();
  }

  rfiCardClass(rfi: EnrichedRFI): string {
    return `rfi-card rfi-card--${rfi.status}`;
  }

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'completed':    return 'success';
      case 'under-review': return 'secondary';
      case 'overdue':      return 'danger';
      case 'reopened':     return 'danger';
      default:             return 'warn';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'completed':    return 'Completed';
      case 'under-review': return 'Under Review';
      case 'overdue':      return 'Overdue';
      case 'reopened':     return 'Reopened';
      default:             return 'Pending';
    }
  }

  truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }

  /* ── Deactivate / activate ──────────────────────────────────────────────── */
  showConfirmDialog = false;
  confirmTarget: { id: string; name: string } | null = null;

  private findRfiById(id: string): EnrichedRFI | undefined {
    return this.allDivisionRFIs.find(r => r.id.toString() === id);
  }

  isBlocked(id: string): boolean {
    return this.findRfiById(id)?.recordStatus === 'inactive';
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
    const rfi = this.findRfiById(this.confirmTarget.id);
    if (rfi) {
      setStaticRfiStatus(rfi.id, rfi.recordStatus === 'inactive' ? 'active' : 'inactive');
      this.refreshRfis();
    }
    this.closeConfirm();
  }
}