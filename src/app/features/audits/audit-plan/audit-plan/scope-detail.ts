import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

import {
  FREQ_LABELS, InstanceStatus, MONTHS, STATUS_META, jobStatus, runsPerMonth, runStatuses,
} from './models/audit-plan.model';
import { AuditPlanStore } from './audit-plan.store';
// adjust to wherever you placed the drawer adapter
import { ScopeJobDrawerService } from '../scope-job/services/scope-job-drawer.service';

@Component({
  selector: 'ap-scope-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ProgressBarModule, TooltipModule],
  template: `
    <button class="back" (click)="store.view.set('departments')">← Back to Sub-Division View</button>

    @if (vm(); as v) {
      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>{{ v.scope.name }} <span class="code">· {{ v.scope.code }}</span></h2>
            <p class="sub">{{ v.subDivision.name }} · <span class="freq-badge fq-{{ v.scope.freq }}">{{ freqLabels[v.scope.freq] }}</span></p>
          </div>
          <button pButton label="Open Working Papers" class="p-button-sm"></button>
        </header>

        <div class="body">
          <div class="cards">
            <div class="card"><span class="k">Lead auditor</span><span class="v">{{ v.scope.auditor }}</span></div>
            <div class="card"><span class="k">Risk rating</span><span class="v"><span class="risk risk-{{ v.scope.risk }}">{{ v.scope.risk }}</span></span></div>
            <div class="card"><span class="k">Open RFIs</span><span class="v">{{ v.scope.rfi }}</span></div>
            <div class="card"><span class="k">Findings</span><span class="v" [class.danger]="v.scope.findings > 0">{{ v.scope.findings }}</span></div>
          </div>

          <h3>Scope jobs ({{ v.jobs.length }}) <small>— audit procedures executed each instance</small></h3>
          @for (j of v.jobs; track j.job.id) {
            <button class="job-row" (click)="openJob(j)">
              <span class="ref">{{ v.scope.code }}-{{ j.job.id.toUpperCase() }}</span>
              <span class="name">{{ j.job.name }}
                @if (j.job.run !== undefined) {
                  <span class="run-tag">{{ v.scope.freq === 'W' ? 'Wk' : 'Run' }} {{ j.job.run }}</span>
                }
              </span>
              <span class="hrs">{{ j.job.hrs }}h</span>
              <span class="tag st-{{ j.status }}">{{ meta[j.status].label }}</span>
              <i class="pi pi-chevron-right chev"></i>
            </button>
          }

          <div class="exec-head">
            <h3>Monthly execution — {{ store.year() }} <small>(hover for jobs, click for the record)</small></h3>
            <span class="exec-pct">
              <span class="dot"></span>{{ v.pct }}% complete · {{ v.done }}/{{ v.total }} instances
            </span>
          </div>

          <div class="exec-timeline">
            @for (m of v.cells; track m.monthIndex) {
              <div class="et-cell"
                   [class.q-gap]="m.monthIndex % 3 === 0 && m.monthIndex !== 0"
                   [class.today]="isCurrentMonth(m.monthIndex)"
                   [class.clickable]="m.status !== null"
                   (click)="openMonth(m)">
                <div class="et-box" [class.ghost]="m.status === null"
                     [style.background]="m.status ? cellBg[m.status] : null"
                     [style.color]="m.status ? cellTx[m.status] : null"
                     [pTooltip]="m.tooltip" [escape]="false"
                     tooltipPosition="top" tooltipStyleClass="jobs-tip">
                  <span class="et-month">{{ months[m.monthIndex] }}</span>
                  @if (m.runs.length > 1) {
                    <span class="et-runs">
                      @for (r of m.runs; track $index; let ri = $index) {
                        <i [style.background]="runSolid[r]"
                           [pTooltip]="m.runTooltips[ri] || ''" [escape]="false"
                           tooltipPosition="top" tooltipStyleClass="jobs-tip"
                           (click)="$event.stopPropagation(); openRun(m, ri)"></i>
                      }
                    </span>
                  } @else {
                    <span class="et-mark">{{ m.status ? meta[m.status].mark || '▸' : '·' }}</span>
                  }
                </div>
                @if (isCurrentMonth(m.monthIndex)) { <span class="et-today">Today</span> }
              </div>
            }
          </div>

          <p-progressBar [value]="v.pct" [showValue]="false" styleClass="exec-bar" />

          <div class="foot">
            <button pButton outlined size="small" label="View execution log →" (click)="store.view.set('log')"></button>
            <button pButton outlined size="small" label="Show on calendar" (click)="store.drillToMonth(v.firstMonth)"></button>
          </div>
        </div>
      </section>
    } @else {
      <p class="empty">Select a scope from the annual overview, calendar or sub-division view.</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .back { border: none; background: none; color: var(--ap-brand); font-weight: 600; font-size: 12.5px;
      cursor: pointer; padding: 0 0 12px; &:hover { text-decoration: underline; } }
    .empty { color: var(--ap-slate); font-size: 13px; }
    .panel { background: var(--ap-panel); border: 1px solid var(--ap-hairline); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow); }
    .panel-head { padding: 18px 22px; border-bottom: 1px solid var(--ap-hairline);
      display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      h2 { margin: 0; font-size: 17px; .code { font-size: 12px; color: var(--ap-slate); font-weight: 400; } }
      .sub { margin: 4px 0 0; font-size: 12.5px; color: var(--ap-slate); display: flex; align-items: center; gap: 8px; } }
    .body { padding: 18px 22px;
      h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
        color: var(--ap-slate); margin: 25px 0 8px; small { font-weight: 400; text-transform: none; letter-spacing: 0; } } }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: stretch;
      @media (max-width: 800px) { grid-template-columns: repeat(2, 1fr); } }
    .card { background: #FBFCFE; border: 1px solid var(--ap-hairline); border-radius: 8px; padding: 12px 14px;margin-bottom:0;
      display: flex; flex-direction: column; justify-content: center; gap: 6px;
      min-height: 64px; box-sizing: border-box;
      .k { font-size: 10px; color: var(--ap-slate); text-transform: uppercase; letter-spacing: .05em;
        font-weight: 700; line-height: 1; }
      /* flex value row: text and badges share one consistent line box → equal card heights */
      .v { font-size: 15px; font-weight: 600; line-height: 20px; height: 20px;
        display: flex; align-items: center;
        &.danger { color: var(--st-overdue-tx); } } }
    .job-row { display: flex; align-items: center; gap: 10px; padding: 9px 4px; width: 100%;
      border: none; border-bottom: 1px dashed var(--ap-hairline); background: none; cursor: pointer;
      text-align: left; font-family: inherit; font-size: 12.5px;
      &:hover { background: #FAFBFE; }
      .ref { font-size: 10.5px; color: var(--ap-slate); min-width: 86px; }
      .name { flex: 1; font-weight: 500; }
      .who, .hrs { font-size: 11.5px; color: var(--ap-slate); }
      .run-tag { font-size: 9px; font-weight: 700; color: var(--ap-slate); background: #EEF1F7;
        border-radius: 8px; padding: 1px 6px; margin-left: 5px; }
      .chev { font-size: 12px; color: var(--ap-slate); } }
    .tag { font-size: 10.5px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }

    /* ---- monthly execution timeline ---- */
    .exec-head { display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 8px; margin: 25px 0 14px;
      h3 { margin: 0; }
      .exec-pct { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px;
        font-weight: 600; color: var(--ap-sig); background: #F1F8F5;
        border: 1px solid #CFE5DC; border-radius: 20px; padding: 3px 12px;
        .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ap-sig); } } }
    .exec-timeline { display: flex; gap: 5px; margin-top: 18px; }
    .et-cell { flex: 1; min-width: 0; position: relative;
      &.q-gap { margin-left: 14px;
        &::before { content: ''; position: absolute; left: -9px; top: 4px; bottom: 4px;
          width: 1px; background: var(--ap-hairline); } }
      &.clickable { cursor: pointer;
        &:hover .et-box { transform: translateY(-2px); box-shadow: 0 4px 10px -3px rgba(18,32,59,.25); } }
      &.today .et-box { outline: 2px solid var(--ap-sig); outline-offset: 1px; } }
    .et-box { height: 48px; border-radius: 9px; border: 1px solid var(--ap-hairline);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      transition: transform .12s, box-shadow .12s; background: var(--surface-card);
      &.ghost { border-style: dashed; background: transparent;
        .et-month { color: #C2C9D8; } .et-mark { color: #D5DAE5; } } }
    .et-month { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      opacity: .8; line-height: 1; }
    .et-mark { font-size: 13px; font-weight: 700; line-height: 1; }
    .et-runs { display: flex; gap: 2px; width: 72%; height: 6px;
      i { flex: 1; border-radius: 2px; cursor: pointer;
        &:hover { outline: 1px solid var(--ap-ink); } } }
    .et-today { position: absolute; left: 50%; transform: translateX(-50%); top: -15px;
      font-size: 8.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
      color: var(--ap-sig); white-space: nowrap; }
    :host ::ng-deep .exec-bar { display: block; margin: 12px 0 30px;
      .p-progressbar { height: 6px; border-radius: 4px; } }

    /* multi-line job tooltip */
    :host ::ng-deep .jobs-tip .p-tooltip-text {
      font-size: 11.5px; line-height: 1.6; max-width: 280px;
      b { display: block; margin-bottom: 2px; }
    }
    .foot { margin-top: 14px; display: flex; gap: 8px; }
    .st-completed { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .st-planned  { background: var(--st-planned-bg);  color: var(--st-planned-tx); }
    .st-inprog   { background: var(--st-inprog-bg);   color: var(--st-inprog-tx); }
    .st-overdue  { background: var(--st-overdue-bg);  color: var(--st-overdue-tx); }
    .risk { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .risk-High   { background: var(--st-overdue-bg);   color: var(--st-overdue-tx); }
    .risk-Medium { background: var(--st-inprog-bg);    color: var(--st-inprog-tx); }
    .risk-Low    { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .freq-badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 10px;
      font-size: 10px; font-weight: 600; padding: 2px 8px;
      &::before { content: ''; width: 6px; height: 6px; border-radius: 50%; } }
    .fq-W  { background: var(--fq-W-bg);  color: var(--fq-W-tx);  border: 1px solid var(--fq-W);  &::before { background: var(--fq-W); } }
    .fq-BW { background: var(--fq-BW-bg); color: var(--fq-BW-tx); border: 1px solid var(--fq-BW); &::before { background: var(--fq-BW); } }
    .fq-M  { background: var(--fq-M-bg);  color: var(--fq-M-tx);  border: 1px solid var(--fq-M);  &::before { background: var(--fq-M); } }
    .fq-Q  { background: var(--fq-Q-bg);  color: var(--fq-Q-tx);  border: 1px solid var(--fq-Q);  &::before { background: var(--fq-Q); } }
    .fq-HY { background: var(--fq-HY-bg); color: var(--fq-HY-tx); border: 1px solid var(--fq-HY); &::before { background: var(--fq-HY); } }
    .fq-Y  { background: var(--fq-Y-bg);  color: var(--fq-Y-tx);  border: 1px solid var(--fq-Y);  &::before { background: var(--fq-Y); } }

    :host-context(.app-dark) {
      .card { background: var(--ap-panel); }
      .job-row:hover { background: var(--ap-hairline); }
      .run-tag { background: var(--ap-hairline); }
      .exec-pct { background: color-mix(in srgb, var(--ap-sig) 15%, var(--ap-panel)); border-color: color-mix(in srgb, var(--ap-sig) 35%, var(--ap-hairline)); }
      .et-box.ghost { .et-month { color: var(--ap-slate); } .et-mark { color: var(--ap-slate); } }
    }
  `],
})
export class ScopeDetailComponent {
  readonly store = inject(AuditPlanStore);
  private readonly jobDrawer = inject(ScopeJobDrawerService);
  readonly months = MONTHS;
  readonly meta = STATUS_META;
  readonly freqLabels = FREQ_LABELS;

  /** job row click → scope-job profile drawer */
  openJob(j: { job: { id: string; name: string; auditor: string; hrs: number; run?: number }; status: InstanceStatus }): void {
    const v = this.vm();
    if (!v) return;
    this.jobDrawer.openFromPlan({
      deptName: v.subDivision.name,
      scope: v.scope,
      job: j.job,
      monthIndex: v.focusMonth,
      year: this.store.year(),
      status: j.status,
      run: j.job.run,
    });
  }

  /** month cell click → drawer for that month's instance (leads with the first job) */
  openMonth(m: { monthIndex: number; status: InstanceStatus | null }): void {
    const v = this.vm();
    if (!v || !m.status) return;
    const job = v.scope.jobs[0];
    if (!job) return;
    this.jobDrawer.openFromPlan({
      deptName: v.subDivision.name,
      scope: v.scope,
      job,
      monthIndex: m.monthIndex,     // the clicked month — NOT focusMonth
      year: this.store.year(),
      status: m.status,
    });
  }

  /** W/BW run sliver click → drawer scoped to that run (its own job + status + week window) */
  openRun(m: { monthIndex: number; runs: InstanceStatus[] }, ri: number): void {
    const v = this.vm();
    if (!v) return;
    // run-specific job for this run, else the first repeating job
    const job = v.scope.jobs.find(j => (j as { run?: number }).run === ri + 1)
      ?? v.scope.jobs.find(j => (j as { run?: number }).run === undefined)
      ?? v.scope.jobs[0];
    if (!job) return;
    this.jobDrawer.openFromPlan({
      deptName: v.subDivision.name,
      scope: v.scope,
      job,
      monthIndex: m.monthIndex,
      year: this.store.year(),
      status: m.runs[ri],
      run: ri + 1,
    });
  }

  /** "today" ring only when viewing the current fiscal year */
  isCurrentMonth(monthIndex: number): boolean {
    const now = new Date();
    return this.store.year() === now.getFullYear() && monthIndex === now.getMonth();
  }

  /* inline-style palettes for the monthly strip — immune to CSS specificity/encapsulation.
   *  Reference the stc-x and st-x-bg / st-x-tx theme tokens (declared on the audit-plan shell host)
   *  so these stay theme-reactive instead of being frozen to a fixed light palette. */
  readonly runSolid: Record<InstanceStatus, string> = {
    completed: 'var(--stc-completed)', planned: 'var(--stc-planned)', inprog: 'var(--stc-inprog)', overdue: 'var(--stc-overdue)',
  };
  readonly cellBg: Record<InstanceStatus, string> = {
    completed: 'var(--st-completed-bg)', planned: 'var(--st-planned-bg)', inprog: 'var(--st-inprog-bg)', overdue: 'var(--st-overdue-bg)',
  };
  readonly cellTx: Record<InstanceStatus, string> = {
    completed: 'var(--st-completed-tx)', planned: 'var(--st-planned-tx)', inprog: 'var(--st-inprog-tx)', overdue: 'var(--st-overdue-tx)',
  };

  /** full view-model in one computed — the template stays logic-free */
  readonly vm = computed(() => {
    const found = this.store.selectedScope();
    if (!found) return null;
    const { subDivision, scope } = found;
    const total = scope.months.filter(Boolean).length;
    const done = scope.months.filter(m => m === 'completed').length;
    const firstMonth = Math.max(0, scope.months.findIndex(Boolean));
    const curMi = scope.months.findIndex(m => m === 'inprog' || m === 'overdue');
    const focusMonth = curMi > -1 ? curMi : firstMonth;
    const focusStatus = scope.months[focusMonth];

    const nRuns = runsPerMonth(scope.freq);
    const focusRuns = focusStatus ? runStatuses(focusStatus, nRuns) : [];

    /** jobs executed in a given run: run-specific (job.run === ri+1) + repeating (no run) */
    const jobsInRun = (ri: number) =>
      scope.jobs.filter(j => (j as { run?: number }).run === undefined || (j as { run?: number }).run === ri + 1);

    /** job titles with per-job status marks for ONE run, one per line (HTML for the tooltip) */
    const jobLinesForRun = (st: InstanceStatus, ri: number): string =>
      jobsInRun(ri)
        .map((job, ji) => `${STATUS_META[(job as { run?: number }).run !== undefined ? st : jobStatus(st, ji)].mark || '▸'} ${job.name}`)
        .join('<br>') || '<i>No jobs assigned</i>';
    /** all jobs for single-run months */
    const jobLinesAll = (st: InstanceStatus): string =>
      scope.jobs
        .map((job, ji) => `${STATUS_META[jobStatus(st, ji)].mark || '▸'} ${job.name}`)
        .join('<br>');

    return {
      subDivision, scope, total, done, firstMonth, focusMonth,
      pct: total ? Math.round((done / total) * 100) : 0,
      jobs: scope.jobs.map((job, ji) => ({
        job,
        status: !focusStatus ? 'planned' as const
          // run-specific job: status of its own run in the focus month
          : job.run !== undefined && nRuns > 1 ? focusRuns[job.run - 1] ?? focusStatus
          : jobStatus(focusStatus, ji),
      })),
      cells: scope.months.map((status, monthIndex) => {
        const runs = status ? runStatuses(status, nRuns) : [];
        return {
          monthIndex, status, runs,
          tooltip: status
            ? `<b>${MONTHS[monthIndex]} · ${STATUS_META[status].label}</b>${jobLinesAll(status)}`
            : `${MONTHS[monthIndex]} — not scheduled`,
          // each run's tooltip lists only that run's jobs (run-specific + repeating)
          runTooltips: runs.map((r, ri) =>
            `<b>${scope.freq === 'W' ? 'Wk' : 'Run'} ${ri + 1} · ${STATUS_META[r].label}</b>${jobLinesForRun(r, ri)}`),
        };
      }),
    };
  });
}