import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccordionModule } from 'primeng/accordion';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { AuditPlanStore } from './audit-plan.store';
import { FREQ_LABELS, InstanceStatus, MONTHS, STATUS_META } from './models/audit-plan.model';

@Component({
  selector: 'ap-department-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccordionModule, ProgressBarModule, TooltipModule],
  template: `
    <button class="back" (click)="store.view.set('calendar')">← Back to Month Calendar</button>

    <p-accordion [multiple]="true" [value]="['0']">
      @for (card of cards(); track card.subDivision.id; let i = $index) {
        <p-accordion-panel [value]="'' + i">
          <p-accordion-header>
            <div class="dept-hdr">
              <span class="name">{{ card.subDivision.name }}</span>
              <span class="count-pill">{{ card.scopes.length }} scope{{ card.scopes.length === 1 ? '' : 's' }}</span>
              <span class="pct-pill"><span class="dot"></span>{{ card.pct }}% done</span>
            </div>
          </p-accordion-header>
          <p-accordion-content>
            @for (row of card.rows; track row.scope.id) {
              <button class="scope-row" (click)="store.drillToScope(row.scope.id)">
                <span class="stripe bf-{{ row.scope.freq }}"></span>

                <span class="ident">
                  <span class="nm">{{ row.scope.name }}</span>
                  <span class="sub">{{ row.scope.code }} · {{ row.scope.auditor }}
                    <span class="freq-badge fq-{{ row.scope.freq }}">{{ freqLabels[row.scope.freq] }}</span>
                  </span>
                </span>

                <span class="mini-cal">
                  @for (m of row.scope.months; track $index; let mi = $index) {
                    <i class="mini" [class.qgap]="mi % 3 === 0 && mi !== 0"
                       [style.background]="m ? lightBg[m] : null"
                       [style.border-color]="m ? lightBd[m] : null"
                       [pTooltip]="months[mi] + (m ? ' · ' + meta[m].label : ' — not scheduled')"
                       tooltipPosition="top"></i>
                  }
                </span>

                <span class="s-pct" pTooltip="Instances completed">{{ row.pct }}%</span>
                <span class="tag st-{{ row.status }}">{{ meta[row.status].label }}</span>
                <span class="risk risk-{{ row.scope.risk }}">{{ row.scope.risk }}</span>
                <i class="pi pi-chevron-right chev"></i>
              </button>
            }

            <div class="completion">
              <span class="c-lbl">{{ card.subDivision.isDivisionLevel ? 'Division' : 'Sub-Division' }} completion</span>
              <p-progressBar [value]="card.pct" [showValue]="false" styleClass="ap-progress" />
              <span class="c-val">{{ card.pct }}%</span>
            </div>
          </p-accordion-content>
        </p-accordion-panel>
      }
    </p-accordion>
  `,
  styles: [`
    :host { display: block; }
    .back { border: none; background: none; color: var(--ap-brand); font-weight: 600; font-size: 12.5px;
      cursor: pointer; padding: 0 0 12px; &:hover { text-decoration: underline; } }

    /* ---- header ---- */
    .dept-hdr { display: flex; align-items: center; gap: 10px; width: 100%;
      .name { font-weight: 600; font-size: 14px; color: var(--ap-brand); flex: 1; }
      .count-pill { font-size: 10.5px; font-weight: 600; color: var(--ap-slate);
        background: #F1F3F8; border-radius: 20px; padding: 3px 10px; }
      .pct-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700;
        color: var(--ap-sig); background: #F1F8F5; border: 1px solid #CFE5DC;
        border-radius: 20px; padding: 3px 10px;
        .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ap-sig); } } }

    /* ---- scope row ---- */
    .scope-row { display: flex; align-items: center; gap: 12px; padding: 10px 8px 10px 0; width: 100%;
      border: none; border-bottom: 1px dashed var(--ap-hairline); background: none; cursor: pointer;
      text-align: left; font-family: inherit; border-radius: 8px;
      transition: background .12s;
      &:hover { background: #FAFBFE;
        .nm { color: var(--ap-brand); text-decoration: underline; }
        .chev { transform: translateX(2px); color: var(--ap-brand); } }
      &:last-of-type { border-bottom: none; }
      .stripe { width: 3px; align-self: stretch; border-radius: 2px; flex-shrink: 0; }
      .ident { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 180px;
        .nm { font-size: 13.5px; font-weight: 600; color: var(--ap-ink); }
        .sub { font-size: 11px; color: var(--ap-slate); display: flex; align-items: center; gap: 7px; } }
      .s-pct { font-size: 11.5px; font-weight: 700; color: var(--ap-ink-soft); min-width: 36px; text-align: right; }
      .chev { font-size: 12px; color: var(--ap-slate); transition: transform .12s; } }

    /* ---- mini calendar (solid, quarter-grouped) ---- */
    .mini-cal { display: flex; gap: 3px; flex: 1.4; max-width: 460px; min-width: 200px; align-items: center;
      .mini { flex: 1; height: 18px; border-radius: 4px; background: #F0F2F8;
        border: 1px solid transparent; box-sizing: border-box;
        transition: transform .1s;
        &:hover { transform: scaleY(1.2); }
        &.qgap { margin-left: 9px; } } }

    /* ---- footer completion ---- */
    .completion { display: flex; align-items: center; gap: 12px; margin-top: 12px;
      .c-lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
        color: var(--ap-slate); white-space: nowrap; }
      .c-val { font-size: 12px; font-weight: 700; color: var(--ap-sig); min-width: 36px; text-align: right; } }
    :host ::ng-deep .completion .ap-progress { flex: 1;
      .p-progressbar { height: 6px; border-radius: 4px; } }

    /* ---- pills ---- */
    .tag { font-size: 10.5px; font-weight: 600; padding: 3px 10px; border-radius: 10px; white-space: nowrap; }
    .st-completed { background: var(--st-completed-bg); color: var(--st-completed-tx); }
    .st-planned  { background: var(--st-planned-bg);  color: var(--st-planned-tx); }
    .st-inprog   { background: var(--st-inprog-bg);   color: var(--st-inprog-tx); }
    .st-overdue  { background: var(--st-overdue-bg);  color: var(--st-overdue-tx); }
    .risk { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .risk-High   { background: var(--st-overdue-bg);   color: var(--st-overdue-tx); }
    .risk-Medium { background: var(--st-inprog-bg);    color: var(--st-inprog-tx); }
    .risk-Low    { background: var(--st-completed-bg); color: var(--st-completed-tx); }

    .freq-badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 10px;
      font-size: 9.5px; font-weight: 600; padding: 1.5px 7px;
      &::before { content: ''; width: 5px; height: 5px; border-radius: 50%; } }
    .fq-W  { background: var(--fq-W-bg);  color: var(--fq-W-tx);  border: 1px solid var(--fq-W);  &::before { background: var(--fq-W); } }
    .fq-BW { background: var(--fq-BW-bg); color: var(--fq-BW-tx); border: 1px solid var(--fq-BW); &::before { background: var(--fq-BW); } }
    .fq-M  { background: var(--fq-M-bg);  color: var(--fq-M-tx);  border: 1px solid var(--fq-M);  &::before { background: var(--fq-M); } }
    .fq-Q  { background: var(--fq-Q-bg);  color: var(--fq-Q-tx);  border: 1px solid var(--fq-Q);  &::before { background: var(--fq-Q); } }
    .fq-HY { background: var(--fq-HY-bg); color: var(--fq-HY-tx); border: 1px solid var(--fq-HY); &::before { background: var(--fq-HY); } }
    .fq-Y  { background: var(--fq-Y-bg);  color: var(--fq-Y-tx);  border: 1px solid var(--fq-Y);  &::before { background: var(--fq-Y); } }
    /* frequency stripe solids */
    .bf-W { background: var(--fq-W); } .bf-BW { background: var(--fq-BW); } .bf-M { background: var(--fq-M); }
    .bf-Q { background: var(--fq-Q); } .bf-HY { background: var(--fq-HY); } .bf-Y { background: var(--fq-Y); }

    @media (max-width: 900px) {
      .mini-cal { display: none; }   /* keep rows readable on narrow screens */
    }

    :host-context(.app-dark) {
      .count-pill { background: var(--ap-hairline); }
      .pct-pill { background: color-mix(in srgb, var(--ap-sig) 15%, var(--ap-panel)); border-color: color-mix(in srgb, var(--ap-sig) 35%, var(--ap-hairline)); }
      .scope-row:hover { background: var(--ap-hairline); }
      .mini-cal .mini { background: var(--ap-hairline); }
    }
  `],
})
export class SubDivisionViewComponent {
  readonly store = inject(AuditPlanStore);
  readonly months = MONTHS;
  readonly meta = STATUS_META;
  readonly freqLabels = FREQ_LABELS;

  /** status palette for the mini-calendar (inline styles — no specificity issues).
   *  References the st-x-bg theme tokens (declared on the audit-plan shell host)
   *  so these stay theme-reactive instead of being frozen to a fixed light palette. */
  readonly lightBg: Record<InstanceStatus, string> = {
    completed: 'var(--st-completed-bg)', planned: 'var(--st-planned-bg)', inprog: 'var(--st-inprog-bg)', overdue: 'var(--st-overdue-bg)',
  };
  readonly lightBd: Record<InstanceStatus, string> = {
    completed: 'var(--stc-completed, #B9D89A)', planned: 'var(--stc-planned, #A8CBEF)', inprog: 'var(--stc-inprog, #F0CE9A)', overdue: 'var(--stc-overdue, #F0AFAF)',
  };

  /** sub-division cards enriched with per-scope status + completion % */
  readonly cards = computed(() =>
    this.store.subDivisionCards().map(card => ({
      ...card,
      rows: card.scopes.map(scope => {
        const m = scope.months.filter((x): x is InstanceStatus => x !== null);
        const total = m.length;
        const done = m.filter(x => x === 'completed').length;
        const status: InstanceStatus =
          m.includes('overdue') ? 'overdue'
          : m.includes('inprog') ? 'inprog'
          : total > 0 && done === total ? 'completed'
          : 'planned';
        return { scope, status, pct: total ? Math.round((done / total) * 100) : 0 };
      }),
    })));
}