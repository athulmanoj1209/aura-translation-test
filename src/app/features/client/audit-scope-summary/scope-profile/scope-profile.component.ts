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
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule } from 'primeng/paginator';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

import { AUDITOR_PROFILES, REVIEWER_PROFILES } from '@/app/features/audits/organization/divisions/divisions-list/divisions-list.component';
import type { Scope, SubScope } from '@/app/features/audits/organization/divisions/models/division.model';
import type { PersonnelProfile, ReviewerProfile } from '@/app/features/audits/organization/divisions/models/personnel-profile.model';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { PersonnelPanelComponent } from '@/app/shared/components/personnel-panel/personnel-panel.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { resolveScopeOrgLabels } from '@/app/shared/utils/no-sub-division-message';
import type { ScopeOrgLabels } from '@/app/shared/utils/no-sub-division-message';

export interface ScopeProfileDrawerData {
  scope: Scope | null;
  subscope?: SubScope | null;
  parentName?: string;
}

@Component({
  selector: 'app-scope-profile',
  standalone: true,
  imports: [CommonModule, TagModule, TooltipModule, ButtonModule, ChipModule, DividerModule, ProgressBarModule, PaginatorModule, IconFieldModule, InputIconModule, InputTextModule, PersonnelPanelComponent, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scope-profile.component.html',
  styleUrls: ['./scope-profile.component.scss'],
})
export class ScopeProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as ScopeProfileDrawerData | null;

  private readonly _scope = signal<Scope | null>(this.data?.scope ?? null);
  private readonly _subscope = signal<SubScope | null>(this.data?.subscope ?? null);
  private readonly _parentName = signal(this.data?.parentName ?? '');

  readonly isSubscopeMode = computed(() => !!this._subscope());

  readonly displayName = computed(() =>
    this._subscope()?.subScopeName ?? this._scope()?.scopeName ?? ''
  );

  readonly displayType = computed(() =>
    this._subscope()?.subScopeType ?? this._scope()?.scopeType ?? ''
  );

  readonly displayAuditFrequency = computed(() =>
    this._subscope()?.auditFrequency ?? this._scope()?.auditFrequency ?? ''
  );

  readonly displayModeOfAudit = computed(() =>
    this._subscope()?.modeOfAudit ?? this._scope()?.modeOfAudit ?? ''
  );

  readonly displaySamplingMethodology = computed(() =>
    this._subscope()?.samplingMethodology ?? this._scope()?.samplingMethodology ?? ''
  );

  readonly displaySamplingSize = computed(() =>
    this._subscope()?.samplingSize ?? this._scope()?.samplingSize ?? null
  );

  readonly displayStartDate = computed(() =>
    this._subscope()?.startDate ?? this._scope()?.startDate ?? ''
  );

  readonly displayEndDate = computed(() =>
    this._subscope()?.endDate ?? this._scope()?.endDate ?? ''
  );

  readonly displayAssignedAuditors = computed<PersonnelProfile[]>(() => {
    const ids = this._subscope()?.assignedAuditors ?? this._scope()?.assignedAuditors ?? [];
    return ids.map(id => AUDITOR_PROFILES[id]).filter((p): p is PersonnelProfile => !!p);
  });

  readonly displayAssignedReviewers = computed<ReviewerProfile[]>(() => {
    const ids = this._subscope()?.assignedReviewers ?? this._scope()?.assignedReviewers ?? [];
    return ids.map(id => REVIEWER_PROFILES[id]).filter((p): p is ReviewerProfile => !!p);
  });

  readonly displayLinkedSubDivisions = computed(() =>
    this._subscope()?.linkedSubDivisions ?? this._scope()?.linkedSubDivisions ?? []
  );

  readonly displayObjective = computed(() =>
    this._subscope()?.objective ?? this._scope()?.objective ?? ''
  );

  readonly displayEstimatedHours = computed(() =>
    this._subscope()?.estimatedHours ?? this._scope()?.estimatedHours ?? null
  );

  readonly displayHourlyRate = computed(() =>
    this._subscope()?.hourlyRate ?? this._scope()?.hourlyRate ?? null
  );

  readonly displayRiskRating = computed(() =>
    this._subscope()?.riskRating ?? this._scope()?.riskRating ?? ''
  );

  readonly displayRiskRefId = computed(() =>
    this._subscope()?.riskReferenceId ?? this._scope()?.riskReferenceId ?? ''
  );

  readonly displayCompletionNote = computed(() =>
    this._subscope()?.completionNote ?? this._scope()?.completionNote ?? ''
  );

  readonly displayJustification = computed(() =>
    this._subscope()?.justificationForSampling ?? this._scope()?.justificationForSampling ?? ''
  );

  /** Company / division / sub-division labels from the record's own company/divisionCode/
   *  subDivisionName (static scope shape); sub-division is '—' when the parent division
   *  has no sub-divisions. Null when the caller's record carries no org fields. */
  readonly orgLabels = computed<ScopeOrgLabels | null>(() => {
    const rec = (this._subscope() ?? this._scope()) as unknown as
      { company?: string; divisionCode?: string; subDivisionName?: string | null } | null;
    if (!rec?.company && !rec?.divisionCode) return null;
    return resolveScopeOrgLabels(rec.company, rec.divisionCode, rec.subDivisionName);
  });

  readonly subScopes = computed(() => this._scope()?.subScopes ?? []);

  readonly parentName$ = computed(() => this._parentName());

  readonly parentScopeName = computed(() => this._subscope()?.parentScope ?? this._parentName());

  readonly computedBudget = computed(() => {
    const hours = this.displayEstimatedHours();
    const rate = this.displayHourlyRate();
    if (hours == null || rate == null) return null;
    return hours * rate;
  });

  readonly durationDays = computed<number | null>(() => {
    const s = this.displayStartDate();
    const e = this.displayEndDate();
    if (!s || !e) return null;
    const start = new Date(s);
    const end = new Date(e);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
  });

  // ─── Sub-scope search & pagination ───────────────────
  readonly SUBSCOPE_PAGE_SIZE = 4;

  private readonly _subscopeSearch = signal('');
  private readonly _subscopeFirst  = signal(0);

  readonly filteredSubScopes = computed(() => {
    const q = this._subscopeSearch().toLowerCase().trim();
    const list = this.subScopes();
    return q ? list.filter(ss => ss.subScopeName.toLowerCase().includes(q)) : list;
  });

  readonly pagedSubScopes = computed(() =>
    this.filteredSubScopes().slice(this._subscopeFirst(), this._subscopeFirst() + this.SUBSCOPE_PAGE_SIZE)
  );

  getSubscopeSearch(): string { return this._subscopeSearch(); }
  setSubscopeSearch(q: string): void { this._subscopeSearch.set(q); this._subscopeFirst.set(0); }
  getSubscopeFirst(): number { return this._subscopeFirst(); }
  onSubscopePageChange(event: { first?: number }): void { this._subscopeFirst.set(event.first ?? 0); }

  onHide(): void {
    this.drawerRef.close(null);
  }

  scopeTypeLabel(t?: string): string {
    const m: Record<string, string> = {
      departmental: 'Departmental', functional: 'Functional', independent: 'Independent',
    };
    const updatedType = t == 'subDivisional' ? 'Sub-Divisional' : t;
    return m[updatedType ?? ''] ?? (updatedType ?? '—');
  }

  auditFrequencyLabel(f?: string): string {
    const m: Record<string, string> = { quarterly: 'Quarterly', annually: 'Annually', monthly: 'Monthly' };
    return m[f ?? ''] ?? (f ?? '—');
  }

  modeOfAuditLabel(m?: string): string {
    const map: Record<string, string> = {
      full: 'Full', limited: 'Limited', thematic: 'Thematic',
      'follow-up': 'Follow-up', continuous: 'Continuous',
    };
    return map[m ?? ''] ?? (m ?? '—');
  }

  methodologyLabel(m?: string): string {
    const map: Record<string, string> = {
      'risk-based': 'Risk-Based', random: 'Random', judgmental: 'Judgmental',
      systematic: 'Systematic', stratified: 'Stratified',
    };
    return map[m ?? ''] ?? (m ?? '—');
  }

  riskSeverity(r?: string | null): 'success' | 'warn' | 'danger' | 'secondary' {
    return r === 'low' ? 'success' : r === 'medium' ? 'warn' : r === 'high' ? 'danger' : 'secondary';
  }

  riskLabel(r?: string | null): string {
    const m: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    return m[r ?? ''] ?? (r ?? '—');
  }
}
