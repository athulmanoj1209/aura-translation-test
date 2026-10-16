import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';

import type { RfiLibraryItem, RfiPriority } from '@/app/features/audits/libraries/rfi-management-library/models/rfi-library.model';
import type { RfiLibraryProfileDrawerData } from '@/app/features/audits/libraries/rfi-management-library/models/rfi-library-drawer.model';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-rfi-library-profile',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, DividerModule, DrawIconComponent],
  templateUrl: './rfi-library-profile.component.html',
  styleUrl: './rfi-library-profile.component.scss',
})
export class RfiLibraryProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as RfiLibraryProfileDrawerData | null;

  rfiItem: RfiLibraryItem | null = this.data?.rfiItem ?? null;

  readonly prioritySeverity: Record<RfiPriority, 'success' | 'info' | 'warn' | 'danger'> = {
    low: 'success',
    medium: 'info',
    high: 'warn',
    critical: 'danger',
  };

  getPrioritySeverity(p: RfiPriority): 'success' | 'info' | 'warn' | 'danger' {
    return this.prioritySeverity[p] ?? 'info';
  }

  onClose(): void {
    this.drawerRef.close(null);
  }
}
