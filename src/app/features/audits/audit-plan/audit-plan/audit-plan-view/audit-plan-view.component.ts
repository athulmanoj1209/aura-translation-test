import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';

/* Adjust this path to wherever drawer-ref.ts actually lives relative to this
   file — mirrors the pattern used by events-meetings-profile.component.ts. */
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import type {
  AuditPlan,
  AuditPlanStatus,
  AuditScope,
  SubDivision,
  Frequency,
  InstanceStatus,
  RiskRating,
  ScopeJob,
} from '../audit-plan-list/audit-plan-list.component';
import { FREQ_LABELS, MONTH_LABELS } from '../audit-plan-list/audit-plan-list.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

/* ── Calendar-system vocabulary (mirrors models/audit-plan.ts STATUS_META) ──
   Kept as a local copy since that file lives outside the files we have. */
const INSTANCE_META: Record<InstanceStatus, { label: string; mark: string }> = {
  completed: { label: 'Completed',   mark: '✓' },
  planned:   { label: 'Planned',     mark: '' },
  inprog:    { label: 'In progress', mark: '…' },
  overdue:   { label: 'Overdue',     mark: '!' },
};

const STATUS_LABELS: Record<AuditPlanStatus, string> = {
  draft: 'Draft', planned: 'Planned', in_progress: 'In Progress', overdue: 'Overdue',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};
const STATUS_HERO_BADGE: Record<AuditPlanStatus, string> = {
  draft: 'badge--grey', planned: 'badge--blue', in_progress: 'badge--amber', overdue: 'badge--red',
  completed: 'badge--green', on_hold: 'badge--orange', cancelled: 'badge--grey',
};
const STATUS_CHIP_CLASS: Record<AuditPlanStatus, string> = {
  draft: 'status-chip--draft', planned: 'status-chip--planned', in_progress: 'status-chip--in-progress',
  overdue: 'status-chip--overdue', completed: 'status-chip--completed', on_hold: 'status-chip--on-hold',
  cancelled: 'status-chip--cancelled',
};

/* ── local view models (precomputed so the template stays logic-free) ── */
interface PillVM {
  monthIndex: number;
  label: string;
  status: InstanceStatus | null;
  mark: string;
  tooltip: string;
}
interface ScopeVM { scope: AuditScope; quarters: PillVM[][]; }
interface SubDivisionCardVM {
  subDivision: SubDivision;
  scopes: ScopeVM[];
  instances: number;
  pct: number;
  rollup: (InstanceStatus | null)[];
}

/** Priority used when rolling several scopes' status up into one sub-division track cell. */
const SEVERITY: Record<InstanceStatus, number> = { overdue: 3, inprog: 2, planned: 1, completed: 0 };

@Component({
  selector: 'app-audit-plan-view',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, PaginatorModule, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-plan-view.component.html',
  styleUrls: ['./audit-plan-view.component.scss'],
})
export class AuditPlanViewComponent {

  /** Drawer wiring — optional so the component also works embedded / in tests. */
  private readonly drawerRef = inject(DrawerRef, { optional: true }) as DrawerRef<AuditPlan> | null;
  private readonly drawerData = inject(DRAWER_DATA, { optional: true }) as AuditPlan | null;

  readonly plan = signal<AuditPlan | null>(this.drawerData);
  readonly p = computed(() => this.plan());

  readonly months = MONTH_LABELS;
  readonly meta = INSTANCE_META;
  readonly freqLabels = FREQ_LABELS;
  readonly quarters = [0, 1, 2, 3];

  /** collapsed sub-division ids — all expanded by default */
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  /** scope ids currently showing their job list inline */
  readonly expandedScopes = signal<ReadonlySet<string>>(new Set());

  toggleSubDivision(id: string): void {
    this.collapsed.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  isSubDivisionOpen(id: string): boolean { return !this.collapsed().has(id); }

  toggleScopeJobs(id: string): void {
    this.expandedScopes.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  isScopeOpen(id: string): boolean { return this.expandedScopes().has(id); }

  /* ── Plan-level title / dates ── */
  readonly planYear = computed(() => {
    const pl = this.plan();
    const d = pl?.startDate ?? pl?.endDate;
    return d ? new Date(d).getFullYear() : new Date().getFullYear();
  });

  readonly planTitle = computed(() => {
    const pl = this.plan();
    if (!pl) return '';
    return `${pl.organizationName}_${pl.divisionName}_${this.planYear()}`;
  });

  /** Distinct frequencies in use across every scope in this plan, for the Basic Information row. */
  readonly planFrequencies = computed<Frequency[]>(() => {
    const pl = this.plan();
    if (!pl) return [];
    const set = new Set<Frequency>();
    for (const d of pl.subDivisions) for (const s of d.scopes) set.add(s.freq);
    return Array.from(set);
  });

  readonly durationLabel = computed<string | null>(() => {
    const pl = this.plan();
    if (!pl?.startDate || !pl?.endDate) return null;
    const days = Math.round(
      (new Date(pl.endDate).getTime() - new Date(pl.startDate).getTime()) / 86_400_000,
    );
    if (days < 1) return '< 1 day';
    if (days === 1) return '1 day';
    if (days < 30) return `${days} days`;
    const m = Math.round(days / 30);
    return m === 1 ? '1 month' : `${m} months`;
  });

  formatDateOnly(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  statusLabel(s: AuditPlanStatus): string { return STATUS_LABELS[s] ?? s; }
  heroBadgeClass(s: AuditPlanStatus): string { return STATUS_HERO_BADGE[s] ?? 'badge--blue'; }
  statusChipClass(s: AuditPlanStatus): string {
    return `status-chip ${STATUS_CHIP_CLASS[s] ?? 'status-chip--draft'}`;
  }

  /* ── Plan-wide scope KPI strip (mirrors AuditPlanStore.scopeStats) ── */
  readonly scopeStats = computed(() => {
    const acc = { total: 0, completed: 0, inprog: 0, planned: 0, overdue: 0 };
    const pl = this.plan();
    if (!pl) return acc;
    for (const d of pl.subDivisions) {
      for (const s of d.scopes) {
        acc.total++;
        const m = s.months.filter((x): x is InstanceStatus => x !== null);
        if (m.includes('overdue')) acc.overdue++;
        else if (m.includes('inprog')) acc.inprog++;
        else if (m.length > 0 && m.every(x => x === 'completed')) acc.completed++;
        else acc.planned++;
      }
    }
    return acc;
  });

  /* ── Sub-Division cards (rollup track + scope quarter-pills) ── */
  readonly subDivisionCards = computed<SubDivisionCardVM[]>(() => {
    const pl = this.plan();
    if (!pl) return [];
    return pl.subDivisions.map(subDivision => {
      let instances = 0, done = 0;
      const rollup: (InstanceStatus | null)[] = Array(12).fill(null);
      const scopes: ScopeVM[] = subDivision.scopes.map(scope => {
        scope.months.forEach((m, mi) => {
          if (!m) return;
          instances++;
          if (m === 'completed') done++;
          const cur = rollup[mi];
          if (!cur || SEVERITY[m] > SEVERITY[cur]) rollup[mi] = m;
        });
        const qs = this.quarters.map(q => [0, 1, 2].map(k => this.buildPill(scope, q * 3 + k)));
        return { scope, quarters: qs };
      });
      return {
        subDivision, scopes, instances,
        pct: instances ? Math.round((done / instances) * 100) : 0,
        rollup,
      };
    });
  });

  /* ── Sub-Division pagination (default 2 per page) ── */
  readonly subDivisionFirst = signal(0);
  readonly subDivisionRows  = signal(2);

  /** clamp so filter/data changes never leave us on an empty page */
  readonly subDivisionFirstClamped = computed(() => {
    const total = this.subDivisionCards().length;
    const rows = this.subDivisionRows();
    return Math.min(this.subDivisionFirst(), Math.max(0, Math.floor((total - 1) / rows) * rows));
  });

  readonly pagedSubDivisionCards = computed<SubDivisionCardVM[]>(() => {
    const first = this.subDivisionFirstClamped();
    return this.subDivisionCards().slice(first, first + this.subDivisionRows());
  });

  onSubDivisionPage(e: PaginatorState): void {
    this.subDivisionFirst.set(e.first ?? 0);
    this.subDivisionRows.set(e.rows ?? 2);
  }

  private buildPill(scope: AuditScope, monthIndex: number): PillVM {
    const status = scope.months[monthIndex];
    return {
      monthIndex,
      label: MONTH_LABELS[monthIndex],
      status,
      mark: status ? INSTANCE_META[status].mark : '',
      tooltip: status
        ? `${scope.name} · ${MONTH_LABELS[monthIndex]} · ${INSTANCE_META[status].label} · ${FREQ_LABELS[scope.freq]}`
        : `${MONTH_LABELS[monthIndex]} — not scheduled`,
    };
  }

  /* ── Scope-level helpers ── */
  riskClass(r: RiskRating): string { return `risk-badge risk-badge--${r}`; }
  freqBadgeClass(f: Frequency): string { return `fq-badge fq-badge--${f}`; }
  freqStripeClass(f: Frequency): string { return `stripe stripe--${f}`; }

  jobRef(scope: AuditScope, job: ScopeJob): string {
    return `${scope.code}-${job.id.toUpperCase()}`;
  }
  instanceLabel(s: InstanceStatus): string { return this.meta[s].label; }
  instanceClass(s: InstanceStatus): string { return `tag st-${s}`; }

  /** F-101, F-102, … placeholder refs — swap for real finding records once wired to the API. */
  findingsArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  onClose(): void {
    this.drawerRef?.close(null);
  }
}