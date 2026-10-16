import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';

import type {
  ScopeLibraryItem,
  RiskCategory,
} from '@/app/features/audits/libraries/audit-scope-library/models/scope-library.model';
import type { ScopeLibraryProfileDrawerData } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library-drawer.model';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-scope-library-profile',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, DividerModule, DrawIconComponent],
  templateUrl: './scope-library-profile.component.html',
  styleUrl: './scope-library-profile.component.scss',
})
export class ScopeLibraryProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as ScopeLibraryProfileDrawerData | null;

  scopeItem: ScopeLibraryItem | null = this.data?.scopeItem ?? null;

  readonly riskCategorySeverity: Record<RiskCategory, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
    'Access Management': 'info',
    'Change Management': 'contrast',
    'Vendor Risk': 'warn',
    'Financial Risk': 'success',
    'Operational Risk': 'info',
    'Compliance Risk': 'danger',
    'IT General Controls': 'secondary',
    'Data Privacy': 'warn',
    'Business Continuity': 'success',
    'Fraud Risk': 'danger',
  };

  getRiskSeverity(cat: RiskCategory): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    return this.riskCategorySeverity[cat] ?? 'secondary';
  }

  onProfileClose() {
    this.drawerRef.close(null);
  }

}
