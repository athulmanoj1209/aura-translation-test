import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { AuditPlanStore } from './audit-plan.store';
import {
  AuditScope, FREQ_LABELS, InstanceStatus, MONTHS, STATUS_META,
  runsPerMonth, runStatuses,
} from './models/audit-plan.model';
// same drawer adapter used by scope-detail / calendar / log
import { ScopeJobDrawerService } from '../scope-job/services/scope-job-drawer.service';

/* ---------- local view models (precomputed, template stays logic-free) ---------- */
interface PillVM {
  monthIndex: number;
  monthLabel: string;
  status: InstanceStatus | null;
  mark: string;
  runs: InstanceStatus[];
  tooltip: string;
}
interface LaneScopeVM { scope: AuditScope; quarters: PillVM[][]; }
interface LaneSubDivisionVM {
  id: string; name: string;
  isDivisionLevel: boolean;
  scopes: LaneScopeVM[];
  rollup: (InstanceStatus | null)[];
  pct: number;
  instances: number;
}
interface PagedLaneVM extends LaneSubDivisionVM {
  /** scopes visible on the sub-division's current page */
  visibleScopes: LaneScopeVM[];
  scopeFirst: number;
}

type ColorMode = 'status' | 'freq';

@Component({
  selector: 'ap-annual-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule, PaginatorModule],
  template: `
    <!-- legend: toggle first, then ONLY the active colour mode's legend
         (showing both at once made clients read two competing colour systems) -->
    <div class="legend panelish">
      <span class="leg-lbl">Colour by</span>
      <span class="mode-seg">
        <button class="mode-btn" [class.active]="colorMode() === 'status'" (click)="colorMode.set('status')">Status</button>
        <button class="mode-btn" [class.active]="colorMode() === 'freq'" (click)="colorMode.set('freq')">Frequency</button>
      </span>
      <span class="leg-div"></span>

      @if (colorMode() === 'status') {
        @for (st of statusKeys; track st) {
          <span class="leg"><span class="sw st-{{ st }}"></span>{{ meta[st].label }}</span>
        }
        <span class="leg"><span class="sw ghost-sw"></span>Not scheduled</span>
        <span class="leg-hint">Stripe on the scope name = frequency</span>
      } @else {
        @for (f of freqKeys; track f) {
          <span class="leg"><span class="fq-dot bf-{{ f }}"></span><b>{{ f }}</b>&nbsp;{{ freqLabels[f] }}</span>
        }
        <span class="leg-hint">Marks inside pills: ✓ done · … running · ! overdue</span>
      }
    </div>

    @for (subDivision of pagedLanes(); track subDivision.id) {
      <section class="dept" [class.open]="!collapsed().has(subDivision.id)">
        <header class="dept-hdr" (click)="toggle(subDivision.id)">
          <span class="caret">▶</span>
          <span class="dept-name">{{ subDivision.name }}</span>
          <span class="dept-meta">{{ subDivision.isDivisionLevel ? 'Division · ' : '' }}{{ subDivision.scopes.length }} scopes · {{ subDivision.instances }} instances</span>
          <span class="dept-track">
            @for (st of subDivision.rollup; track $index) { <i class="{{ st ? 'r-' + st : '' }}"></i> }
          </span>
          <span class="dept-pct">{{ subDivision.pct }}% done</span>
          <button class="open-dept" (click)="$event.stopPropagation(); store.drillToSubDivision(subDivision.id)"
                  [pTooltip]="subDivision.isDivisionLevel ? 'Open division view' : 'Open sub-division view'">›</button>
        </header>

        <div class="dept-body">
          <div class="qstrip">
            <div class="qlabel">Audit scope</div>
            @for (q of quarters; track q) {
              <div class="q">
                <div class="qname">Q{{ q + 1 }}</div>
                <div class="qmonths">
                  @for (m of quarterMonths(q); track m.mi) {
                    <span (click)="store.drillToMonth(m.mi)" pTooltip="Open {{ m.label }} calendar">{{ m.label }}</span>
                  }
                </div>
              </div>
            }
          </div>

          @for (row of subDivision.visibleScopes; track row.scope.id) {
            <div class="scope">
              <div class="scope-info">
                <span class="scope-title" (click)="store.drillToScope(row.scope.id)">
                  <span class="stripe bf-{{ row.scope.freq }}"></span>{{ row.scope.name }}
                </span>
                <span class="scope-sub">{{ row.scope.code }} · {{ row.scope.auditor }}
                  <span class="fq pf-{{ row.scope.freq }}">{{ row.scope.freq }}</span>
                </span>
              </div>
              @for (qp of row.quarters; track $index) {
                <div class="qcell">
                  @for (p of qp; track p.monthIndex) {
                    @if (p.status === null) {
                      <div class="pill ghost" (click)="store.drillToMonth(p.monthIndex)">·</div>
                    } @else {
                      <div class="pill"
                           [class]="colorMode() === 'status' ? 'pill st-' + p.status : 'pill pf-' + row.scope.freq"
                           [pTooltip]="p.tooltip"
                           (click)="openPill(subDivision.name, row.scope, p)">
                        <span class="m">{{ p.monthLabel }}</span>
                        @if (colorMode() === 'freq') { <span class="stdot sd-{{ p.status }}"></span> }
                        {{ p.mark }}
                        @if (p.runs.length > 1) {
                          <span class="runs">
                            @for (r of p.runs; track $index; let ri = $index) {
                              <i class="r-{{ r }}"
                                 (click)="$event.stopPropagation(); openPillRun(subDivision.name, row.scope, p, ri)"></i>
                            }
                          </span>
                        }
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }

          @if (subDivision.scopes.length > scopeRowsPerPage) {
            <p-paginator styleClass="scope-pgr"
              [first]="subDivision.scopeFirst" [rows]="scopeRowsPerPage" [totalRecords]="subDivision.scopes.length"
              [showFirstLastIcon]="false"
              currentPageReportTemplate="Scopes {first}–{last} of {totalRecords}"
              [showCurrentPageReport]="true"
              (onPageChange)="onScopePage(subDivision.id, $event)" />
          }
        </div>
      </section>
    }

    @if (lanes().length > subDivisionRows()) {
      <p-paginator styleClass="dept-pgr"
        [first]="subDivisionFirstClamped()" [rows]="subDivisionRows()" [totalRecords]="lanes().length"
        [rowsPerPageOptions]="[2, 3, 5, 10]"
        currentPageReportTemplate="Sub-Divisions {first}–{last} of {totalRecords}"
        [showCurrentPageReport]="true"
        (onPageChange)="onSubDivisionPage($event)" />
    }
  `,
  styles: [`
    :host { display: block; }
    .panelish { background: var(--ap-panel); border: 1px solid var(--ap-hairline);
      border-radius: var(--ap-radius); box-shadow: var(--ap-shadow); }

    /* ---- legend + toggle (Option A: only the active mode's legend shows) ---- */
    .legend { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 12px 18px; margin-bottom: 16px;
      .leg-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--ap-slate); }
      .leg-div { width: 1px; height: 18px; background: var(--ap-hairline); }
      .leg { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ap-ink-soft);
        b { font-weight: 700; font-size: 11px; } }
      .sw { width: 13px; height: 13px; border-radius: 4px; }
      .ghost-sw { background: transparent; border: 1px dashed #E4E8F0; }
      .fq-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .leg-hint { margin-left: auto; font-size: 11px; color: var(--ap-slate); } }
    /* segmented control — both options joined in one capsule */
    .mode-seg { display: inline-flex; border: 1px solid var(--ap-hairline); border-radius: 20px; overflow: hidden; }
    .mode-btn { border: none; background: var(--surface-card); padding: 6px 16px;
      font-size: 12px; font-weight: 600; color: var(--ap-ink-soft); cursor: pointer; font-family: inherit;
      transition: background .15s, color .15s;
      &:hover:not(.active) { background: #F6F7FB; }
      &.active { background: var(--ap-brand); color: #fff; } }

    /* ---- sub-division card ---- */
    .dept { background: var(--ap-panel); border: 1px solid var(--ap-hairline); border-radius: var(--ap-radius);
      box-shadow: var(--ap-shadow); margin-bottom: 14px; overflow: hidden; }
    .dept-hdr { display: flex; align-items: center; gap: 14px; padding: 14px 20px; cursor: pointer; user-select: none;
      &:hover { background: #FAFBFE; }
      .caret { color: var(--ap-slate); font-size: 11px; transition: transform .2s; width: 14px; } }
    .dept.open .caret { transform: rotate(90deg); }
    .dept-name { font-weight: 600; font-size: 14.5px; color: var(--ap-brand); }
    .dept-meta { font-size: 11.5px; color: var(--ap-slate); }
    .dept-track { flex: 1; display: flex; gap: 3px; max-width: 380px; margin-left: auto;
      i { flex: 1; height: 8px; border-radius: 3px; background: #EDF0F6; } }
    .dept-pct { font-size: 12px; font-weight: 600; color: var(--ap-ink-soft); min-width: 60px; text-align: right; }
    .open-dept { border: none; background: #F1F3F8; color: var(--ap-ink-soft); width: 26px; height: 26px;
      border-radius: 7px; cursor: pointer; font-size: 14px; &:hover { background: var(--ap-hairline); } }
    .dept-body { border-top: 1px solid var(--ap-hairline); display: none; }
    .dept.open .dept-body { display: block; }

    /* ---- quarter strip ---- */
    .qstrip { display: grid; grid-template-columns: 300px repeat(4, 1fr); background: #FBFCFE;
      border-bottom: 1px solid var(--ap-hairline);
      .qlabel { padding: 10px 16px; font-size: 10px; font-weight: 700; letter-spacing: .08em;
        text-transform: uppercase; color: var(--ap-slate); }
      .q { padding: 8px 12px; border-left: 1px dashed var(--ap-hairline); }
      .qname { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: var(--ap-brand); text-transform: uppercase; }
      .qmonths { display: flex; gap: 4px; margin-top: 3px;
        span { flex: 1; font-size: 9.5px; color: var(--ap-slate); text-align: center; text-transform: uppercase;
          letter-spacing: .04em; cursor: pointer; &:hover { color: var(--ap-brand); font-weight: 700; } } } }

    /* ---- scope row ---- */
    .scope { display: grid; grid-template-columns: 300px repeat(4, 1fr); align-items: center;
      border-bottom: 1px solid #F0F2F8; min-height: 62px;
      &:last-child { border-bottom: none; } &:hover { background: #FAFBFE; } }
    .scope-info { padding: 10px 16px; display: flex; flex-direction: column; gap: 5px; }
    .scope-title { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer;
      &:hover { color: var(--ap-brand); text-decoration: underline; }
      .stripe { width: 3px; height: 16px; border-radius: 2px; flex-shrink: 0; } }
    .scope-sub { font-size: 11px; color: var(--ap-slate); display: flex; align-items: center; gap: 8px; padding-left: 11px; }
    .qcell { padding: 9px 12px; border-left: 1px dashed var(--ap-hairline); display: flex; gap: 5px;
      align-items: center; min-height: 62px; }

    /* ---- pills ---- */
    .pill { flex: 1; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
      gap: 4px; font-size: 10px; font-weight: 700; cursor: pointer; position: relative;
      transition: transform .1s, box-shadow .1s;
      &:hover { transform: translateY(-1px); box-shadow: 0 3px 8px -2px rgba(18,32,59,.25); }
      .m { font-size: 8.5px; font-weight: 600; opacity: .7; text-transform: uppercase; }
      &.ghost { background: transparent; border: 1px dashed #E4E8F0; color: #C9CFDC;
        &:hover { transform: none; box-shadow: none; border-color: var(--ap-slate); } }
      .stdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .runs { display: flex; gap: 2px; position: absolute; bottom: 3px; left: 6px; right: 6px; height: 3px;
        i { flex: 1; border-radius: 2px; cursor: pointer;
          &:hover { outline: 1px solid var(--ap-ink); } } } }

    /* status fills (pills + legend) */
    .st-completed { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .st-planned  { background: var(--st-planned-bg);  color: var(--st-planned-tx); }
    .st-inprog   { background: var(--st-inprog-bg);   color: var(--st-inprog-tx); }
    .st-overdue  { background: var(--st-overdue-bg);  color: var(--st-overdue-tx); }
    /* solid status accents */
    .r-completed, .sd-completed { background: var(--stc-completed); }
    .r-planned,  .sd-planned  { background: var(--stc-planned); }
    .r-inprog,   .sd-inprog   { background: var(--stc-inprog); }
    .r-overdue,  .sd-overdue  { background: var(--stc-overdue); }

    /* frequency fills (pills in freq mode + badges) & solid stripes */
    .fq { display: inline-flex; align-items: center; gap: 4px; border-radius: 10px; font-size: 9.5px;
      font-weight: 700; padding: 1.5px 7px; border: 1px solid;
      &::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; } }
    .pf-W  { background: var(--fq-W-bg);  color: var(--fq-W-tx);  border: 1px solid var(--fq-W); }
    .pf-BW { background: var(--fq-BW-bg); color: var(--fq-BW-tx); border: 1px solid var(--fq-BW); }
    .pf-M  { background: var(--fq-M-bg);  color: var(--fq-M-tx);  border: 1px solid var(--fq-M); }
    .pf-Q  { background: var(--fq-Q-bg);  color: var(--fq-Q-tx);  border: 1px solid var(--fq-Q); }
    .pf-HY { background: var(--fq-HY-bg); color: var(--fq-HY-tx); border: 1px solid var(--fq-HY); }
    .pf-Y  { background: var(--fq-Y-bg);  color: var(--fq-Y-tx);  border: 1px solid var(--fq-Y); }
    .bf-W { background: var(--fq-W); } .bf-BW { background: var(--fq-BW); } .bf-M { background: var(--fq-M); }
    .bf-Q { background: var(--fq-Q); } .bf-HY { background: var(--fq-HY); } .bf-Y { background: var(--fq-Y); }

    @media (max-width: 1000px) {
      .qstrip, .scope { grid-template-columns: 200px repeat(4, 1fr); }
    }

    /* ---- paginators ---- */
    :host ::ng-deep .scope-pgr .p-paginator {
      border-top: 1px solid var(--ap-hairline); background: #FBFCFE; padding: 4px 12px;
      justify-content: flex-end; font-size: 11.5px;
      .p-paginator-current { font-size: 11px; color: var(--ap-slate); }
    }
    :host ::ng-deep .dept-pgr .p-paginator {
      background: var(--ap-panel); border: 1px solid var(--ap-hairline);
      border-radius: var(--ap-radius); box-shadow: var(--ap-shadow); padding: 6px 12px;
      .p-paginator-current { font-size: 11.5px; color: var(--ap-slate); }
    }

    :host-context(.app-dark) {
      .ghost-sw { border-color: var(--ap-hairline); }
      .mode-btn:hover:not(.active) { background: var(--ap-hairline); }
      .dept-hdr:hover { background: var(--ap-hairline); }
      .dept-track i { background: var(--ap-hairline); }
      .open-dept { background: var(--ap-hairline); }
      .qstrip { background: var(--ap-hairline); }
      .scope { border-bottom-color: var(--ap-hairline); &:hover { background: var(--ap-hairline); } }
      .pill.ghost { border-color: var(--ap-hairline); color: var(--ap-slate); }
      ::ng-deep .scope-pgr .p-paginator { background: var(--ap-hairline); }
    }
  `],
})
export class AnnualOverviewComponent {
  readonly store = inject(AuditPlanStore);
  private readonly jobDrawer = inject(ScopeJobDrawerService);
  readonly meta = STATUS_META;
  readonly freqLabels = FREQ_LABELS;
  readonly statusKeys = ['completed', 'inprog', 'planned', 'overdue'] as const;
  readonly freqKeys = ['W', 'BW', 'M', 'Q', 'HY', 'Y'] as const;
  readonly quarters = [0, 1, 2, 3];

  /** 'status' (default) or 'freq' pill colouring */
  readonly colorMode = signal<ColorMode>('freq');
  /** collapsed sub-division ids (all expanded by default) */
  readonly collapsed = signal<ReadonlySet<string>>(new Set());

  /** pill click → scope-job profile drawer for that month (leads with the first job) */
  openPill(subDivisionName: string, scope: AuditScope, p: PillVM): void {
    if (!p.status) return;
    const job = scope.jobs[0];
    if (!job) return;
    this.jobDrawer.openFromPlan({
      deptName: subDivisionName,
      scope,
      job,
      monthIndex: p.monthIndex,
      year: this.store.year(),
      status: p.status,
    });
  }

  /** W/BW run strip click → drawer scoped to that run (its own job + status + week window) */
  openPillRun(subDivisionName: string, scope: AuditScope, p: PillVM, ri: number): void {
    const job = scope.jobs.find(j => (j as { run?: number }).run === ri + 1)
      ?? scope.jobs.find(j => (j as { run?: number }).run === undefined)
      ?? scope.jobs[0];
    if (!job) return;
    this.jobDrawer.openFromPlan({
      deptName: subDivisionName,
      scope,
      job,
      monthIndex: p.monthIndex,
      year: this.store.year(),
      status: p.runs[ri],
      run: ri + 1,
    });
  }

  /** full quarter-lane view model, memoised on filters/data */
  readonly lanes = computed<LaneSubDivisionVM[]>(() =>
    this.store.filteredSubDivisions().map(subDivision => {
      let instances = 0, done = 0;
      const scopes = subDivision.scopes.map(scope => {
        const quarters: PillVM[][] = this.quarters.map(q =>
          [0, 1, 2].map(k => this.buildPill(scope, q * 3 + k)));
        instances += scope.months.filter(Boolean).length;
        done += scope.months.filter(m => m === 'completed').length;
        return { scope, quarters };
      });
      return {
        id: subDivision.id, name: subDivision.name, isDivisionLevel: !!subDivision.isDivisionLevel, scopes, instances,
        pct: instances ? Math.round((done / instances) * 100) : 0,
        rollup: MONTHS.map((_, mi) => subDivision.scopes.find(s => s.months[mi])?.months[mi] ?? null),
      };
    }));

  /* ---------------- pagination ---------------- */
  readonly subDivisionFirst = signal(0);
  readonly subDivisionRows = signal(3);
  readonly scopeRowsPerPage = 5;
  /** per-sub-division scope page offsets */
  private readonly scopeOffsets = signal<Record<string, number>>({});

  /** clamp so filter changes never leave us on an empty page */
  readonly subDivisionFirstClamped = computed(() => {
    const total = this.lanes().length, rows = this.subDivisionRows();
    return Math.min(this.subDivisionFirst(), Math.max(0, Math.floor((total - 1) / rows) * rows));
  });

  /** sub-divisions of the current page, each with its visible scope slice */
  readonly pagedLanes = computed<PagedLaneVM[]>(() => {
    const first = this.subDivisionFirstClamped();
    const offsets = this.scopeOffsets();
    return this.lanes().slice(first, first + this.subDivisionRows()).map(subDivision => {
      const raw = offsets[subDivision.id] ?? 0;
      const scopeFirst = raw >= subDivision.scopes.length ? 0 : raw;
      return {
        ...subDivision,
        scopeFirst,
        visibleScopes: subDivision.scopes.slice(scopeFirst, scopeFirst + this.scopeRowsPerPage),
      };
    });
  });

  onSubDivisionPage(e: PaginatorState): void {
    this.subDivisionFirst.set(e.first ?? 0);
    this.subDivisionRows.set(e.rows ?? 3);
  }

  onScopePage(subDivisionId: string, e: PaginatorState): void {
    this.scopeOffsets.update(m => ({ ...m, [subDivisionId]: e.first ?? 0 }));
  }

  toggle(subDivisionId: string): void {
    this.collapsed.update(set => {
      const next = new Set(set);
      next.has(subDivisionId) ? next.delete(subDivisionId) : next.add(subDivisionId);
      return next;
    });
  }

  quarterMonths(q: number): { mi: number; label: string }[] {
    return [0, 1, 2].map(k => ({ mi: q * 3 + k, label: MONTHS[q * 3 + k] }));
  }

  private buildPill(scope: AuditScope, monthIndex: number): PillVM {
    const status = scope.months[monthIndex];
    const n = runsPerMonth(scope.freq);
    return {
      monthIndex,
      monthLabel: MONTHS[monthIndex],
      status,
      mark: status ? STATUS_META[status].mark : '',
      runs: status && n > 1 ? runStatuses(status, n) : [],
      tooltip: status
        ? `${scope.name} · ${MONTHS[monthIndex]} · ${STATUS_META[status].label}` +
          (n > 1 ? ` · ${n} runs` : '') + ` · ${FREQ_LABELS[scope.freq]}`
        : `${MONTHS[monthIndex]} — not scheduled`,
    };
  }
}