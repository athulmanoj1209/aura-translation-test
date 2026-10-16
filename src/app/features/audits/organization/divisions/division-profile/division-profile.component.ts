import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import type { Division } from '@/app/features/audits/organization/divisions/models/division.model';
import type { DivisionProfileDrawerData } from '@/app/features/audits/organization/divisions/models/division-drawer.model';
import { SUB_DIVISION_TYPE_OPTIONS } from '@/app/features/audits/organization/sub-divisions/sub-division-static-data';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-division-profile',
  standalone: true,
  imports: [CommonModule, TagModule, TooltipModule, ButtonModule, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './division-profile.component.html',
  styleUrls: ['./division-profile.component.scss'],
})
export class DivisionProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as DivisionProfileDrawerData | null;

  private readonly _division = signal<Division | null>(this.data?.division ?? null);

  readonly b = computed(() => this._division());

  readonly yearsOperational = computed<number | null>(() => {
    const d = this._division()?.operationalSince;
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000)));
  });

  readonly licenseExpiryInfo = computed<{ label: string; tone: 'ok' | 'warn' | 'expired' } | null>(() => {
    const d = this._division()?.licenseExpiryDate;
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    const days = Math.floor((date.getTime() - Date.now()) / (24 * 3600 * 1000));
    if (days < 0) return { label: `Expired ${Math.abs(days)} days ago`, tone: 'expired' };
    if (days < 60) return { label: `Expires in ${days} days`, tone: 'warn' };
    return { label: `Expires in ${days} days`, tone: 'ok' };
  });

  onHide(): void {
    this.drawerRef.close(null);
  }

  divisionTypeLabel(t?: string): string {
    const m: Record<string, string> = {
      head_office: 'Head Office', branch: 'Branch', department: 'Department', representative_office: 'Rep. Office',
      warehouse: 'Warehouse', factory: 'Factory', project_office: 'Project Office', subsidiary: 'Subsidiary',
    };
    return m[t ?? ''] ?? (t ?? '—');
  }

  departmentTypeLabel(t?: string | null): string {
    return SUB_DIVISION_TYPE_OPTIONS.find(o => o.value === t)?.label ?? (t ?? '—');
  }

  countryLabel(c?: string): string {
    const m: Record<string, string> = { ae: 'UAE', sa: 'Saudi Arabia', bh: 'Bahrain', kw: 'Kuwait' };
    return m[c ?? ''] ?? (c?.toUpperCase() ?? '—');
  }

  emirateLabel(e?: string): string {
    const m: Record<string, string> = {
      dubai: 'Dubai', abudhabi: 'Abu Dhabi', sharjah: 'Sharjah', fujairah: 'Fujairah',
      rak: 'Ras Al Khaimah', ajman: 'Ajman', ummalquwain: 'Umm Al Quwain', khorfakkan: 'Khorfakkan',
      riyadh: 'Riyadh Province', makkah: 'Makkah Province', eastern: 'Eastern Province',
      tabuk: 'Tabuk Province', madinah: 'Al Madinah Province',
      capital: 'Capital', southern: 'Southern', muharraq: 'Muharraq',
      central: 'Central', northern: 'Northern',
      hawalli: 'Hawalli', jahra: 'Jahra', ahmadi: 'Ahmadi', farwaniya: 'Farwaniya',
      mubarak: 'Mubarak Al-Kabeer',
    };
    return m[e ?? ''] ?? (e ?? '—');
  }

  riskSeverity(r?: string): 'success' | 'warn' | 'danger' | 'secondary' {
    return r === 'low' ? 'success' : r === 'medium' ? 'warn' : r === 'high' ? 'danger' : 'secondary';
  }

  riskLabel(r?: string): string {
    const m: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    return m[r ?? ''] ?? (r ?? '—');
  }

  auditLabel(s?: string): string {
    const m: Record<string, string> = {
      completed: 'Completed', in_progress: 'In Progress', planned: 'Planned', not_planned: 'Not Planned',
    };
    return m[s ?? ''] ?? (s ?? '—');
  }

  auditSeverity(s?: string): 'success' | 'info' | 'warn' | 'secondary' {
    const m: Record<string, 'success' | 'info' | 'warn' | 'secondary'> = {
      completed: 'success', in_progress: 'info', planned: 'warn', not_planned: 'secondary',
    };
    return m[s ?? ''] ?? 'secondary';
  }

  sectorLabel(s?: string): string {
    const m: Record<string, string> = {
      professional_services: 'Professional Services', financial_services: 'Financial Services',
      retail: 'Retail', manufacturing: 'Manufacturing', technology: 'Technology', healthcare: 'Healthcare',
    };
    return m[s ?? ''] ?? (s?.replace(/_/g, ' ') ?? '—');
  }

  riskStatusLabel(s?: string): string {
    const m: Record<string, string> = { open: 'Open', closed: 'Closed', monitored: 'Monitored' };
    return m[s ?? ''] ?? (s ?? '—');
  }

  subDivisionStatusSeverity(s?: string): 'success' | 'secondary' {
    return s === 'active' ? 'success' : 'secondary';
  }
}
