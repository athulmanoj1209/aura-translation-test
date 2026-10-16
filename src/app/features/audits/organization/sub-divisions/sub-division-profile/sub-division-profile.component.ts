import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TreeModule, TreeNodeExpandEvent, TreeNodeCollapseEvent } from 'primeng/tree';
import { PaginatorModule } from 'primeng/paginator';
import { TreeNode } from 'primeng/api';

import {
  AUDITOR_PROFILES,
  REVIEWER_PROFILES,
} from '@/app/features/audits/organization/divisions/divisions-list/divisions-list.component';
import type { ProfileSubDivision, AuditorInfo, ReviewerInfo, FlatScopeItem } from '@/app/features/audits/organization/sub-divisions/models/sub-division-profile.model';
import type { SubDivisionProfileDrawerData } from '@/app/features/audits/organization/sub-divisions/models/sub-division-drawer.model';
import { DIVISION_TYPE_OPTIONS } from '@/app/features/audits/organization/divisions/division-static-data';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { PersonnelPanelComponent } from '@/app/shared/components/personnel-panel/personnel-panel.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-sub-division-profile',
  standalone: true,
  imports: [CommonModule, TagModule, TooltipModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, TreeModule, PaginatorModule, PersonnelPanelComponent, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sub-division-profile.component.html',
  styleUrls: ['./sub-division-profile.component.scss'],
})
export class SubDivisionProfileComponent {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as SubDivisionProfileDrawerData | null;

  private readonly _subDivision = signal<ProfileSubDivision | null>(this.data?.subDivision ?? null);
  private readonly _divisionName = signal(this.data?.divisionName ?? '');

  readonly d = computed(() => this._subDivision());
  readonly divisionName$ = computed(() => this._divisionName());

  // ─── Computed signals ────────────────────────────────────────────
  readonly yearsOperational = computed<number | null>(() => {
    const s = this._subDivision()?.operationalSince;
    if (!s) return null;
    const date = new Date(s);
    if (isNaN(date.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000)));
  });

  readonly scopeCount = computed(() => this._subDivision()?.scopes?.length ?? 0);

  readonly assignedAuditors = computed<AuditorInfo[]>(() => {
    const subDivision = this._subDivision();
    if (!subDivision?.scopes?.length) return [];
    const map = new Map<string, AuditorInfo>();

    for (const scope of subDivision.scopes) {
      for (const id of scope.assignedAuditors ?? []) {
        const profile = AUDITOR_PROFILES[id];
        if (!profile) continue;
        if (!map.has(id)) map.set(id, { ...profile, assignedItems: [] });
        map.get(id)!.assignedItems.push({
          name: scope.scopeName, type: 'scope',
          startDate: scope.startDate, endDate: scope.endDate,
        });
      }
      for (const ss of scope.subScopes ?? []) {
        for (const id of ss.assignedAuditors ?? []) {
          const profile = AUDITOR_PROFILES[id];
          if (!profile) continue;
          if (!map.has(id)) map.set(id, { ...profile, assignedItems: [] });
          map.get(id)!.assignedItems.push({
            name: ss.subScopeName, type: 'subscope',
            parentScope: scope.scopeName,
            startDate: ss.startDate, endDate: ss.endDate,
          });
        }
      }
    }
    return Array.from(map.values());
  });

  readonly assignedReviewers = computed<ReviewerInfo[]>(() => {
    const subDivision = this._subDivision();
    if (!subDivision?.scopes?.length) return [];
    const map = new Map<string, ReviewerInfo>();

    for (const scope of subDivision.scopes) {
      for (const id of scope.assignedReviewers ?? []) {
        const profile = REVIEWER_PROFILES[id];
        if (!profile) continue;
        if (!map.has(id)) map.set(id, { ...profile, reviewItems: [] });
        map.get(id)!.reviewItems.push({
          name: scope.scopeName, type: 'scope',
          startDate: scope.startDate, endDate: scope.endDate,
        });
      }
      for (const ss of scope.subScopes ?? []) {
        for (const id of ss.assignedReviewers ?? []) {
          const profile = REVIEWER_PROFILES[id];
          if (!profile) continue;
          if (!map.has(id)) map.set(id, { ...profile, reviewItems: [] });
          map.get(id)!.reviewItems.push({
            name: ss.subScopeName, type: 'subscope',
            parentScope: scope.scopeName,
            startDate: ss.startDate, endDate: ss.endDate,
          });
        }
      }
    }
    return Array.from(map.values());
  });

  // ─── Audit scopes tree + search + pagination ──────────────
  readonly SCOPE_PAGE_SIZE = 6;
  private readonly _scopeSearch       = signal('');
  private readonly _scopeFirst        = signal(0);
  private readonly _scopeExpandedKeys = signal<Set<string>>(new Set());

  readonly scopeTree = computed<TreeNode<FlatScopeItem>[]>(() => {
    const subDivision = this._subDivision();
    if (!subDivision?.scopes?.length) return [];
    const q = this._scopeSearch().toLowerCase().trim();
    const expKeys = this._scopeExpandedKeys();
    const nodes: TreeNode<FlatScopeItem>[] = [];

    for (const scope of subDivision.scopes) {
      const sKey = scope.scopeName;
      const scopeMatches = !q || scope.scopeName.toLowerCase().includes(q);
      const subScopes = q
        ? scopeMatches
          ? (scope.subScopes ?? [])
          : (scope.subScopes ?? []).filter(ss => ss.subScopeName.toLowerCase().includes(q))
        : (scope.subScopes ?? []);

      if (!q || scopeMatches || subScopes.length > 0) {
        nodes.push({
          key: sKey,
          expanded: q ? subScopes.length > 0 : expKeys.has(sKey),
          data: {
            name: scope.scopeName,
            type: 'scope',
            scopeType: scope.scopeType,
            auditFrequency: scope.auditFrequency,
            riskRating: scope.riskRating ?? undefined,
            subScopeCount: scope.subScopes?.length ?? 0,
          },
          children: subScopes.map(ss => ({
            key: `${sKey}::${ss.subScopeName}`,
            leaf: true,
            data: {
              name: ss.subScopeName,
              type: 'subscope' as const,
              parentScopeName: scope.scopeName,
              auditFrequency: ss.auditFrequency,
              riskRating: ss.riskRating ?? undefined,
            },
            children: [],
          })),
        });
      }
    }
    return nodes;
  });

  readonly pagedScopeTree = computed(() =>
    this.scopeTree().slice(this._scopeFirst(), this._scopeFirst() + this.SCOPE_PAGE_SIZE)
  );

  getScopeSearch(): string { return this._scopeSearch(); }
  setScopeSearch(q: string): void { this._scopeSearch.set(q); this._scopeFirst.set(0); }
  getScopeFirst(): number { return this._scopeFirst(); }
  onScopeTreePageChange(event: { first?: number }): void { this._scopeFirst.set(event.first ?? 0); }

  onScopeNodeExpand(event: TreeNodeExpandEvent): void {
    const key = event.node.key;
    if (key) this._scopeExpandedKeys.update(s => new Set([...s, key]));
  }

  onScopeNodeCollapse(event: TreeNodeCollapseEvent): void {
    const key = event.node.key;
    if (key) this._scopeExpandedKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
  }

  // ─── Resize ──────────────────────────────────────────────────────
  private isResizing = false;

  onResizeStart(event: MouseEvent): void {
    this.isResizing = true;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onResize(event: MouseEvent): void {
    if (!this.isResizing) return;
    const newWidth = window.innerWidth - event.clientX;
    if (newWidth >= 300 && newWidth <= 1200) {
      const panel = document.querySelector('.sub-division-profile-drawer') as HTMLElement | null;
      if (panel) panel.style.width = `${newWidth}px`;
    }
  }

  @HostListener('document:mouseup')
  onResizeEnd(): void {
    this.isResizing = false;
  }

  // ─── Existing helpers ────────────────────────────────────────────
  onHide(): void { this.drawerRef.close(null); }

  riskSeverity(r?: string): 'success' | 'warn' | 'danger' | 'secondary' {
    return r === 'low' ? 'success' : r === 'medium' ? 'warn' : r === 'high' ? 'danger' : 'secondary';
  }

  riskLabel(r?: string): string {
    const m: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
    return m[r ?? ''] ?? (r ?? '—');
  }

  riskStatusLabel(s?: string): string {
    const m: Record<string, string> = { open: 'Open', closed: 'Closed', monitored: 'Monitored' };
    return m[s ?? ''] ?? (s ?? '—');
  }

  statusSeverity(s?: string): 'success' | 'secondary' {
    return s === 'active' ? 'success' : 'secondary';
  }

  auditStatusLabel(s?: string): string {
    const m: Record<string, string> = {
      archived: 'Archived',
      pending: 'Pending',
      pending_approval: 'Pending Approval',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return m[s ?? ''] ?? (s ?? '—');
  }

  auditStatusSeverity(s?: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const m: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      archived: 'secondary',
      pending: 'info',
      pending_approval: 'warn',
      approved: 'success',
      rejected: 'danger',
    };
    return m[s ?? ''] ?? 'secondary';
  }

  scopeTypeLabel(t?: string): string {
    const m: Record<string, string> = {
      subDivisional: 'Sub-Divisional', functional: 'Functional', independent: 'Independent',
    };
    return m[t ?? ''] ?? (t ?? '—');
  }

  auditFreqLabel(f?: string): string {
    const m: Record<string, string> = { quarterly: 'Quarterly', annually: 'Annually', monthly: 'Monthly' };
    return m[f ?? ''] ?? (f ?? '—');
  }

  divisionTypeLabel(t?: string | null): string {
    return DIVISION_TYPE_OPTIONS.find(o => o.value === t)?.label ?? (t || '—');
  }

  departmentTypeLabel(t?: string | null): string {
    const m: Record<string, string> = {
      'finance': 'Finance',
      'human-resources': 'Human Resources',
      'information-technology': 'Information Technology',
      'operations': 'Operations',
      'legal-compliance': 'Legal & Compliance',
      'internal-audit': 'Internal Audit',
      'risk-management': 'Risk Management',
      'marketing-communications': 'Marketing & Communications',
      'procurement-supply-chain': 'Procurement & Supply Chain',
      'customer-service': 'Customer Service',
      'executive-management': 'Executive Management',
      'administration': 'Administration',
      'compliance': 'Compliance',
      'consumer-protection': 'Consumer Protection',
    };
    return m[t ?? ''] ?? (t || '—');
  }

  auditFreqSeverity(f?: string): 'success' | 'info' | 'warn' | 'secondary' {
    const m: Record<string, 'success' | 'info' | 'warn' | 'secondary'> = {
      monthly: 'success', quarterly: 'info', annually: 'warn',
    };
    return m[f ?? ''] ?? 'secondary';
  }
}
