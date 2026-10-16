import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import type { AuditReportEntry, AuditType, ReportPeriod, ReportStatus } from '@/app/features/audits/audit-report/final-reports/models/audit-report.model';
import type { ReportProfileDrawerData } from '@/app/features/audits/audit-report/final-reports/models/audit-report-drawer.model';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { FileDownloadService } from '@/app/core/services/file-download.service';

// Placeholder source used until template files are uploaded/served per-template by the backend.
const SAMPLE_TEMPLATE_FILE_URL =
  `assets/data/org-static-data/dar-exchange/${encodeURIComponent('Dar-Exchange - IA  Draft H1_2025 1.0-Template.docx')}`;

// Placeholder source used until generated report files are served per-report by the backend.
const SAMPLE_REPORT_FILE_URL =
  `assets/data/org-static-data/dar-exchange/${encodeURIComponent('ABC Broadcast - IA  Draft H1_2025 1.0-Report.docx')}`;

@Component({
  selector: 'app-report-profile',
  standalone: true,
  imports: [CommonModule, TagModule, TooltipModule, ButtonModule, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-profile.component.html',
  styleUrls: ['./report-profile.component.scss'],
})
export class ReportProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  private readonly downloader = inject(FileDownloadService);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as ReportProfileDrawerData | null;

  private readonly _report = signal<AuditReportEntry | null>(this.data?.report ?? null);
  readonly r = computed(() => this._report());

  readonly durationDays = computed<number | null>(() => {
    const report = this._report();
    if (!report) return null;
    const created = new Date(report.createdDate).getTime();
    const updated = new Date(report.updatedDate).getTime();
    if (isNaN(created) || isNaN(updated)) return null;
    return Math.max(0, Math.round((updated - created) / (24 * 3600 * 1000)));
  });

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

  private readonly auditTypeLabelMap: Record<AuditType, string> = {
    internal: 'Internal',
    external: 'External',
    financial: 'Financial',
    safety: 'Safety',
  };

  private readonly reportPeriodLabelMap: Record<ReportPeriod, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    half_yearly: 'Half Yearly',
    yearly: 'Yearly',
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

  onHide(): void {
    this.drawerRef.close(null);
  }

  getCompanyLabel(id?: string): string {
    return this.companyLabelMap[id ?? ''] ?? (id ?? '—');
  }

  getCompanyColor(id?: string): string {
    return this.companyColorMap[id ?? ''] ?? '#102e70';
  }

  auditTypeLabel(t?: AuditType): string {
    return t ? this.auditTypeLabelMap[t] : '—';
  }

  reportPeriodLabel(p?: ReportPeriod): string {
    return p ? this.reportPeriodLabelMap[p] : '—';
  }

  statusLabel(s?: ReportStatus): string {
    return s ? this.statusLabelMap[s] : '—';
  }

  statusSeverity(s?: ReportStatus): 'secondary' | 'warn' | 'info' | 'success' {
    return s ? this.statusSeverityMap[s] : 'secondary';
  }

  /** Turns a raw periodZone code ('Q1', 'M3', 'H1') into a readable label. */
  periodZoneLabel(zone?: string): string {
    if (!zone) return '';
    if (zone.startsWith('M')) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const idx = parseInt(zone.slice(1), 10) - 1;
      return months[idx] ? `${zone} · ${months[idx]}` : zone;
    }
    return zone;
  }

  industryLabel(val?: string): string {
    if (!val) return '—';
    return this.industryLabelMap[val] ?? val;
  }

  openTemplateFile(fileName: string): void {
    this.downloader.download(SAMPLE_TEMPLATE_FILE_URL, fileName || 'template-file.docx');
  }

  downloadReportFile(): void {
    const report = this.r();
    this.downloader.download(SAMPLE_REPORT_FILE_URL, `${report?.reportTitle || 'report-file'}.docx`);
  }
}
