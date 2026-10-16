import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { FilterModalComponent } from '@/app/shared/components/filter-modal/filter-modal.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';

import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { AddCompanyModalComponent } from '@/app/features/audits/organization/company/add-company-modal/add-company-modal.component';
import type { AddCompanyDrawerData, CompanyFormModel } from '@/app/features/audits/organization/company/add-company-modal/add-company-modal.component';
import { AddDivisions } from '@/app/features/audits/organization/divisions/add-divisions/add-divisions.component';
import type { AddDivisionsDrawerData, AddDivisionsDrawerResult } from '@/app/features/audits/organization/divisions/models/division-drawer.model';
import { setDivisionAuditStatus, DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';
import { AddSubDivisionComponent } from '@/app/features/audits/organization/sub-divisions/add-sub-division/add-sub-division.component';
import type { AddSubDivisionDrawerData, AddSubDivisionDrawerResult } from '@/app/features/audits/organization/sub-divisions/models/sub-division-drawer.model';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { setSubDivisionAuditStatus, SUB_DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-data';
import { noSubDivisionMessage } from '@/app/shared/utils/no-sub-division-message';
import { deriveOrganizationRequests } from '../organization-requests-static-data';
import type { OrgRequest, OrgRequestType, OrgRequestStatus, RiskLevel } from '../models/organization-request.model';

@Component({
  selector: 'app-organization-requests-list',
  imports: [CommonModule, FormsModule, InputTextModule, TooltipModule, FilterModalComponent, PaginationBarComponent, DrawIconComponent],
  templateUrl: './organization-requests-list.component.html',
  styleUrl: './organization-requests-list.component.scss',
})
export class OrganizationRequestsListComponent {
  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);

  pageSize = 8;

  readonly typeOptions = [
    { label: 'Company',    value: 'Company' },
    { label: 'Division',     value: 'Division' },
    { label: 'Sub-Division', value: 'Sub-Division' },
  ];

  readonly riskOptions = [
    { label: 'Low',    value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High',   value: 'high' },
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

  readonly allRequests = signal<OrgRequest[]>(deriveOrganizationRequests(this.companyDataService.all));

  /** Re-derives the queue from the live source records — call after any approve/reject. */
  private refresh(): void {
    this.allRequests.set(deriveOrganizationRequests(this.companyDataService.all));
  }

  /**
   * Normalizes the still-pending state for display/filtering: sub-divisions
   * store `pending_approval` (to avoid colliding with their pre-existing
   * `pending` status) while every other module uses `pending_review` — both
   * render as the same "Pending Review" chip/filter here. Divisions store an
   * approved division's audit status as `not_planned` rather than `approved`
   * — both render as the same "Approved" chip/filter here.
   */
  displayStatus(r: OrgRequest): 'pending_review' | 'approved' | 'rejected' {
    const status = r.status;
    if (status === 'pending_approval') return 'pending_review';
    if (status === 'not_planned') return 'approved';
    return status;
  }

  /** Active (non-blocked) company names, used to exclude deactivated companies from companyOptions. */
  private readonly activeCompanyNames = computed(() =>
    new Set(this.companyDataService.all.filter(c => !c.blocked).map(c => c.companyName))
  );

  /** Active division names — own status active AND parent company not blocked. */
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

  /** Active sub-division names — own status active only, no ancestor cascade. */
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
    return [...new Set(this.allRequests().map(r => r.company).filter(v => v !== '—' && active.has(v)))].sort()
      .map(v => ({ label: v, value: v }));
  });

  readonly divisionOptions = computed(() => {
    const active = this.activeDivisionNames();
    return [...new Set(this.allRequests().map(r => r.division).filter(v => v !== '—' && active.has(v)))].sort()
      .map(v => ({ label: v, value: v }));
  });

  readonly subDivisionOptions = computed(() => {
    const active = this.activeSubDivisionNames();
    return [...new Set(this.allRequests().map(r => r.subDivision).filter(v => v !== '—' && active.has(v)))].sort()
      .map(v => ({ label: v, value: v }));
  });

  /** Set when the selected divisions have no sub-divisions — disables the Sub-Division filter. */
  readonly subDivisionDisabledMessage = computed(() => noSubDivisionMessage(this.selectedDivisions()));

  readonly createdByOptions = computed(() =>
    [...new Set(this.allRequests().map(r => r.submittedBy).filter(v => v !== '—'))].sort()
      .map(v => ({ label: v, value: v }))
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
      if (types.length       && !types.includes(r.type))                    return false;
      if (risks.length       && !risks.includes(r.risk))                    return false;
      if (statuses.length    && !statuses.includes(this.displayStatus(r)))  return false;
      if (companies.length   && !companies.includes(r.company))             return false;
      if (divisions.length    && !divisions.includes(r.division))               return false;
      if (subDivisions.length && !subDivisions.includes(r.subDivision))       return false;
      if (createdBy.length   && !createdBy.includes(r.submittedBy))        return false;
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

  totalPending     = computed(() => this.allRequests().length);
  companiesCount   = computed(() => this.allRequests().filter(r => r.type === 'Company').length);
  divisionsCount    = computed(() => this.allRequests().filter(r => r.type === 'Division').length);
  subDivisionsCount = computed(() => this.allRequests().filter(r => r.type === 'Sub-Division').length);
  criticalCount    = computed(() => this.allRequests().filter(r => r.risk === 'high').length);

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

  onPageChange(page: number): void { this.currentPage.set(page + 1); }

  onRowsChange(rows: number): void {
    this.pageSize = rows;
    this.currentPage.set(1);
  }

  trackById(_: number, r: OrgRequest) { return r.id; }

  statusLabel(s: OrgRequestStatus): string {
    const map: Record<string, string> = {
      pending_review: 'Pending Review',
      pending_approval: 'Pending Review',
      rejected: 'Rejected',
      approved: 'Approved',
      not_planned: 'Approved',
    };
    return map[s] ?? s;
  }

  riskLabel(r: RiskLevel): string {
    const map: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };
    return map[r] ?? r;
  }

  typeIcon(type: OrgRequestType): string {
    const map: Record<string, string> = { Company: 'pi-building', Division: 'pi-sitemap', SubDivision: 'pi-users' };
    return map[type] ?? 'pi-tag';
  }

  async onView(r: OrgRequest): Promise<void> {
    if (r.type === 'Company') {
      const companyData: CompanyFormModel = { companyName: r.name };
      const ref = this.drawer.open<CompanyFormModel, AddCompanyDrawerData>(
        AddCompanyModalComponent,
        {
          width: '900px',
          styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
          data: { existing: companyData, type: 'Edit', approvalMode: true, requestStatus: this.displayStatus(r) },
        },
      );
      const result = await ref.afterClosed;
      if (result?.approval) {
        this.companyDataService.setOrgStatus(r.id, result.approval.action === 'approve' ? 'approved' : 'rejected');
        this.refresh();
      }
    } else if (r.type === 'Division') {
      const divisionData = { ...(r.divisionPayload as Record<string, any> ?? {}), divisionName: r.name };
      const ref = this.drawer.open<AddDivisionsDrawerResult, AddDivisionsDrawerData>(
        AddDivisions,
        {
          width: '800px',
          styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
          data: { mode: 'edit', division: divisionData, approvalMode: true, requestStatus: this.displayStatus(r) },
        },
      );
      const result = await ref.afterClosed;
      if (result?.approval) {
        // A division's "approved" state is stored as `not_planned` (its audit
        // just hasn't been scheduled yet) — see displayStatus() above.
        setDivisionAuditStatus(r.id, result.approval.action === 'approve' ? 'not_planned' : 'rejected');
        this.refresh();
      }
    } else {
      const subDivisionData = { ...(r.subDivisionPayload as Record<string, any> ?? {}), subDivisionName: r.name };
      const ref = this.drawer.open<AddSubDivisionDrawerResult, AddSubDivisionDrawerData>(
        AddSubDivisionComponent,
        {
          width: '720px',
          styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
          data: { mode: 'edit', subDivision: subDivisionData as any, approvalMode: true, requestStatus: this.displayStatus(r) },
        },
      );
      const result = await ref.afterClosed;
      if (result?.approval) {
        setSubDivisionAuditStatus(r.id, result.approval.action === 'approve' ? 'approved' : 'rejected');
        this.refresh();
      }
    }
  }
}
