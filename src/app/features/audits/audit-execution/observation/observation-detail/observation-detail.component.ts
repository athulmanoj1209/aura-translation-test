import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';
import { Observation, RiskRating, ObservationStatus } from '../observation-list/observation-list.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface ObservationDetailDrawerData { observation: Observation; }

@Component({
  selector: 'app-observation-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, DrawIconComponent],
  templateUrl: './observation-detail.component.html',
  styleUrl: './observation-detail.component.scss',
})
export class ObservationDetailComponent {
  private readonly drawerRef = inject(DrawerRef);
  readonly obs = (inject(DRAWER_DATA, { optional: true }) as ObservationDetailDrawerData).observation;

  onClose() { this.drawerRef.close(null); }

  riskLabel(r: RiskRating)          { return r.charAt(0).toUpperCase() + r.slice(1); }
  statusLabel(s: ObservationStatus) { return s.charAt(0).toUpperCase() + s.slice(1); }
}