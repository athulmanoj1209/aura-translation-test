import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AuditPlanStore } from './audit-plan.store';
import { FREQ_LABELS, STATUS_META } from './models/audit-plan.model';

@Component({
  selector: 'ap-instance-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule],
  template: `
    @if (store.instanceVM(); as v) {
      <p-dialog
        [visible]="true" (visibleChange)="store.closeInstance()"
        [modal]="true" [style]="{ width: '540px', maxWidth: '94vw' }"
        [header]="(v.selectedJob ? v.selectedJob.job.name + ' · ' : '') + v.scope.name + ' — ' + v.monthLabel"
        [dismissableMask]="true" [draggable]="false">

        <h4>Scope details</h4>
        <div class="grid">
          <div class="card"><span class="k">{{ v.subDivision.isDivisionLevel ? 'Division' : 'Sub-Division' }}</span><span class="v">{{ v.subDivision.name }}</span></div>
          <div class="card"><span class="k">Scope status</span><span class="v"><span class="tag st-{{ v.status }}">{{ meta[v.status].label }}</span></span></div>
          <div class="card"><span class="k">Frequency</span><span class="v">{{ freqLabels[v.scope.freq] }}</span></div>
          <div class="card"><span class="k">Risk rating</span><span class="v"><span class="risk risk-{{ v.scope.risk }}">{{ v.scope.risk }}</span></span></div>
          <div class="card"><span class="k">Lead auditor</span><span class="v">{{ v.scope.auditor }}</span></div>
          <div class="card"><span class="k">Open RFIs</span><span class="v">{{ v.scope.rfi }}</span></div>
        </div>

        @if (v.runs.length > 1) {
          <h4>Runs — {{ v.monthLabel }} ({{ freqLabels[v.scope.freq] }})</h4>
          <div class="runs">
            @for (r of v.runs; track $index; let ri = $index) {
              <div class="run st-{{ r }}">
                <span class="rk">{{ v.scope.freq === 'W' ? 'Week' : 'Run' }} {{ ri + 1 }}</span>
                <span class="rv">{{ meta[r].label }}</span>
              </div>
            }
          </div>
        }

        @if (v.selectedJob; as sel) {
          <h4>Scope job details</h4>
          <div class="grid">
            <div class="card hi wide"><span class="k">Job</span><span class="v">{{ sel.job.name }}</span></div>
            <div class="card"><span class="k">Assigned to</span><span class="v">{{ sel.job.auditor }}</span></div>
            <div class="card"><span class="k">Job status</span><span class="v"><span class="tag st-{{ sel.status }}">{{ meta[sel.status].label }}</span></span></div>
            <div class="card"><span class="k">Estimated hours</span><span class="v">{{ sel.job.hrs }} h</span></div>
            <div class="card"><span class="k">Job ref.</span><span class="v mono">{{ v.scope.code }}-{{ sel.job.id.toUpperCase() }}</span></div>
          </div>
        }

        <h4>Scope jobs — this instance</h4>
        @for (j of v.jobs; track j.job.id) {
          <button class="job-row" [class.sel]="v.selectedJob?.job?.id === j.job.id"
                  (click)="store.openInstance({ scopeId: v.scope.id, monthIndex: v.monthIndex, jobId: j.job.id })">
            <span class="tag st-{{ j.status }}">{{ meta[j.status].label }}</span>
            <span class="name">{{ j.job.name }}
              @if (j.job.run !== undefined) {
                <span class="run-tag">{{ v.scope.freq === 'W' ? 'Wk' : 'Run' }} {{ j.job.run }}</span>
              }
            </span>
            <span class="who">{{ j.job.auditor }} · {{ j.job.hrs }}h</span>
          </button>
        }

        <h4>Findings this instance</h4>
        @if (v.scope.findings > 0) {
          @for (f of findingsArray(v.scope.findings); track f) {
            <div class="finding">
              <span class="fbadge">F-{{ 100 + f }}</span>
              <span class="ftext">Finding observation {{ f }} — awaiting management action plan</span>
              <span class="fstate">Open</span>
            </div>
          }
        } @else {
          <p class="none">No findings for this instance.</p>
        }

        <ng-template pTemplate="footer">
          <button pButton label="Open scope detail" size="small"
                  (click)="store.closeInstance(); store.drillToScope(v.scope.id)"></button>
          <button pButton label="Close" outlined size="small" (click)="store.closeInstance()"></button>
        </ng-template>
      </p-dialog>
    }
  `,
  styles: [`
    h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
      color: var(--ap-slate); margin: 16px 0 8px; &:first-of-type { margin-top: 0; } }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .card { background: #FBFCFE; border: 1px solid var(--ap-hairline); border-radius: 8px; padding: 10px 12px;
      display: flex; flex-direction: column; justify-content: center; gap: 4px; min-height: 54px; box-sizing: border-box;
      &.hi { border-color: var(--ap-sig); background: #F1F8F5; } &.wide { grid-column: 1 / -1; }
      .k { font-size: 10px; color: var(--ap-slate); text-transform: uppercase; letter-spacing: .05em; font-weight: 700; line-height: 1; }
      .v { font-size: 12.5px; font-weight: 600; line-height: 18px; height: 18px; display: flex; align-items: center;
        &.mono { font-variant-numeric: tabular-nums; } } }
    .runs { display: flex; gap: 6px; flex-wrap: wrap; }
    .run { flex: 1; min-width: 90px; text-align: center; padding: 8px 6px; border-radius: 8px;
      display: flex; flex-direction: column; gap: 2px;
      .rk { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
      .rv { font-size: 11.5px; font-weight: 600; } }
    .job-row { display: flex; align-items: center; gap: 8px; padding: 8px; width: 100%;
      border: none; border-bottom: 1px dashed var(--ap-hairline); background: none; cursor: pointer;
      text-align: left; font-family: inherit; font-size: 12.5px; border-radius: 6px;
      &.sel { background: #F1F8F5; } &:hover { background: #FAFBFE; }
      .name { flex: 1; } .who { font-size: 10.5px; color: var(--ap-slate); }
      .run-tag { font-size: 9px; font-weight: 700; color: var(--ap-slate); background: #EEF1F7;
        border-radius: 8px; padding: 1px 6px; margin-left: 5px; vertical-align: 1px; } }
    .tag { font-size: 10.5px; font-weight: 600; padding: 3px 10px; border-radius: 10px; white-space: nowrap; }
    .finding { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0;
      border-bottom: 1px dashed var(--ap-hairline); font-size: 12.5px; &:last-child { border-bottom: none; }
      .fbadge { background: var(--st-overdue-bg); color: var(--st-overdue-tx);
        padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
      .ftext { flex: 1; } .fstate { font-size: 10.5px; color: var(--ap-slate); } }
    .none { font-size: 12.5px; color: var(--ap-slate); }
    .st-completed { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .st-planned  { background: var(--st-planned-bg);  color: var(--st-planned-tx); }
    .st-inprog   { background: var(--st-inprog-bg);   color: var(--st-inprog-tx); }
    .st-overdue  { background: var(--st-overdue-bg);  color: var(--st-overdue-tx); }
    .risk { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .risk-High   { background: var(--st-overdue-bg);   color: var(--st-overdue-tx); }
    .risk-Medium { background: var(--st-inprog-bg);    color: var(--st-inprog-tx); }
    .risk-Low    { background: var(--st-completed-bg); color: var(--st-completed-tx); }

    :host-context(.app-dark) {
      .card { background: var(--ap-panel); &.hi { background: color-mix(in srgb, var(--ap-sig) 15%, var(--ap-panel)); } }
      .job-row.sel { background: color-mix(in srgb, var(--ap-sig) 15%, var(--ap-panel)); }
      .job-row:hover { background: var(--ap-hairline); }
      .run-tag { background: var(--ap-hairline); }
    }
  `],
})
export class InstanceDialogComponent {
  readonly store = inject(AuditPlanStore);
  readonly meta = STATUS_META;
  readonly freqLabels = FREQ_LABELS;

  findingsArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }
}