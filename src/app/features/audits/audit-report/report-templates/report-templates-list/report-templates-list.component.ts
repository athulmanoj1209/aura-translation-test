import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { DialogModule } from 'primeng/dialog';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { AddAuditReport, EditReportTemplateData } from '@/app/features/audits/audit-report/report-templates/add-audit-report/add-audit-report.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { TemplateProfileComponent } from '@/app/features/audits/audit-report/report-templates/template-profile/template-profile.component';
import type { TemplateProfileDrawerData } from '../models/report-template-drawer.model';
import {
  REPORT_TEMPLATE_STATIC_COMPANIES,
  REPORT_TEMPLATES_FLAT,
  REPORT_COMPANY_LOOKUP,
  upsertStaticReportTemplate,
} from '../report-templates-static-data';
import type { ReportTemplate } from '../models/report-template.model';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';

/** Real company/division roster (see report-templates-static-data.ts) — used to build the company/division dropdown options. */
export { REPORT_TEMPLATE_STATIC_COMPANIES };

export const REPORT_TEMPLATES: ReportTemplate[] = REPORT_TEMPLATES_FLAT;

@Component({
  selector: 'app-report-templates-list',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    MultiSelectModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    DividerModule,
    DialogModule,
    ConfirmActionDialogComponent,
    AddAuditReport,
    PaginationBarComponent,
    DrawIconComponent
  ],
  templateUrl: './report-templates-list.component.html',
  styleUrl: './report-templates-list.component.scss',
})
export class ReportTemplatesListComponent implements OnInit {
  private readonly drawer = inject(RightDrawerService);
  private readonly companyDataService = inject(CompanyDataService);

  viewMode: 'grid' | 'list' = 'grid';

  /* ── Filter state ─────────────────────────────── */
  searchQuery = '';
  selectedCompanies: string[] = [];
  selectedDivisionCodes: string[] = [];
  currentPage = 0;
  reportDialogWidth = 'min(760px, 95vw)';
  /** Drives the `add-report-template-dialog--wide` CSS class (see report-templates.scss) -
   * the p-dialog's OnPush container only picks up the plain `[style]` width object
   * unreliably once it's already open, so the resize to 900px during template
   * parsing is forced via a `!important` class instead. */
  isProcessingWide = false;
  PAGE_SIZE = 6;

  /* ── Options ─────────────────────────────────── */
  get companyFilterOptions(): { label: string; value: string }[] {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const t of REPORT_TEMPLATES) {
      if (!seen.has(t.companyId)) {
        seen.add(t.companyId);
        options.push({ label: this.getCompanyLabel(t.companyId), value: t.companyId });
      }
    }
    // Include companies that don't have any report templates yet (e.g. newly
    // created via the Organization module) so they're still selectable here.
    for (const c of this.companyDataService.all) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        options.push({ label: c.companyName, value: c.id });
      }
    }
    // Deactivated companies shouldn't be offered as a filter option.
    return options.filter(o => !this.companyDataService.isCompanyBlocked(o.value));
  }

  get divisionFilterOptions(): { label: string; value: string }[] {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const t of REPORT_TEMPLATES) {
      if (this.selectedCompanies.length && !this.selectedCompanies.includes(t.companyId)) continue;
      if (!seen.has(t.divisionCode)) {
        seen.add(t.divisionCode);
        options.push({ label: t.divisionName, value: t.divisionCode });
      }
    }
    // Same reasoning as companyFilterOptions - a newly created division has no
    // report templates yet, but should still show up as a filter option.
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

  /* ── Data ─────────────────────────────────────── */
  filteredTemplates: ReportTemplate[] = [];
  pagedTemplates: ReportTemplate[] = [];

  /* ── Lookup maps — sourced from the real company roster in
   * report-templates-static-data.ts. ─────────────────────────────── */
  readonly companyLookup = REPORT_COMPANY_LOOKUP;

  readonly industryLabelMap: Record<string, string> = {
    banking: 'Banking & Finance',
    real_estate: 'Real Estate',
    retail: 'Retail & Trading',
    manufacturing: 'Manufacturing',
    technology: 'Technology',
    healthcare: 'Healthcare',
    construction: 'Construction',
    professional_services: 'Professional Services',
  };

  /* ── Lifecycle ───────────────────────────────── */
  ngOnInit(): void {
    this.applyFilters();
  }

  /* ── Actions ─────────────────────────────────── */
  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  showAddReportDialog = false;

  addNewReportTemplate(): void {
    this.showAddReportDialog = true;
    this.isProcessingWide = false;
    this.reportDialogWidth = 'min(760px, 95vw)';
  }

  closeAddReportDialog(): void {
    this.showAddReportDialog = false;
    this.isProcessingWide = false;
    this.reportDialogWidth = 'min(760px, 95vw)';
  }

  /* ── View ─────────────────────────────────────────────────────────────────── */
  viewTemplate(tpl: ReportTemplate): void {
    this.drawer.open<null, TemplateProfileDrawerData>(TemplateProfileComponent, {
      width: '820px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px] template-profile-drawer',
      data: { template: tpl },
    });
  }

  /* ── Edit ─────────────────────────────────────────────────────────────────── */
  showEditDialog = false;
  editTarget: ReportTemplate | null = null;

  openEdit(tpl: ReportTemplate): void {
    this.editTarget = tpl;
    this.showEditDialog = true;
  }

  closeEditDialog(): void {
    this.showEditDialog = false;
    this.editTarget = null;
  }

  onTemplateSaved(updated: EditReportTemplateData): void {
    const index = REPORT_TEMPLATES.findIndex(t => t.id === updated.id);
    if (index !== -1) {
      REPORT_TEMPLATES[index] = { ...REPORT_TEMPLATES[index], ...updated };
    }
    if (updated.status === 'inactive') {
      this.blockedIds.add(updated.id);
    } else {
      this.blockedIds.delete(updated.id);
    }
    this.closeEditDialog();
    this.applyFilters();
  }

  onTemplateCreated(data: EditReportTemplateData): void {
    console.log("template created:", data);
    // companyMeta/divisionMeta let upsertStaticReportTemplate self-heal a
    // missing wrapper node when the chosen company/division has no report
    // templates yet (see the comment on upsertStaticReportTemplate itself).
    const company = this.companyDataService.getById(data.companyId);
    const record = upsertStaticReportTemplate(
      data.companyId,
      data.divisionCode,
      {
        id: data.id,
        templateId: data.templateId,
        templateName: data.templateName,
        templateDescription: data.templateDescription,
        industryType: data.industryType,
        templateFileName: data.templateFileName,
        status: data.status,
      },
      company ? { companyName: company.companyName, tag: company.tag ?? company.id.toUpperCase(), color: company.color ?? '#102e70' } : undefined,
      { divisionName: data.divisionName },
    );
    if (record && record.status === 'inactive') {
      this.blockedIds.add(record.id);
    }
    this.applyFilters();
  }

  /* ── Activate / deactivate ───────────────────────────────────────────────── */
  blockedIds = new Set<string>(REPORT_TEMPLATES.filter(t => t.status === 'inactive').map(t => t.id));
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
    const template = REPORT_TEMPLATES.find(t => t.id === this.confirmTarget!.id);
    if (this.blockedIds.has(this.confirmTarget.id)) {
      this.blockedIds.delete(this.confirmTarget.id);
      if (template) template.status = 'active';
    } else {
      this.blockedIds.add(this.confirmTarget.id);
      if (template) template.status = 'inactive';
    }
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

  onDivisionFilter(): void {
    this.currentPage = 0;
    this.applyFilters();
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

  onProcessingStarted(isProcessing: boolean): void {
    this.isProcessingWide = isProcessing;
    if (isProcessing) {
      this.reportDialogWidth = '900px';
    }
  }

  private applyFilters(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredTemplates = REPORT_TEMPLATES.filter(t => {
      if (this.selectedCompanies.length && !this.selectedCompanies.includes(t.companyId)) return false;
      if (this.selectedDivisionCodes.length && !this.selectedDivisionCodes.includes(t.divisionCode)) return false;
      if (q && !t.templateName.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.updatePage();
  }

  private updatePage(): void {
    const start = this.currentPage * this.PAGE_SIZE;
    this.pagedTemplates = this.filteredTemplates.slice(start, start + this.PAGE_SIZE);
  }

  /* ── Display helpers ─────────────────────────── */
  // companyLookup (REPORT_COMPANY_LOOKUP) is computed once at module load, so
  // a company self-healed into REPORT_TEMPLATE_STATIC_COMPANIES afterwards
  // (see onTemplateCreated()) never appears there - fall back to the live
  // CompanyDataService before giving up on a raw id/default.
  getCompanyLabel(val: string): string {
    return this.companyLookup.find(c => c.id === val)?.label
      ?? this.companyDataService.getById(val)?.companyName
      ?? val;
  }

  getCompanyTag(val: string): string {
    return this.companyLookup.find(c => c.id === val)?.tag
      ?? this.companyDataService.getById(val)?.tag
      ?? val.toUpperCase();
  }

  getCompanyColor(val: string): string {
    return this.companyLookup.find(c => c.id === val)?.color
      ?? this.companyDataService.getById(val)?.color
      ?? '#102e70';
  }

  getIndustryLabel(val: string): string {
    return this.industryLabelMap[val] ?? val;
  }
}
