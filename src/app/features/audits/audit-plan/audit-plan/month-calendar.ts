import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AuditPlanStore, CalendarChipVM, CalendarDayVM } from './audit-plan.store';
import { FREQ_COLOR, FREQ_LABELS, MONTHS, STATUS_META } from './models/audit-plan.model';
import { ScopeJobDrawerService } from '../scope-job/services/scope-job-drawer.service';

@Component({
  selector: 'ap-month-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TooltipModule],
  template: `
    <button class="back" (click)="store.view.set('annual')">← Back to Annual Overview</button>

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>Month Calendar</h2>
          <p class="sub">Scope jobs on their planned start day — weekly repeats every 7 days, bi-weekly every 14. Hover a chip for subDivision, scope &amp; status; click to open the job record.</p>
        </div>
        <div class="nav">
          <button pButton text icon="pi pi-chevron-left" (click)="shift(-1)"></button>
          <span class="title">{{ months[store.currentMonth()] }} {{ store.year() }}</span>
          <button pButton text icon="pi pi-chevron-right" (click)="shift(1)"></button>
        </div>
      </header>

      <div class="grid dow-row">
        @for (d of dow; track d) { <div class="dow">{{ d }}</div> }
      </div>
      <div class="grid">
        @for (cell of store.calendarDays(); track $index; let idx = $index) {
          <div class="day" [class.empty]="cell.day === null" [class.today]="cell.isToday"
               [class.weekend]="idx % 7 === 0 || idx % 7 === 6">
            @if (cell.day !== null) {
              <span class="daynum">{{ cell.day }}</span>
              @for (chip of visibleChips(cell); track chip.scope.id + '-' + chip.job.id + '-' + (chip.run ?? 0)) {
                <button class="chip st-{{ chip.status }}"
                        [style.border-left-color]="freqColor[chip.scope.freq]"
                        [pTooltip]="tooltipOf(chip)" tooltipPosition="top"
                        (click)="openChip(chip)">
                  <span class="mark">{{ meta[chip.status].mark || '▸' }}</span>
                  <span class="job-name">{{ chip.job.name }}</span>
                  @if (chip.run !== null) {
                    <span class="run">{{ chip.scope.freq === 'W' ? 'W' : 'R' }}{{ chip.run }}</span>
                  }
                </button>
              }
              @if (cell.chips.length > maxChips) {
                <button class="more" (click)="toggleDay(cell.day)">
                  {{ expandedDays().has(cell.day) ? 'Show less' : '+' + (cell.chips.length - maxChips) + ' more' }}
                </button>
              }
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .back { border: none; background: none; color: var(--ap-brand); font-weight: 600; font-size: 12.5px;
      cursor: pointer; padding: 0 0 12px; &:hover { text-decoration: underline; } }
    .panel { background: var(--ap-panel); border: 1px solid var(--ap-hairline); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow); }
    .panel-head { padding: 18px 22px; border-bottom: 1px solid var(--ap-hairline);
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      h2 { margin: 0; font-size: 16px; } .sub { margin: 3px 0 0; font-size: 12.5px; color: var(--ap-slate); }
      .nav { display: flex; align-items: center; gap: 8px;
        .title { font-weight: 600; font-size: 16px; min-width: 150px; text-align: center; } } }
    /* minmax(0,1fr) keeps all 7 columns identical — chip content can never widen a cell */
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .dow { padding: 10px 0; text-align: center; font-size: 10.5px; text-transform: uppercase;
      letter-spacing: .07em; color: var(--ap-slate); font-weight: 700; background: #FBFCFE;
      border-bottom: 1px solid var(--ap-hairline); }
    .day { min-height: 112px; min-width: 0; overflow: hidden;
      border-right: 1px solid var(--ap-hairline); border-bottom: 1px solid var(--ap-hairline);
      padding: 7px; &:nth-child(7n) { border-right: none; }
      &.weekend { background: #FBFCFE; }
      &.empty { background: #F6F8FB; } }
    .daynum { font-size: 12px; color: var(--ap-slate); font-weight: 600; }
    .more { margin-top: 4px; border: none; background: none; color: var(--ap-brand); font-size: 10.5px;
      font-weight: 700; cursor: pointer; padding: 2px 0; font-family: inherit;
      &:hover { text-decoration: underline; } }
    .day.today .daynum { background: var(--ap-sig); color: #fff; width: 20px; height: 20px;
      border-radius: 5px; display: grid; place-items: center; }
    .chip { margin-top: 5px; font-size: 11px; padding: 4px 6px; border-radius: 6px; display: flex;
      align-items: center; gap: 5px; cursor: pointer; border: none; border-left: 3px solid transparent;
      font-weight: 500; line-height: 1.25; width: 100%; text-align: left;
      &:hover { filter: brightness(.95); }
      .mark { font-size: 10px; flex-shrink: 0; }
      .job-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .run { font-size: 9px; opacity: .75; flex-shrink: 0; } }
    .st-completed { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .st-planned  { background: var(--st-planned-bg);  color: var(--st-planned-tx); }
    .st-inprog   { background: var(--st-inprog-bg);   color: var(--st-inprog-tx); }
    .st-overdue  { background: var(--st-overdue-bg);  color: var(--st-overdue-tx); }

    :host-context(.app-dark) {
      .dow { background: var(--ap-hairline); }
      .day.weekend { background: var(--ap-hairline); }
      .day.empty { background: var(--surface-ground); }
    }
  `],
})
export class MonthCalendarComponent {
  readonly store = inject(AuditPlanStore);
  readonly months = MONTHS;
  readonly dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly meta = STATUS_META;
  readonly freqColor = FREQ_COLOR;
  readonly freqLabels = FREQ_LABELS;

  /* ---- day overflow handling ---- */
  readonly maxChips = 3;
  readonly expandedDays = signal<ReadonlySet<number>>(new Set());

  visibleChips(cell: CalendarDayVM): CalendarChipVM[] {
    if (cell.day === null) return [];
    return this.expandedDays().has(cell.day) ? cell.chips : cell.chips.slice(0, this.maxChips);
  }

  toggleDay(day: number): void {
    this.expandedDays.update(set => {
      const next = new Set(set);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  shift(delta: number): void {
    this.store.shiftMonth(delta);
    this.expandedDays.set(new Set()); // collapse when the month changes
  }

  /** hover: sub-division · scope · status (plus run & frequency context) */
  tooltipOf(chip: CalendarChipVM): string {
    const run = chip.run !== null
      ? ` · ${chip.scope.freq === 'W' ? 'Week' : 'Run'} ${chip.run}/${chip.totalRuns}` : '';
    return `${chip.subDivisionName} · ${chip.scope.name} (${chip.scope.code})`
      + ` · ${STATUS_META[chip.status].label}${run} · ${FREQ_LABELS[chip.scope.freq]}`;
  }

  private readonly jobDrawer = inject(ScopeJobDrawerService);

  /** click: open the scope-job profile drawer for this job */
  openChip(chip: CalendarChipVM): void {
    this.jobDrawer.openFromPlan({
      deptName: chip.subDivisionName,
      scope: chip.scope,
      job: chip.job,
      monthIndex: this.store.currentMonth(),
      year: this.store.year(),
      status: chip.status,
      run: chip.run ?? undefined,
    });
  }
}