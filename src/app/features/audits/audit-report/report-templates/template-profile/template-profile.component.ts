import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PaginatorModule } from 'primeng/paginator';

import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import type { ReportTemplate } from '@/app/features/audits/audit-report/report-templates/models/report-template.model';
import type { TemplateProfileDrawerData } from '@/app/features/audits/audit-report/report-templates/models/report-template-drawer.model';
import { AUDIT_REPORTS } from '@/app/features/audits/audit-report/final-reports/final-reports-lists/final-reports-lists.component';
import type { AuditReportEntry, ReportStatus } from '@/app/features/audits/audit-report/final-reports/models/audit-report.model';
import { FileDownloadService } from '@/app/core/services/file-download.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// Placeholder source used until template files are uploaded/served per-template by the backend.
const SAMPLE_TEMPLATE_FILE_URL =
  `assets/data/org-static-data/dar-exchange/${encodeURIComponent('ABC Broadcast - IA  Draft H1_2025 1.0-Template.docx')}`;

@Component({
  selector: 'app-template-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TagModule,
    TooltipModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    PaginatorModule,
  
    DrawIconComponent,],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-profile.component.html',
  styleUrls: ['./template-profile.component.scss'],
})
export class TemplateProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  private readonly downloader = inject(FileDownloadService);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as TemplateProfileDrawerData | null;

  private readonly _template = signal<ReportTemplate | null>(this.data?.template ?? null);
  readonly t = computed(() => this._template());

  /** Every report in the system generated from this template. */
  readonly linkedReports = computed<AuditReportEntry[]>(() => {
    const tpl = this._template();
    if (!tpl) return [];
    return AUDIT_REPORTS.filter(r => r.template?.templateName === tpl.templateName && r.companyId === tpl.companyId);
  });

  // ─── Linked-reports search & pagination ───────────────
  readonly REPORTS_PAGE_SIZE = 4;

  private readonly _reportSearch = signal('');
  private readonly _reportsFirst = signal(0);

  readonly filteredReports = computed(() => {
    const q = this._reportSearch().toLowerCase().trim();
    const list = this.linkedReports();
    return q ? list.filter(r => r.reportTitle.toLowerCase().includes(q)) : list;
  });

  readonly pagedReports = computed(() =>
    this.filteredReports().slice(this._reportsFirst(), this._reportsFirst() + this.REPORTS_PAGE_SIZE)
  );

  getReportSearch(): string { return this._reportSearch(); }
  setReportSearch(q: string): void { this._reportSearch.set(q); this._reportsFirst.set(0); }
  getReportsFirst(): number { return this._reportsFirst(); }
  onReportsPageChange(event: { first?: number }): void { this._reportsFirst.set(event.first ?? 0); }

  private readonly companyLabelMap: Record<string, string> = {
    'crowe-uae': 'Crowe UAE',
    'crowe-ksa': 'Crowe KSA',
    'crowe-bahrain': 'Crowe Bahrain',
    'crowe-kuwait': 'Crowe Kuwait',
  };

  private readonly companyColorMap: Record<string, string> = {
    'crowe-uae': '#1a6fc4',
    'crowe-ksa': '#2d8a4e',
    'crowe-bahrain': '#c47a1a',
    'crowe-kuwait': '#8a1ac4',
  };

  private readonly industryLabelMap: Record<string, string> = {
    banking: 'Banking & Finance',
    real_estate: 'Real Estate',
    retail: 'Retail & Trading',
    manufacturing: 'Manufacturing',
    technology: 'Technology',
    healthcare: 'Healthcare',
    construction: 'Construction',
    professional_services: 'Professional Services',
  };

  private readonly statusLabelMap: Record<ReportStatus, string> = {
    draft: 'Draft',
    reopened: 'Reopened',
    in_review: 'In Review',
    approved: 'Approved',
  };

  private readonly statusSeverityMap: Record<ReportStatus, 'secondary' | 'warn' | 'info' | 'success'> = {
    draft: 'secondary',
    reopened: 'warn',
    in_review: 'info',
    approved: 'success',
  };

  onHide(): void {
    this.drawerRef.close(null);
  }

  downloadTemplateFile(): void {
    const tpl = this.t();
    if (!tpl) return;
    this.downloader.download(SAMPLE_TEMPLATE_FILE_URL, tpl.templateFileName || 'template-file.docx');
  }

  getCompanyLabel(id?: string): string {
    return this.companyLabelMap[id ?? ''] ?? (id ?? '—');
  }

  getCompanyColor(id?: string): string {
    return this.companyColorMap[id ?? ''] ?? '#102e70';
  }

  industryLabel(val?: string): string {
    if (!val) return '—';
    return this.industryLabelMap[val] ?? val;
  }

  statusLabel(s?: ReportStatus): string {
    return s ? this.statusLabelMap[s] : '—';
  }

  statusSeverity(s?: ReportStatus): 'secondary' | 'warn' | 'info' | 'success' {
    return s ? this.statusSeverityMap[s] : 'secondary';
  }
}
