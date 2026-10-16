import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DRAWER_DATA, DrawerRef } from '@/app/shared/components/drawer-ref';
import { Evidence, EvidenceFile, EvidenceType } from '../evidence-list/evidence-list.component';
import { FileDownloadService } from '@/app/core/services/file-download.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface EvidenceDetailDrawerData {
  evidence: Evidence;
}

@Component({
  selector: 'app-evidence-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, DrawIconComponent],
  templateUrl: './evidence-detail.component.html',
  styleUrl: './evidence-detail.component.scss',
})
export class EvidenceDetailComponent {
  private readonly drawerRef   = inject(DrawerRef);
  private readonly downloader  = inject(FileDownloadService);
  readonly ev = (inject(DRAWER_DATA, { optional: true }) as EvidenceDetailDrawerData).evidence;

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
      case 'xls': case 'xlsx':   return 'pi-file-excel';
      case 'png': case 'jpg':
      case 'jpeg': case 'gif':   return 'pi-image';
      case 'zip': case 'rar':    return 'pi-folder';
      default:                   return 'pi-file';
    }
  }

  get totalSize(): number {
    return this.ev.files.reduce((sum, f) => sum + f.size, 0);
  }

  downloadFile(f: EvidenceFile): void {
    const source = f.file ?? f.url;
    if (source) this.downloader.download(source, f.name);
  }

  canDownload(f: EvidenceFile): boolean {
    return !!(f.url || f.file);
  }

  evidenceTypeLabel(t: EvidenceType): string {
    const map: Record<EvidenceType, string> = {
      document: 'Document', screenshot: 'Screenshot',
      interview_notes: 'Interview Notes', system_log: 'System Log',
      email: 'Email', physical_inspection: 'Physical Inspection', other: 'Other',
    };
    return map[t] ?? t;
  }
}