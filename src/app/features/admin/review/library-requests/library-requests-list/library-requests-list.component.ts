import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { FilterModalComponent } from '@/app/shared/components/filter-modal/filter-modal.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';

import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';
import { SUB_DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-data';
import { AddScopeLibraryComponent } from '@/app/features/audits/libraries/audit-scope-library/add-scope-library/add-scope-library.component';
import type { AddScopeLibraryDrawerData, AddScopeLibraryDrawerResult } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library-drawer.model';
import { AddRfiLibraryComponent } from '@/app/features/audits/libraries/rfi-management-library/add-rfi-library/add-rfi-library.component';
import type { AddRfiLibraryDrawerData, AddRfiLibraryDrawerResult } from '@/app/features/audits/libraries/rfi-management-library/models/rfi-library-drawer.model';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import type { ScopeLibraryItem } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library.model';
import type { RfiLibraryItem } from '@/app/features/audits/libraries/rfi-management-library/models/rfi-library.model';
import { MOCK_SCOPE_LIBRARY, setScopeLibraryStatus } from '@/app/features/audits/libraries/audit-scope-library/audit-scope-library-static-data';
import { MOCK_RFI_LIBRARY, setRfiLibraryStatus } from '@/app/features/audits/libraries/rfi-management-library/rfi-library-static-data';
import { noSubDivisionMessage } from '@/app/shared/utils/no-sub-division-message';
import { deriveLibraryRequests } from '../library-requests-static-data';
import type { LibRequest, LibRequestType, LibRequestStatus, RiskLevel } from '../models/library-request.model';

@Component({
  selector: 'app-library-requests-list',
  imports: [CommonModule, FormsModule, InputTextModule, TooltipModule, FilterModalComponent, PaginationBarComponent, DrawIconComponent],
  templateUrl: './library-requests-list.component.html',
  styleUrl: './library-requests-list.component.scss',
})
export class LibraryRequestsListComponent {
  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);

  pageSize = 8;

  readonly typeOptions = [
    { label: 'Scope',    value: 'Scope' },
    { label: 'Subscope', value: 'Subscope' },
    { label: 'RFI',      value: 'RFI' },
  ];

  readonly riskOptions = [
    { label: 'Low',      value: 'low' },
    { label: 'Medium',   value: 'medium' },
    { label: 'High',     value: 'high' },
    { label: 'Critical', value: 'critical' },
  ];

  readonly statusOptions = [
    { label: 'Pending Review', value: 'pending_review' },
    { label: 'Rejected',       value: 'rejected' },
    { label: 'Approved',       value: 'approved' },
  ];

  searchQuery         = signal('');
  selectedTypes       = signal<string[]>([]);
  selectedRisks       = signal<string[]>([]);
  selectedStatuses    = signal<string[]>([]);
  selectedCompanies   = signal<string[]>([]);
  selectedDivisions    = signal<string[]>([]);
  selectedSubDivisions = signal<string[]>([]);
  selectedCreatedBy   = signal<string[]>([]);
  viewMode    = signal<'list' | 'grid'>('grid');
  sortColumn  = signal('id');
  sortDir     = signal<'asc' | 'desc'>('asc');
  currentPage = signal(1);

  readonly allRequests = signal<LibRequest[]>(deriveLibraryRequests(MOCK_SCOPE_LIBRARY, MOCK_RFI_LIBRARY));

  /** Re-derives the queue from the live source records — call after any approve/reject. */
  private refresh(): void {
    this.allRequests.set(deriveLibraryRequests(MOCK_SCOPE_LIBRARY, MOCK_RFI_LIBRARY));
  }

  /** Active (non-blocked) company names, resolved via the real CompanyDataService (not this module's own display-only company lookup). */
  private readonly activeCompanyNames = computed(() =>
    new Set(this.companyDataService.all.filter(c => !c.blocked).map(c => c.companyName))
  );

  /** Active division names — own status active AND parent company not blocked, matched by division name. */
  private readonly activeDivisionNames = computed(() => {
    const names = new Set<string>();
    for (const company of DIVISION_STATIC_COMPANIES) {
      if (this.companyDataService.isCompanyBlocked(company.id)) continue;
      for (const division of company.divisions) {
        if (division.status === 'active') names.add(division.divisionName);
      }
    }
    return names;
  });

  /** Active sub-division names — own status active only, matched by sub-division name. */
  private readonly activeSubDivisionNames = computed(() => {
    const names = new Set<string>();
    for (const company of SUB_DIVISION_STATIC_COMPANIES) {
      for (const division of company.divisions) {
        for (const dept of division.subDivisions) {
          if (dept.status === 'active') names.add(dept.subDivisionName);
        }
      }
    }
    return names;
  });

  readonly companyOptions = computed(() => {
    const active = this.activeCompanyNames();
    return [...new Set(this.allRequests().map(r => r.company).filter(v => active.has(v)))].sort().map(v => ({ label: v, value: v }));
  });

  readonly divisionOptions = computed(() => {
    const active = this.activeDivisionNames();
    return [...new Set(this.allRequests().map(r => r.division).filter(v => active.has(v)))].sort().map(v => ({ label: v, value: v }));
  });

  readonly subDivisionOptions = computed(() => {
    const active = this.activeSubDivisionNames();
    return [...new Set(this.allRequests().map(r => r.subDivision).filter(v => active.has(v)))].sort().map(v => ({ label: v, value: v }));
  });

  /** Set when the selected divisions have no sub-divisions — disables the Sub-Division filter. */
  readonly subDivisionDisabledMessage = computed(() => noSubDivisionMessage(this.selectedDivisions()));

  readonly createdByOptions = computed(() =>
    [...new Set(this.allRequests().map(r => r.submittedBy))].sort().map(v => ({ label: v, value: v }))
  );

  filtered = computed(() => {
    const q           = this.searchQuery().toLowerCase();
    const types       = this.selectedTypes();
    const risks       = this.selectedRisks();
    const statuses    = this.selectedStatuses();
    const companies   = this.selectedCompanies();
    const divisions    = this.selectedDivisions();
    const subDivisions = this.selectedSubDivisions();
    const createdBy   = this.selectedCreatedBy();
    const col = this.sortColumn();
    const dir = this.sortDir();

    let result = this.allRequests().filter(r => {
      if (q && !r.id.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !r.submittedBy.toLowerCase().includes(q)) return false;
      if (types.length       && !types.includes(r.type))             return false;
      if (risks.length       && !risks.includes(r.risk))             return false;
      if (statuses.length    && !statuses.includes(r.status))        return false;
      if (companies.length   && !companies.includes(r.company))      return false;
      if (divisions.length    && !divisions.includes(r.division))        return false;
      if (subDivisions.length && !subDivisions.includes(r.subDivision)) return false;
      if (createdBy.length   && !createdBy.includes(r.submittedBy))  return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      const av = (a as any)[col] ?? '';
      const bv = (b as any)[col] ?? '';
      return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    return result;
  });

  paginated = computed(() => {
    const page = this.currentPage();
    return this.filtered().slice((page - 1) * this.pageSize, page * this.pageSize);
  });

  totalPending   = computed(() => this.allRequests().length);
  scopesCount    = computed(() => this.allRequests().filter(r => r.type === 'Scope').length);
  subscopesCount = computed(() => this.allRequests().filter(r => r.type === 'Subscope').length);
  rfisCount      = computed(() => this.allRequests().filter(r => r.type === 'RFI').length);
  criticalCount  = computed(() => this.allRequests().filter(r => r.risk === 'high' || r.risk === 'critical').length);

  hasFilters = computed(() =>
    !!this.searchQuery()
    || !!this.selectedTypes().length
    || !!this.selectedRisks().length
    || !!this.selectedStatuses().length
    || !!this.selectedCompanies().length
    || !!this.selectedDivisions().length
    || !!this.selectedSubDivisions().length
    || !!this.selectedCreatedBy().length
  );

  onSearch(q: string)        { this.searchQuery.set(q);         this.currentPage.set(1); }
  onTypes(v: string[])       { this.selectedTypes.set(v);       this.currentPage.set(1); }
  onRisks(v: string[])       { this.selectedRisks.set(v);       this.currentPage.set(1); }
  onStatuses(v: string[])    { this.selectedStatuses.set(v);    this.currentPage.set(1); }
  onCompanies(v: string[])   { this.selectedCompanies.set(v);   this.currentPage.set(1); }
  onDivisions(v: string[]) {
    this.selectedDivisions.set(v);
    if (noSubDivisionMessage(v)) this.selectedSubDivisions.set([]);
    this.currentPage.set(1);
  }
  onSubDivisions(v: string[]) { this.selectedSubDivisions.set(v); this.currentPage.set(1); }
  onCreatedBy(v: string[])   { this.selectedCreatedBy.set(v);   this.currentPage.set(1); }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedTypes.set([]);
    this.selectedRisks.set([]);
    this.selectedStatuses.set([]);
    this.selectedCompanies.set([]);
    this.selectedDivisions.set([]);
    this.selectedSubDivisions.set([]);
    this.selectedCreatedBy.set([]);
    this.currentPage.set(1);
  }

  setViewMode(mode: 'list' | 'grid') { this.viewMode.set(mode); this.currentPage.set(1); }

  onSort(col: string) {
    if (this.sortColumn() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDir.set('asc');
    }
  }

  sortIconFor(col: string): string {
    if (this.sortColumn() !== col) return 'pi-sort-alt';
    return this.sortDir() === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down-alt';
  }

  onPageChange(page: number) { this.currentPage.set(page + 1); }

  onRowsChange(rows: number) {
    this.pageSize = rows;
    this.currentPage.set(1);
  }

  trackById(_: number, r: LibRequest) { return r.id; }

  statusLabel(s: LibRequestStatus): string {
    const map: Record<string, string> = {
      pending_review: 'Pending Review',
      rejected: 'Rejected',
      approved: 'Approved',
    };
    return map[s] ?? s;
  }

  riskLabel(r: RiskLevel): string {
    const map: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    return map[r] ?? r;
  }

  typeIcon(type: LibRequestType): string {
    const map: Record<string, string> = { Scope: 'pi-folder', Subscope: 'pi-file-check', RFI: 'pi-envelope' };
    return map[type] ?? 'pi-tag';
  }

  async onView(r: LibRequest): Promise<void> {
    if (r.type === 'Scope' || r.type === 'Subscope') {
      const scopeItem = r.scopePayload as ScopeLibraryItem;
      const ref = this.drawer.open<AddScopeLibraryDrawerResult, AddScopeLibraryDrawerData>(
        AddScopeLibraryComponent,
        {
          width: '640px',
          styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
          data: { mode: 'edit', approvalMode: true, requestStatus: r.status, scopeItem, allScopes: MOCK_SCOPE_LIBRARY },
        },
      );
      const result = await ref.afterClosed;
      if (result?.approval) {
        setScopeLibraryStatus(r.id, result.approval.action === 'approve' ? 'approved' : 'rejected');
        this.refresh();
      }
    } else {
      const rfiItem = r.rfiPayload as RfiLibraryItem;
      const ref = this.drawer.open<AddRfiLibraryDrawerResult, AddRfiLibraryDrawerData>(
        AddRfiLibraryComponent,
        {
          width: '640px',
          styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
          data: { mode: 'edit', approvalMode: true, requestStatus: r.status, rfiItem, allScopes: MOCK_SCOPE_LIBRARY },
        },
      );
      const result = await ref.afterClosed;
      if (result?.approval) {
        setRfiLibraryStatus(r.id, result.approval.action === 'approve' ? 'approved' : 'rejected');
        this.refresh();
      }
    }
  }
}