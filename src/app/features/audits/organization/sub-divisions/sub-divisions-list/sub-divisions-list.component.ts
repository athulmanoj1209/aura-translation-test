import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';

import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { SubDivisionProfileComponent } from '@/app/features/audits/organization/sub-divisions/sub-division-profile/sub-division-profile.component';
import { AddSubDivisionComponent } from '@/app/features/audits/organization/sub-divisions/add-sub-division/add-sub-division.component';
import type { AddSubDivisionDrawerData, AddSubDivisionDrawerResult, SubDivisionProfileDrawerData } from '../models/sub-division-drawer.model';
import type { StaticSubDivision } from '../models/sub-division-static.model';
import type { EnrichedSubDivision } from '../models/sub-division-list.model';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import {
  SUB_DIVISION_STATIC_COMPANIES,
  SUB_DIVISION_TYPE_OPTIONS,
  upsertStaticSubDivision,
  editStaticSubDivision,
  setSubDivisionStatus,
  USER_OPTIONS,
} from '../sub-division-static-data';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-sub-divisions-list',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    MultiSelectModule,
    InputTextModule,
    PaginatorModule,
    TagModule,
    TooltipModule,
    DividerModule,
    AvatarModule,
    ConfirmActionDialogComponent,
    PaginationBarComponent,
    DrawIconComponent
  ],
  templateUrl: './sub-divisions-list.component.html',
  styleUrl: './sub-divisions-list.component.scss',
})
export class SubDivisionsListComponent implements OnInit {

  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);

  viewMode: 'grid' | 'list' = 'grid';

  /* ── Filter state ─────────────────────────────── */
  searchQuery = '';
  selectedCompanies: string[] = [];
  selectedDivisionCodes: string[] = [];
  selectedSubDivisionTypes: string[] = [];
  currentPage = 0;
  PAGE_SIZE = 6;

  /* ── Options ─────────────────────────────────── */
  get companyFilterOptions() {
    return this.companyDataService.all
      .filter(c => !c.blocked)
      .map(c => ({ label: c.companyName, value: c.id }));
  }

  get divisionFilterOptions(): { label: string; value: string }[] {
    return DIVISION_STATIC_COMPANIES
      .filter(c => !this.selectedCompanies?.length || this.selectedCompanies.includes(c.id))
      .filter(c => !this.companyDataService.isCompanyBlocked(c.id))
      .flatMap(c => c.divisions.filter(b => b.status === 'active' && b.hasSubDivision))
      .map(b => ({ label: b.divisionName, value: b.divisionCode }));
  }

  get subDivisionTypeFilterOptions() {
    return SUB_DIVISION_TYPE_OPTIONS;
  }

  /* ── Data ─────────────────────────────────────── */
  private get allSubDivisions(): EnrichedSubDivision[] {
    const result: EnrichedSubDivision[] = [];
    for (const company of SUB_DIVISION_STATIC_COMPANIES) {
      for (const division of company.divisions) {
        // Only list sub-divisions whose live parent division has `hasSubDivision` set.
        const parent = DIVISION_STATIC_COMPANIES
          .find(c => c.id === company.id)?.divisions
          .find(d => d.divisionCode === division.divisionCode);
        if (!parent?.hasSubDivision) continue;
        for (const subDivision of division.subDivisions) {
          result.push({ ...subDivision, divisionCode: division.divisionCode, divisionName: division.divisionName });
        }
      }
    }
    return result;
  }

  filteredSubDivisions: EnrichedSubDivision[] = [];
  pagedSubDivisions: EnrichedSubDivision[] = [];
  Math = Math;

  /* ── Lookup maps ─────────────────────────────── */
  readonly riskRatingSeverity: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
    low: 'success',
    medium: 'warn',
    high: 'danger',
  };

  readonly riskStatusLabel: Record<string, string> = {
    open: 'Open',
    closed: 'Closed',
    monitored: 'Monitored',
  };

  readonly riskStatusSeverity: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
    open: 'danger',
    monitored: 'warn',
    closed: 'success',
  };

  readonly subDivisionStatusLabel: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived',
    pending: 'Pending',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  readonly subDivisionStatusSeverity: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
    active: 'success',
    pending: 'warn',
    pending_approval: 'warn',
    approved: 'success',
    rejected: 'danger',
    inactive: 'secondary',
    archived: 'secondary',
  };

  /* ── Lifecycle ───────────────────────────────── */
  ngOnInit(): void {
    this.applyFilters();
  }

  /* ── Actions ─────────────────────────────────── */
  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  truncate(value: string | null | undefined, max: number): string {
    if (!value) return '';
    return value.length > max ? value.slice(0, max).trimEnd() + '...' : value;
  }

  async addNewSubDivision(): Promise<void> {
    const result = await this.drawer.open<AddSubDivisionDrawerResult, AddSubDivisionDrawerData>(AddSubDivisionComponent, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'add', subDivision: null },
    }).afterClosed;

    if (!result?.subDivision) return;
    const company = this.companyDataService.getById(result.subDivision.company);
    upsertStaticSubDivision(result.subDivision.company, result.subDivision.divisionCode, result.subDivision, company ? {
      companyName: company.companyName,
      tag: company.tag,
      color: company.color,
      industry: company.industry,
    } : undefined);
    this.applyFilters();
  }

  viewSubDivision(subDivision: EnrichedSubDivision): void {
    this.drawer.open(SubDivisionProfileComponent, {
      width: '820px',
      styleClass: 'sub-division-profile-drawer rounded-tl-[35px] rounded-bl-[35px]',
      // `subDivision.scopes` is a lighter mock shape than the full `Scope` type this drawer
      // is normally fed with — the drawer's scope/audit fields default to blank via
      // its own `?? []` / optional-chaining fallbacks rather than crashing.
      data: { subDivision: subDivision, divisionName: subDivision.divisionName } as unknown as SubDivisionProfileDrawerData,
    });
  }

  async editSubDivision(subDivision: EnrichedSubDivision): Promise<void> {
    const result = await this.drawer.open<AddSubDivisionDrawerResult, AddSubDivisionDrawerData>(AddSubDivisionComponent, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'edit', subDivision: { ...subDivision } },
    }).afterClosed;

    if (!result?.subDivisionUpdate) return;
    editStaticSubDivision(result.previousSubDivisionCode ?? subDivision.subDivisionCode, result.subDivisionUpdate);
    this.applyFilters();
  }

  /* ── Deactivate / activate ──────────────────────────────────────────────── */
  showConfirmDialog = false;
  confirmTarget: EnrichedSubDivision | null = null;

  isBlocked(status: string): boolean {
    return status !== 'active';
  }

  openConfirm(subDivision: EnrichedSubDivision): void {
    this.confirmTarget = subDivision;
    this.showConfirmDialog = true;
  }

  closeConfirm(): void {
    this.showConfirmDialog = false;
    this.confirmTarget = null;
  }

  confirmToggle(): void {
    if (!this.confirmTarget) return;
    setSubDivisionStatus(this.confirmTarget.subDivisionCode, this.isBlocked(this.confirmTarget.status) ? 'active' : 'inactive');
    this.closeConfirm();
    this.applyFilters();
  }

  /* ── Filters ─────────────────────────────────── */
  onCompanyFilter(): void {
    this.selectedDivisionCodes = this.selectedDivisionCodes.filter(code =>
      this.divisionFilterOptions.some(o => o.value === code)
    );
    this.currentPage = 0;
    this.applyFilters();
  }

  // p-multiselect's clear (×) button only emits `onClear`, not `onChange`, and
  // resets the model to `null` rather than `[]` — reset explicitly and re-apply.
  onCompanyFilterClear(): void {
    this.selectedCompanies = [];
    this.onCompanyFilter();
  }

  onDivisionFilterClear(): void {
    this.selectedDivisionCodes = [];
    this.onDivisionFilter();
  }

  onDivisionFilter(): void {
    this.currentPage = 0;
    this.applyFilters();
  }

  onSubDivisionTypeFilter(): void {
    this.currentPage = 0;
    this.applyFilters();
  }

  onSubDivisionTypeFilterClear(): void {
    this.selectedSubDivisionTypes = [];
    this.onSubDivisionTypeFilter();
  }

  onSearch(): void {
    this.currentPage = 0;
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePage();
  }

  onRowsChange(rows: number): void {
    this.PAGE_SIZE = rows;
    this.currentPage = 0;
    this.updatePage();
  }

  private applyFilters(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredSubDivisions = this.allSubDivisions.filter(d => {
      if (this.selectedCompanies.length && !this.selectedCompanies.includes(d.company)) return false;
      if (this.selectedDivisionCodes.length && !this.selectedDivisionCodes.includes(d.divisionCode)) return false;
      if (this.selectedSubDivisionTypes.length && !this.selectedSubDivisionTypes.includes(d.departmentType ?? '')) return false;
      if (q && !d.subDivisionName.toLowerCase().includes(q) &&
        !d.divisionName.toLowerCase().includes(q) &&
        !d.contactEmail.toLowerCase().includes(q)) return false;
      return true;
    });
    // Newest-first: a sub-division just added via the drawer gets the current
    // timestamp (see upsertStaticSubDivision), so it always sorts to the top.
    this.filteredSubDivisions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.updatePage();
  }

  private updatePage(): void {
    const start = this.currentPage * this.PAGE_SIZE;
    this.pagedSubDivisions = this.filteredSubDivisions.slice(start, start + this.PAGE_SIZE);
  }

  /* ── Display helpers ─────────────────────────── */
  getCompanyLabel(val: string): string {
    return SUB_DIVISION_STATIC_COMPANIES.find(c => c.id === val)?.companyName ?? val;
  }

  getCompanyTag(val: string): string {
    return SUB_DIVISION_STATIC_COMPANIES.find(c => c.id === val)?.tag ?? val.toUpperCase();
  }

  getCompanyColor(val: string): string {
    return SUB_DIVISION_STATIC_COMPANIES.find(c => c.id === val)?.color ?? '#102e70';
  }

  getUserLabel(val: string): string {
    return USER_OPTIONS.find(u => u.value === val)?.label ?? val;
  }

  riskLabel(r: string): string {
    const m: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    return m[r] ?? r;
  }
}
