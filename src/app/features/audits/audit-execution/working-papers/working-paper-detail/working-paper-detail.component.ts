import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';

import { FileDownloadService } from '@/app/core/services/file-download.service';
import { RiskLevel, WorkingPaper, WorkingPaperFile, WorkingPaperStatus, WorkingPaperType } from '../working-papers-list/working-papers-list.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CLIENT_MODE } from '@/app/core/config/client-mode';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';

export interface WorkingPaperDetailDrawerData {
  workingPaper: WorkingPaper;
}

@Component({
  selector: 'app-working-paper-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, DrawIconComponent],
  templateUrl: './working-paper-detail.component.html',
  styleUrl: './working-paper-detail.component.scss',
})
export class WorkingPaperDetailComponent {
  private readonly drawerRef  = inject(DrawerRef);
  private readonly downloader = inject(FileDownloadService);
  private readonly clientMode = inject(CLIENT_MODE);
  private readonly companyService = inject(CompanyDataService);
  readonly wp = (inject(DRAWER_DATA, { optional: true }) as WorkingPaperDetailDrawerData).workingPaper;

  /** Company/Branch/Department are only shown for internal-audit clients. */
  get isInternalAudit(): boolean {
    return this.clientMode === 'internal-audit';
  }

  /**
   * In internal-audit mode there's always exactly one company (the org
   * auditing itself), seeded from company-static-indi-org.data.ts via
   * CompanyDataService — so the name is read from there rather than from
   * wp.company.
   */
  get companyName(): string {
    if (this.isInternalAudit) {
      return this.companyService.all[0]?.companyName ?? this.wp.company ?? '—';
    }
    return this.wp.company ?? '—';
  }

  onClose(): void { this.drawerRef.close(null); }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':                return 'pi-file-pdf';
      case 'doc': case 'docx':   return 'pi-file-word';
      case 'xls': case 'xlsx':
      case 'csv':                return 'pi-file-excel';
      case 'png': case 'jpg':
      case 'jpeg': case 'gif':   return 'pi-image';
      case 'zip': case 'rar':    return 'pi-folder';
      default:                   return 'pi-file';
    }
  }

  get totalSize(): number {
    return this.wp.files.reduce((sum, f) => sum + f.size, 0);
  }

  downloadFile(f: WorkingPaperFile): void {
    const source = f.file ?? f.url;
    if (source) this.downloader.download(source, f.name);
  }

  canDownload(f: WorkingPaperFile): boolean {
    return !!(f.url || f.file);
  }

  /* ── Label maps ── */
  typeLabel(t: WorkingPaperType): string {
    const map: Record<WorkingPaperType, string> = {
      lead_schedule: 'Lead Schedule', test_of_controls: 'Test of Controls',
      substantive_test: 'Substantive Test', analytical_review: 'Analytical Review',
      reconciliation: 'Reconciliation', memo: 'Memorandum',
      confirmation: 'Confirmation', other: 'Other',
    };
    return map[t] ?? t;
  }

  statusLabel(s: WorkingPaperStatus): string {
    const map: Record<WorkingPaperStatus, string> = {
      draft: 'Draft', in_progress: 'In Progress', prepared: 'Prepared',
      under_review: 'Under Review', reviewed: 'Reviewed', approved: 'Approved',
      reopened: 'Reopened',
    };
    return map[s] ?? s;
  }

  riskLabel(r: RiskLevel): string {
    const map: Record<RiskLevel, string> = { high: 'High', medium: 'Medium', low: 'Low' };
    return map[r] ?? r;
  }
}