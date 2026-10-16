import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { AuditPlanStore, LogRowVM } from './audit-plan.store';
import { MONTHS, STATUS_META, StatusMeta } from './models/audit-plan.model';
import { ScopeJobDrawerService } from '../scope-job/services/scope-job-drawer.service';

@Component({
  selector: 'ap-execution-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, SelectModule, FormsModule, TableModule],
  template: `
    <button class="back" (click)="store.view.set('scope')">← Back to Scope Detail</button>

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>Execution Log</h2>
          <p class="sub">Every job instance across the year. Global filters apply; add a month filter here.</p>
        </div>
        <p-select [options]="monthOptions" optionLabel="label" optionValue="value"
                  placeholder="All months" [showClear]="true"
                  [ngModel]="store.logMonthFilter()"
                  (ngModelChange)="store.logMonthFilter.set($event)" />
      </header>

      <div class="stats">
        <span class="pill"><b>{{ store.logRows().length }}</b> job instances</span>
        @for (st of statusKeys; track st) {
          <span class="pill"><b>{{ store.logCounts()[st] }}</b> {{ meta[st].label }}</span>
        }
      </div>

      <p-table
        [value]="store.logRows()"
        [paginator]="true" [rows]="25" [rowsPerPageOptions]="[25, 50, 100]"
        [sortMode]="'single'" dataKey="job.id"
        [tableStyle]="{ 'min-width': '900px', 'font-size': '12.5px' }">
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="monthIndex">Month <p-sortIcon field="monthIndex" /></th>
            <th pSortableColumn="subDivisionName">Sub-Division <p-sortIcon field="subDivisionName" /></th>
            <th>Scope Job</th>
            <th pSortableColumn="scope.name">Scope <p-sortIcon field="scope.name" /></th>
            <th>Freq.</th>
            <th pSortableColumn="status">Status <p-sortIcon field="status" /></th>
            <th>Auditor</th>
            <th class="c">Est. hrs</th>
            <th class="c">RFIs</th>
            <th class="c">Findings</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td class="mono b">{{ row.monthLabel }}
              @if (row.runs > 1) { <span class="runs">×{{ row.runs }} runs</span> }
            </td>
            <td class="muted">{{ row.subDivisionName }}</td>
            <td class="b link" (click)="open(row)">{{ row.job.name }}
              @if (row.job.run !== undefined) {
                <span class="run-tag">{{ row.scope.freq === 'W' ? 'Wk' : 'Run' }} {{ row.job.run }}</span>
              }
            </td>
            <td class="muted link" (click)="store.drillToScope(row.scope.id)">
              {{ row.scope.name }} <small>· {{ row.scope.code }}</small>
            </td>
            <td><span class="freq-badge fq-{{ row.scope.freq }}">{{ row.scope.freq }}</span></td>
            <td><span class="tag st-{{ row.status }}">{{ metaOf(row).label }}</span></td>
            <td class="muted">{{ row.job.auditor }}</td>
            <td class="c mono">{{ row.job.hrs }}</td>
            <td class="c">{{ row.scope.rfi }}</td>
            <td class="c" [class.danger]="row.scope.findings > 0">{{ row.scope.findings }}</td>
            <td class="c">
              <button pButton text size="small" icon="pi pi-eye" (click)="open(row)"></button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="11" class="muted" style="padding:16px">No records match the selected filters.</td></tr>
        </ng-template>
      </p-table>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .back { border: none; background: none; color: var(--ap-brand); font-weight: 600; font-size: 12.5px;
      cursor: pointer; padding: 0 0 12px; &:hover { text-decoration: underline; } }
    .panel { background: var(--ap-panel); border: 1px solid var(--ap-hairline); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow); overflow: hidden; }
    .panel-head { padding: 18px 22px; border-bottom: 1px solid var(--ap-hairline);
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      h2 { margin: 0; font-size: 16px; } .sub { margin: 3px 0 0; font-size: 12.5px; color: var(--ap-slate); } }
    .stats { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 22px;
      border-bottom: 1px solid var(--ap-hairline); background: #FBFCFE;
      .pill { background: var(--surface-card); border: 1px solid var(--ap-hairline); border-radius: 20px;
        padding: 4px 12px; font-size: 11.5px; color: var(--ap-slate); b { color: var(--ap-ink); } } }
    .c { text-align: center; } .b { font-weight: 600; } .muted { color: var(--ap-slate); }
    .mono { font-variant-numeric: tabular-nums; }
    .danger { color: var(--st-overdue-tx); font-weight: 700; }
    .link { cursor: pointer; &:hover { color: var(--ap-brand); text-decoration: underline; } }
    .runs { font-size: 9.5px; color: var(--ap-slate); font-weight: 400; margin-left: 4px; }
    .run-tag { font-size: 9px; font-weight: 700; color: var(--ap-slate); background: #EEF1F7;
      border-radius: 8px; padding: 1px 6px; margin-left: 5px; }
    .tag { font-size: 10.5px; font-weight: 600; padding: 3px 10px; border-radius: 10px; white-space: nowrap; }
    .st-completed { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .st-planned  { background: var(--st-planned-bg);  color: var(--st-planned-tx); }
    .st-inprog   { background: var(--st-inprog-bg);   color: var(--st-inprog-tx); }
    .st-overdue  { background: var(--st-overdue-bg);  color: var(--st-overdue-tx); }
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
      .stats { background: var(--ap-hairline); }
      .run-tag { background: var(--ap-hairline); }
    }
  `],
})
export class ExecutionLogComponent {
  readonly store = inject(AuditPlanStore);
  readonly meta = STATUS_META;
  readonly statusKeys = ['completed', 'inprog', 'planned', 'overdue'] as const;
  readonly monthOptions = MONTHS.map((label, value) => ({ label, value }));

  private readonly jobDrawer = inject(ScopeJobDrawerService);

  /** open the scope-job profile drawer for this log row */
  open(row: LogRowVM): void {
    this.jobDrawer.openFromPlan({
      deptName: row.subDivisionName,
      scope: row.scope,
      job: row.job,
      monthIndex: row.monthIndex,
      year: this.store.year(),
      status: row.status,
      run: row.job.run,
    });
  }

  /** typed accessor — p-table's `let-row` context is untyped, so index STATUS_META here */
  metaOf(row: LogRowVM): StatusMeta {
    return STATUS_META[row.status];
  }
}