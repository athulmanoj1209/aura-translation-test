import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DRAWER_DATA, DrawerRef } from '@/app/shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface FindingDocument {
  name: string;
  size: number;   // bytes
  url?: string;
}

export interface FindingProfileData {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  division?: string;
  scope?: string;
  subscope?: string;
  taskId?: string;
  company?: string;
  subDivision?: string;
  risk?: string;
  dueDate?: Date;
  createdAt?: Date;
  owner: { fullName: string; avatarUrl?: string; id?: string };
  description?: string;
  observationIds?: string[];
  documents?: FindingDocument[];
  financialImpact?: number;
  isRepeated?: boolean;
  flaggedForEscalation?: boolean;
  daysOverdue?: number;
}

@Component({
  selector: 'app-finding-profile',
  standalone: true,
  imports: [CommonModule, DatePipe, ButtonModule, TooltipModule, DrawIconComponent],
  templateUrl: './finding-profile.component.html',
  styleUrls: ['./finding-profile.component.scss'],
})
export class FindingProfileComponent {

  private readonly drawerRef = inject(DrawerRef) as DrawerRef<void, FindingProfileData>;

  /** Finding data injected by the drawer service */
  readonly f: FindingProfileData = inject(DRAWER_DATA) as FindingProfileData;

  /* ── Actions ────────────────────────────────────────────────── */
  close(): void { this.drawerRef.close(); }

  onDownload(doc: FindingDocument): void {
    if (doc.url) window.open(doc.url, '_blank');
  }

  /* ── Computed helpers ───────────────────────────────────────── */
  get totalFileSize(): number {
    return (this.f.documents ?? []).reduce((s, d) => s + d.size, 0);
  }

  severityLabel(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
  }

  statusLabel(s: string): string {
    if (!s) return '—';
    return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  initials(name: string): string {
    return (name ?? '')
      .split(/\s+/)
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':               return 'pi pi-file-pdf';
      case 'xls': case 'xlsx': return 'pi pi-file-excel';
      case 'doc': case 'docx': return 'pi pi-file-word';
      default:                  return 'pi pi-file';
    }
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}