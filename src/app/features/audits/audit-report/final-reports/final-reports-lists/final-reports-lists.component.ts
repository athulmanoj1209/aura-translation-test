import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { FilterModalComponent, FilterOption } from '@/app/shared/components/filter-modal/filter-modal.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { AddNewReport } from '@/app/features/audits/audit-report/final-reports/add-new-report/add-new-report.component';
import { REPORT_TEMPLATES } from '@/app/features/audits/audit-report/report-templates/report-templates-list/report-templates-list.component';
import { ReportProfileComponent } from '@/app/features/audits/audit-report/final-reports/report-profile/report-profile.component';
import type { AddNewReportDrawerData, AddNewReportResult, ReportProfileDrawerData } from '../models/audit-report-drawer.model';
import type { AuditType, ReportPeriod, ReportStatus, AuditReportEntry } from '../models/audit-report.model';
import {
  RAW_AUDIT_REPORTS_FLAT,
  REPORTS_LIST_COMPANY_LOOKUP,
} from '../reports-lists-static-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';

// Report id follows "AUD-<division code>-<year>-<random 4-digit number>" - the
// same format used when a report is created via the Add Report drawer
// (see add-new-report.ts) - generated once here rather than on every render
// so the mock list stays stable across the page's lifetime.
export function generateReportId(divisionCode: string, createdDate: string): string {
  const year = new Date(createdDate).getFullYear();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `AUD-${divisionCode}-${year}-${randomDigits}`;
}

// Derives which specific slice of a reportPeriod a report falls into, from
// its date - e.g. a quarterly report created in March is 'Q1'. Yearly's only
// "slice" is the year itself, e.g. 'Y2025'.
export function derivePeriodZone(reportPeriod: ReportPeriod, dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth();
  switch (reportPeriod) {
    case 'monthly': return `M${month + 1}`;
    case 'quarterly': return `Q${Math.floor(month / 3) + 1}`;
    case 'half_yearly': return month < 6 ? 'H1' : 'H2';
    case 'yearly': return `Y${date.getFullYear()}`;
  }
}

const RAW_REPORTS: Array<Omit<AuditReportEntry, 'id' | 'periodZone'>> = RAW_AUDIT_REPORTS_FLAT;

export const AUDIT_REPORTS: AuditReportEntry[] = RAW_REPORTS.map(entry => ({
  ...entry,
  id: generateReportId(entry.divisionCode, entry.createdDate),
  periodZone: derivePeriodZone(entry.reportPeriod, entry.createdDate),
}));

@Component({
  selector: 'app-final-reports',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    DividerModule,
    ConfirmActionDialogComponent,
    FilterModalComponent,
    PaginationBarComponent,
    DrawIconComponent
  ],
  templateUrl: './final-reports-lists.component.html',
  styleUrl: './final-reports-lists.component.scss',
})
export class FinalReports implements OnInit {
  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);

  constructor(private router: Router) {}

  viewMode: 'grid' | 'list' = 'grid';

  /* ── Filter state ─────────────────────────────── */
  searchQuery = '';
  selectedCompanies: string[] = [];
  selectedDivisionCodes: string[] = [];
  selectedReportPeriods: string[] = [];
  selectedYears: string[] = [];
  selectedPeriodZones: string[] = [];
  currentPage = 0;
  PAGE_SIZE = 6;

  /* ── Options ─────────────────────────────────── */
  get companyFilterOptions(): FilterOption[] {
    const seen = new Set<string>();
    const options: FilterOption[] = [];
    for (const r of AUDIT_REPORTS) {
      if (!seen.has(r.companyId)) {
        seen.add(r.companyId);
        options.push({ label: this.getCompanyLabel(r.companyId), value: r.companyId });
      }
    }
    // Include companies that don't have any reports yet (e.g. newly created
    // via the Organization module) so they're still selectable here.
    for (const c of this.companyDataService.all) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        options.push({ label: c.companyName, value: c.id });
      }
    }
    // Deactivated companies shouldn't be offered as a filter option.
    return options.filter(o => !this.companyDataService.isCompanyBlocked(o.value));
  }

  get divisionFilterOptions(): FilterOption[] {
    const seen = new Set<string>();
    const options: FilterOption[] = [];
    for (const r of AUDIT_REPORTS) {
      if (this.selectedCompanies.length && !this.selectedCompanies.includes(r.companyId)) continue;
      if (!seen.has(r.divisionCode)) {
        seen.add(r.divisionCode);
        options.push({ label: r.divisionName, value: r.divisionCode });
      }
    }
    // Same reasoning as companyFilterOptions - a newly created division has no
    // reports yet, but should still show up as a filter option.
    for (const co of DIVISION_STATIC_COMPANIES) {
      if (this.selectedCompanies.length && !this.selectedCompanies.includes(co.id)) continue;
      for (const b of co.divisions) {
        if (!seen.has(b.divisionCode)) {
          seen.add(b.divisionCode);
          options.push({ label: b.divisionName, value: b.divisionCode });
        }
      }
    }
    // Deactivated divisions (or divisions under a deactivated company) shouldn't
    // be offered as a filter option.
    return options.filter(o => this.isDivisionActive(o.value));
  }

  /** True if the real division record is active and its parent company isn't blocked. */
  private isDivisionActive(divisionCode: string): boolean {
    for (const co of DIVISION_STATIC_COMPANIES) {
      const division = co.divisions.find(b => b.divisionCode === divisionCode);
      if (division) {
        return division.status === 'active' && !this.companyDataService.isCompanyBlocked(co.id);
      }
    }
    return true;
  }

  readonly reportPeriodFilterOptions: FilterOption[] = [
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Half Yearly', value: 'half_yearly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  /** Whether the specific-period field applies - hidden until a report period type is selected. */
  get periodZoneVisible(): boolean {
    return this.selectedReportPeriods.length > 0;
  }

  /** Options for the specific-period field, cascaded from the chosen report period type(s). */
  get periodZoneOptions(): FilterOption[] {
    const options: FilterOption[] = [];
    if (this.selectedReportPeriods.includes('monthly')) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach((m, i) => options.push({ label: `M${i + 1} · ${m}`, value: `M${i + 1}` }));
    }
    if (this.selectedReportPeriods.includes('quarterly')) {
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => options.push({ label: q, value: q }));
    }
    if (this.selectedReportPeriods.includes('half_yearly')) {
      ['H1', 'H2'].forEach(h => options.push({ label: h, value: h }));
    }
    if (this.selectedReportPeriods.includes('yearly')) {
      const years = new Set<number>();
      for (const r of AUDIT_REPORTS) {
        if (r.reportPeriod === 'yearly') years.add(new Date(r.createdDate).getFullYear());
      }
      Array.from(years).sort((a, b) => b - a).forEach(y => options.push({ label: `${y}`, value: `Y${y}` }));
    }
    return options;
  }

  get yearFilterOptions(): FilterOption[] {
    const years = new Set<number>();
    for (const r of AUDIT_REPORTS) {
      years.add(new Date(r.createdDate).getFullYear());
    }
    return Array.from(years)
      .sort((a, b) => b - a)
      .map(y => ({ label: `${y}`, value: `${y}` }));
  }

  /* ── Data ─────────────────────────────────────── */
  filteredReports: AuditReportEntry[] = [];
  pagedReports: AuditReportEntry[] = [];

  /* ── Lookup maps — sourced from the real company roster in
   * reports-lists-static-data.ts. ─────────────────────────────── */
  readonly companyLookup = REPORTS_LIST_COMPANY_LOOKUP;

  readonly auditTypeLabelMap: Record<AuditType, string> = {
    internal: 'Internal',
    external: 'External',
    financial: 'Financial',
    safety: 'Safety',
  };

  readonly reportPeriodLabelMap: Record<ReportPeriod, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    half_yearly: 'Half Yearly',
    yearly: 'Yearly',
  };

  readonly statusLabelMap: Record<ReportStatus, string> = {
    draft: 'Draft',
    reopened: 'Reopened',
    in_review: 'In Review',
    approved: 'Approved',
  };

  readonly statusSeverityMap: Record<ReportStatus, 'secondary' | 'warn' | 'info' | 'success'> = {
    draft: 'secondary',
    reopened: 'warn',
    in_review: 'info',
    approved: 'success',
  };

  /* ── Lifecycle ───────────────────────────────── */
  ngOnInit(): void {
    this.applyFilters();
  }

  /* ── Actions ─────────────────────────────────── */
  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  async addNewReport(): Promise<void> {
    const result = await this.drawer.open<AddNewReportResult, AddNewReportDrawerData>(AddNewReport, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'add' },
    }).afterClosed;

    if (!result) return;

    const chosenTemplate = result.templateId
      ? REPORT_TEMPLATES.find(t => t.id === result.templateId)
      : undefined;

    const today = new Date().toISOString().slice(0, 10);
    AUDIT_REPORTS.unshift({
      id: result.reportId,
      companyId: result.companyId,
      divisionName: result.divisionName,
      divisionCode: result.divisionCode,
      createdAt: new Date().toISOString(),
      reportTitle: `${this.getAuditTypeLabel(result.auditType)} Audit Report - ${result.divisionName}`,
      auditType: result.auditType,
      status: 'draft',
      createdDate: today,
      updatedDate: today,
      leadAuditor: result.leadAuditor,
      reportPeriod: result.reportPeriod,
      periodZone: result.periodZone || derivePeriodZone(result.reportPeriod, today),
      publishedByName: result.leadAuditor,
      publishedByRole: 'Report Publisher',
      reviewerName: 'Unassigned',
      reviewerRole: 'Pending Assignment',
      template: chosenTemplate
        ? {
            templateId: chosenTemplate.templateId,
            templateName: chosenTemplate.templateName,
            templateDescription: chosenTemplate.templateDescription,
            industryType: chosenTemplate.industryType,
            templateFileName: chosenTemplate.templateFileName,
            submittedByName: chosenTemplate.submittedByName,
            submittedByRole: chosenTemplate.submittedByRole,
            status: chosenTemplate.status,
          }
        : {
            templateId: null,
            templateName: `${this.getAuditTypeLabel(result.auditType)} Report Template`,
            templateDescription: 'No template selected when this report was created.',
            industryType: '',
            templateFileName: '—',
            submittedByName: result.leadAuditor,
            submittedByRole: 'Lead Auditor',
            status: 'active',
          },
    });

    this.currentPage = 0;
    this.applyFilters();
  }

  async editReport(rep: AuditReportEntry): Promise<void> {
    const result = await this.drawer.open<AddNewReportResult, AddNewReportDrawerData>(AddNewReport, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: {
        mode: 'edit',
        report: {
          id: rep.id,
          companyId: rep.companyId,
          divisionCode: rep.divisionCode,
          auditType: rep.auditType,
          createdDate: rep.createdDate,
          reportPeriod: rep.reportPeriod,
          periodZone: rep.periodZone,
          leadAuditor: rep.leadAuditor,
          templateId: rep.template.templateId,
          templateFileName: rep.template.templateFileName,
        },
      },
    }).afterClosed;

    if (!result) return;

    const target = AUDIT_REPORTS.find(r => r.id === rep.id);
    if (!target) return;

    const chosenTemplate = result.templateId
      ? REPORT_TEMPLATES.find(t => t.id === result.templateId)
      : undefined;

    target.companyId = result.companyId;
    target.divisionName = result.divisionName;
    target.divisionCode = result.divisionCode;
    target.auditType = result.auditType;
    target.reportTitle = `${this.getAuditTypeLabel(result.auditType)} Audit Report - ${result.divisionName}`;
    target.reportPeriod = result.reportPeriod;
    target.periodZone = result.periodZone || derivePeriodZone(result.reportPeriod, target.createdDate);
    target.leadAuditor = result.leadAuditor;
    target.updatedDate = new Date().toISOString().slice(0, 10);
    if (chosenTemplate) {
      target.template = {
        templateId: chosenTemplate.templateId,
        templateName: chosenTemplate.templateName,
        templateDescription: chosenTemplate.templateDescription,
        industryType: chosenTemplate.industryType,
        templateFileName: chosenTemplate.templateFileName,
        submittedByName: chosenTemplate.submittedByName,
        submittedByRole: chosenTemplate.submittedByRole,
        status: chosenTemplate.status,
      };
    }

    this.applyFilters();
  }

  viewReport(rep: AuditReportEntry): void {
    this.drawer.open<null, ReportProfileDrawerData>(ReportProfileComponent, {
      width: '760px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px] report-profile-drawer',
      data: { report: rep },
    });
  }

  /* ── Activate / deactivate ───────────────────────────────────────────────── */
  blockedIds = new Set<string>();
  showConfirmDialog = false;
  confirmTarget: { id: string; name: string } | null = null;

  isBlocked(id: string): boolean {
    return this.blockedIds.has(id);
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
    if (this.blockedIds.has(this.confirmTarget.id)) {
      this.blockedIds.delete(this.confirmTarget.id);
    } else {
      this.blockedIds.add(this.confirmTarget.id);
    }
    this.closeConfirm();
  }

  /* ── Filters ─────────────────────────────────── */
  onCompanyFilter(companies: string[]): void {
    this.selectedCompanies = companies;
    this.selectedDivisionCodes = this.selectedDivisionCodes.filter(code =>
      this.divisionFilterOptions.some(o => o.value === code)
    );
    this.currentPage = 0;
    this.applyFilters();
  }

  onDivisionFilter(divisions: string[]): void {
    this.selectedDivisionCodes = divisions;
    this.currentPage = 0;
    this.applyFilters();
  }

  onReportPeriodFilter(periods: string[]): void {
    this.selectedReportPeriods = periods;
    this.selectedPeriodZones = this.selectedPeriodZones.filter(z =>
      this.periodZoneOptions.some(o => o.value === z)
    );
    this.currentPage = 0;
    this.applyFilters();
  }

  onPeriodZoneFilter(zones: string[]): void {
    this.selectedPeriodZones = zones;
    this.currentPage = 0;
    this.applyFilters();
  }

  onYearFilter(years: string[]): void {
    this.selectedYears = years;
    this.currentPage = 0;
    this.applyFilters();
  }

  onSearch(): void {
    this.currentPage = 0;
    this.applyFilters();
  }

  onFiltersCleared(): void {
    this.selectedCompanies = [];
    this.selectedDivisionCodes = [];
    this.selectedReportPeriods = [];
    this.selectedYears = [];
    this.selectedPeriodZones = [];
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
    this.filteredReports = AUDIT_REPORTS.filter(r => {
      if (this.selectedCompanies.length && !this.selectedCompanies.includes(r.companyId)) return false;
      if (this.selectedDivisionCodes.length && !this.selectedDivisionCodes.includes(r.divisionCode)) return false;
      if (this.selectedReportPeriods.length && !this.selectedReportPeriods.includes(r.reportPeriod)) return false;
      if (this.selectedPeriodZones.length && !this.selectedPeriodZones.includes(r.periodZone)) return false;
      if (this.selectedYears.length && !this.selectedYears.includes(`${new Date(r.createdDate).getFullYear()}`)) return false;
      if (q && !r.reportTitle.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.updatePage();
  }

  private updatePage(): void {
    const start = this.currentPage * this.PAGE_SIZE;
    this.pagedReports = this.filteredReports.slice(start, start + this.PAGE_SIZE);
  }

  /* ── Display helpers ─────────────────────────── */
  getCompanyLabel(val: string): string {
    return this.companyLookup.find(c => c.id === val)?.label ?? val;
  }

  getCompanyTag(val: string): string {
    return this.companyLookup.find(c => c.id === val)?.tag ?? val.toUpperCase();
  }

  getCompanyColor(val: string): string {
    return this.companyLookup.find(c => c.id === val)?.color ?? '#102e70';
  }

  getAuditTypeLabel(val: AuditType): string {
    return this.auditTypeLabelMap[val] ?? val;
  }

  getReportPeriodLabel(val: ReportPeriod): string {
    return this.reportPeriodLabelMap[val] ?? val;
  }

  getStatusLabel(val: ReportStatus): string {
    return this.statusLabelMap[val] ?? val;
  }

  getStatusSeverity(val: ReportStatus): 'secondary' | 'warn' | 'info' | 'success' {
    return this.statusSeverityMap[val] ?? 'secondary';
  }
}
