import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface RfiDetail {
  id: string;
  description: string;
  subDivision: string;
  /** Division the RFI belongs to — with `subDivision` ('' for a division-level
   *  RFI), places it on the "RFIs / SLA Compliance by …" charts. */
  division?: string;
  /** Organization the RFI was sent to — powers the "RFIs by Sub-Division"
   *  organization breakdown chart and its detail drawer. */
  company: string;
  status: 'Overdue' | 'Escalated' | 'Open' | 'Closed';
  dueDate: string;
  responseDate: string;
  sla: 'Breach' | 'Met';
  // Drawer-specific fields
  priority: 'High' | 'Medium' | 'Low';
  submittedBy: string;
  submissionDate: string;
  assignedTo: string;
  category: string;
  slaTargetDays: number;
  escalationReason?: string;
  escalatedTo?: string;
  notes?: string;
}

export interface RfiDetailDrawerData {
  rfi: RfiDetail;
}

@Component({
  selector: 'app-rfi-detail-drawer',
  imports: [NgClass, TagModule, ButtonModule, DividerModule, AvatarModule, TooltipModule, BadgeModule, DrawIconComponent],
  templateUrl: './rfi-detail-drawer.html',
  styleUrl: './rfi-detail-drawer.scss',
})
export class RfiDetailDrawer {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as RfiDetailDrawerData | null;

  rfi: RfiDetail | null = this.data?.rfi ?? null;

  close(): void {
    this.drawerRef.close(null);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      Overdue: 'danger', Escalated: 'warn', Open: 'info', Closed: 'success',
    };
    return map[status] ?? 'secondary';
  }

  /** Coloured capsule class for the RFI status — matches the hero badge palette. */
  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      Overdue: 'badge--red',
      Escalated: 'badge--amber',
      Open: 'badge--blue',
      Closed: 'badge--green',
    };
    return map[status] ?? 'badge--blue';
  }

  /** Display text for the RFI status (lookups above stay keyed on the raw value). */
  statusText(status: RfiDetail['status']): string {
    switch (status) {
      case 'Overdue': return $localize`:@@dashboard.rfiDrawer.statusOverdue:Overdue`;
      case 'Escalated': return $localize`:@@dashboard.rfiDrawer.statusEscalated:Escalated`;
      case 'Open': return $localize`:@@dashboard.rfiDrawer.statusOpen:Open`;
      case 'Closed': return $localize`:@@dashboard.rfiDrawer.statusClosed:Closed`;
      default: return status;
    }
  }

  /** Display text for the priority. */
  priorityText(priority: RfiDetail['priority']): string {
    switch (priority) {
      case 'High': return $localize`:@@dashboard.rfiDrawer.priorityHigh:High`;
      case 'Medium': return $localize`:@@dashboard.rfiDrawer.priorityMedium:Medium`;
      case 'Low': return $localize`:@@dashboard.rfiDrawer.priorityLow:Low`;
      default: return priority;
    }
  }

  /** Display text for the SLA outcome. */
  slaLabel(sla: RfiDetail['sla']): string {
    return sla === 'Breach'
      ? $localize`:@@dashboard.rfiDrawer.slaBreach:Breach`
      : $localize`:@@dashboard.rfiDrawer.slaMet:Met`;
  }

  getPriorityChipClass(priority: string): string {
    return { High: 'chip--high', Medium: 'chip--medium', Low: 'chip--low' }[priority] ?? '';
  }

  /** Coloured stat-icon class for the priority tile. */
  getPriorityIconClass(priority: string): string {
    return { High: 'stat-ic--red', Medium: 'stat-ic--amber', Low: 'stat-ic--mint' }[priority] ?? 'stat-ic--blue';
  }

  getAvatarInitial(name: string): string {
    return name ? name[0].toUpperCase() : '?';
  }

  /** Up-to-two-letter initials for the avatars. */
  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }
}
