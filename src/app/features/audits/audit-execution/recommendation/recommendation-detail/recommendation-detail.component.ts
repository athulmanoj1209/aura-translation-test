import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';
import { Recommendation, RecommendationPriority, RecommendationStatus } from '../recommendation-list/recommendation-list.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface RecommendationDetailDrawerData { recommendation: Recommendation; }

@Component({
  selector: 'app-recommendation-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, DrawIconComponent],
  templateUrl: './recommendation-detail.component.html',
  styleUrl: './recommendation-detail.component.scss',
})
export class RecommendationDetailComponent {
  private readonly drawerRef = inject(DrawerRef);
  readonly rec = (inject(DRAWER_DATA, { optional: true }) as RecommendationDetailDrawerData).recommendation;

  onClose() { this.drawerRef.close(null); }

  priorityLabel(p: RecommendationPriority) { return p.charAt(0).toUpperCase() + p.slice(1); }
  statusLabel(s: RecommendationStatus)     {
    return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  get isOverdue(): boolean {
    return this.rec.dueDate < new Date() && this.rec.status !== 'closed' && this.rec.status !== 'verified';
  }

  get daysUntilDue(): number {
    return Math.ceil((this.rec.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
}