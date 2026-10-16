import { Component, OnInit, OnChanges, SimpleChanges, Input, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { ChartModule, UIChart } from 'primeng/chart';
import { DonutStatusChartComponent, DonutLegendItem } from '@/app/shared/components/donut-status-chart/donut-status-chart.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { TabsModule } from 'primeng/tabs';
import { FileDownloadService } from '@/app/core/services/file-download.service';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import {
  ClientDashboardDetailDrawerComponent,
  DashboardDetailDrawerData,
  DashboardDetailRow,
} from './client-dashboard-detail-drawer/client-dashboard-detail-drawer.component';

import {
  UserRole,
  KpiCard,
  ScopeItem,
  RfiItem,
  RfiStatus,
  AuditNotification,
  ReportItem,
  UpcomingAudit,
} from '../models/client-dashboard.model';

interface CalendarDay {
  day: number | null;
  audits: UpcomingAudit[];
}

/** Which unit a "… by Division / Sub-Division" view groups by. */
type UnitView = 'division' | 'subDivision';

/** Where a scope / RFI sits: on a division itself, or on one sub-division of a division. */
interface DashboardUnit {
  division: string;
  /** null for a division-level unit. */
  subDivision: string | null;
}

/** Distinct units in first-appearance order, sub-divisions grouped by their division. */
function distinctUnits(units: DashboardUnit[]): DashboardUnit[] {
  const byDivision = new Map<string, DashboardUnit[]>();
  for (const u of units) {
    const list = byDivision.get(u.division) ?? [];
    byDivision.set(u.division, list);
    if (!list.some(x => x.subDivision === u.subDivision)) list.push(u);
  }
  return [...byDivision.values()].flat();
}

/** Division name, or a two-line sub-division / parent-division chart label. */
function unitLabel(u: DashboardUnit): string | string[] {
  return u.subDivision === null ? u.division : [u.subDivision, `↳ ${u.division}`];
}

// Live RFI source — the same in-memory store rfi-management-client.ts reads via this exact
// function. Calling it fresh (in loadRfiData() below) rather than snapshotting numbers means
// an RFI an auditor adds via the Add RFI drawer (which calls upsertStaticRfi() on this same
// store) shows up here the next time the dashboard loads or the Refresh button is clicked —
// there's no push/observable layer in this app, so it isn't live while the page just sits open.
import { getAllEnrichedRfis } from '@/app/features/audits/audit-execution/rfi-management/rfi-static-data';
import type { EnrichedStaticRfi } from '@/app/features/audits/audit-execution/rfi-management/models/rfi-static.model';
import { LayoutService } from '@/app/layout/service/layout.service';
import { ClientScope, getAllClientScopes } from '../audit-scope-summary/audit-scope-summary.component';


// Tells the Sub-Division Head persona below which sub-division to represent. NOTE: this import path is
// a best guess ('@/app/core/client-mode') — point it at wherever client-mode.ts actually lives
// in this project (same file the static seed files and app.config.ts's CLIENT_MODE provider
// both read CLIENT_MODE_VALUE from) if it differs.
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';

// The internal-audit sub-division seed (single org, DAR Exchange) — read here so the Sub-Division Head
// persona's HR sub-division name below always matches whatever the Sub-Divisions page itself shows
// for CLIENT_MODE_VALUE === 'internal-audit', instead of a separately hardcoded label that could
// drift out of sync with this seed. NOTE: this import path is a best guess — point it at wherever
// sub-division-static-indi-org.data.ts actually lives (it sits next to sub-division-static-data.ts,
// per that file's own `import type { StaticCompany } from './sub-division-static-data'`).
import { SUB_DIVISION_INDI_ORG_COMPANIES } from '@/app/features/audits/organization/sub-divisions/sub-division-static-indi-org.data';

// Live scope source — the same in-memory store audit-scope-summary.component.ts's own
// ngOnInit() reads (`getAllClientScopes()` was added there to expose it). Calling it fresh (in
// loadScopeData() below) means a scope added/updated on that page is reflected here too, on
// the same "reloads on load/role-change/Refresh" cadence as the RFI data above.
// Real path confirmed from that component's own actual import of its sibling static-data module
// ('@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data') — update this one line if
// audit-scope-summary.component.ts ever moves out of that directory.

/**
 * Returns the first sub-division's real display name in the internal-audit seed (sub-division-
 * static-indi-org.data.ts) — the first company's first division's first sub-division — rather than
 * assuming a fixed hardcoded label, since SUB_DIVISION_INDI_ORG_COMPANIES could grow/reorder.
 * Returns undefined only if the seed has no sub-divisions at all.
 */
function firstIndiOrgSubDivisionName(): string | undefined {
  for (const company of SUB_DIVISION_INDI_ORG_COMPANIES) {
    for (const division of company.divisions) {
      if (division.subDivisions.length) return division.subDivisions[0].subDivisionName;
    }
  }
  return undefined;
}

// Resolved once at module load — this is 'HR Dept' per sub-division-static-indi-org.data.ts's
// DAR-BR-04 entry today (its first sub-division). Falls back to the literal 'HR Dept' only if the
// seed ever ends up with no sub-divisions at all, so this dashboard never silently ends up with
// `undefined` as a filter value.
const INDI_ORG_HR_SUB_DIVISION_NAME = firstIndiOrgSubDivisionName() ?? 'HR Dept';

// Placeholder source used until report files are served per-report by the backend.
const SAMPLE_REPORT_FILE_URL =
  `assets/data/org-static-data/dar-exchange/${encodeURIComponent('ABC Broadcast - IA  Draft H1_2025 1.0-Report.docx')}`;

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TagModule,
    ProgressBarModule,
    BadgeModule,
    ButtonModule,
    AvatarModule,
    TooltipModule,
    DividerModule,
    ChipModule,
    DialogModule,
    ChartModule,
    SelectModule,
    DonutStatusChartComponent,

    DrawIconComponent,],
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDashboardComponent implements OnInit, OnChanges {
  @Input() role: UserRole = 'CFO';
   // @Input() role: UserRole = 'SUB_DIVISION_HEAD';

  isCfo = true;

  // Exposes CLIENT_MODE_VALUE to the template (a template can't reference an imported const
  // directly) — gates the Sub-Division Head sub-division picker below, internal-audit mode only.
  readonly isInternalAudit = CLIENT_MODE_VALUE === 'internal-audit';

  // Sub-Division Head "Viewing as" sub-division picker (internal-audit mode only) — which of
  // SUB_DIVISION_INDI_ORG_COMPANIES' sub-divisions this persona currently represents. `null` until
  // first set (see loadSubDivisionHeadData()), at which point it defaults to INDI_ORG_HR_SUB_DIVISION_NAME.
  selectedSubDivision: string | null = null;

  /** Sub-Division picker options for the internal-audit Sub-Division Head view — every sub-division
   *  in the internal-audit sub-division seed. */
  get subDivisionOptions(): { label: string; value: string }[] {
    return SUB_DIVISION_INDI_ORG_COMPANIES.flatMap((company) =>
      company.divisions.flatMap((division) => division.subDivisions),
    ).map((subDivision) => ({ label: subDivision.subDivisionName, value: subDivision.subDivisionName }));
  }

  /** Sub-Division Head sub-division picker changed — reloads RFIs/scopes/KPIs scoped to the newly
   *  selected sub-division only. */
  onSubDivisionChange(): void {
    this.loadSubDivisionHeadData();
    this.resetUpcomingCalendar();
    this.cdr.markForCheck();
  }

 rfiStatusChartData: any;
  // ── Main data ────────────────────────────────────────────────────────────
  kpis: KpiCard[] = [];
  rfiKpis: KpiCard[] = [];
  scopes: ScopeItem[] = [];
  rfis: RfiItem[] = [];
  notifications: AuditNotification[] = [];
  reports: ReportItem[] = [];
  upcomingAudits: UpcomingAudit[] = [];

  // ── Upcoming Audits: list / calendar view toggle ────────────────────────
  readonly weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  upcomingView: 'list' | 'calendar' = 'list';
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();

  setUpcomingView(view: 'list' | 'calendar'): void {
    this.upcomingView = view;
  }

  get calendarMonthLabel(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get calendarDays(): CalendarDay[] {
    const firstOfMonth = new Date(this.calendarYear, this.calendarMonth, 1);
    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
    const days: CalendarDay[] = [];

    for (let i = 0; i < firstOfMonth.getDay(); i++) {
      days.push({ day: null, audits: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const audits = this.upcomingAudits.filter(a =>
        a.date.getFullYear() === this.calendarYear &&
        a.date.getMonth() === this.calendarMonth &&
        a.date.getDate() === d,
      );
      days.push({ day: d, audits });
    }
    return days;
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) {
      this.calendarMonth = 11;
      this.calendarYear--;
    } else {
      this.calendarMonth--;
    }
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear++;
    } else {
      this.calendarMonth++;
    }
  }

  /** Jumps the calendar to the month of the first upcoming audit whenever the audit list (re)loads. */
  private resetUpcomingCalendar(): void {
    const first = this.upcomingAudits[0]?.date ?? new Date();
    this.calendarYear = first.getFullYear();
    this.calendarMonth = first.getMonth();
  }

  // ── Previews + "View all" drawers ───────────────────────────────────────
  // The Audits / RFIs charts and the Scope summary each show only their first
  // PREVIEW_COUNT items; "View all" opens ClientDashboardDetailDrawerComponent,
  // which lists every item of the card's current view with pagination.
  readonly PREVIEW_COUNT = 5;

  /** The Scope summary card's preview — the first few of `listedScopes`. */
  get previewScopes(): ScopeItem[] {
    return this.listedScopes.slice(0, this.PREVIEW_COUNT);
  }

  // ── Division | Sub-Division toggles (CFO view) ──────────────────────────
  // Some divisions are audited as a whole (division-level scopes / RFIs),
  // others per sub-division. "Audits by …", "RFIs by …" and the Scope
  // summary each get a "View by" toggle that splits their data between the
  // two — each scope / RFI shows up in exactly one view:
  //  - Division: only division-level scopes / RFIs.
  //  - Sub-Division (default): only sub-division ones, labelled with their
  //    parent division.
  readonly unitViews: { key: UnitView; label: string }[] = [
    { key: 'division', label: 'Division' },
    { key: 'subDivision', label: 'Sub-Division' },
  ];

  auditsByView: UnitView = 'subDivision';
  rfisByView: UnitView = 'subDivision';
  scopeListView: UnitView = 'subDivision';

  /** Every unit of each chart's current view, with its counts — the charts plot
   *  the first PREVIEW_COUNT, the "View all" drawers list them all. */
  auditUnitRows: { unit: DashboardUnit; engagements: number }[] = [];
  rfiUnitRows: { unit: DashboardUnit; total: number; open: number; overdue: number }[] = [];

  /** Every live CFO RFI (unscoped) — kept so the "RFIs by …" toggle can rebuild its chart. */
  private allRfisForChart: EnrichedStaticRfi[] = [];

  unitViewLabel(view: UnitView): string {
    return this.unitViews.find(v => v.key === view)!.label;
  }

  setAuditsByView(view: UnitView): void {
    this.auditsByView = view;
    this.auditsBySubDivisionChartData = this.buildAuditsBySubDivisionChartData();
  }

  setRfisByView(view: UnitView): void {
    this.rfisByView = view;
    this.buildRfisByUnitChart();
  }

  setScopeListView(view: UnitView): void {
    this.scopeListView = view;
  }

  /** The Scope summary list: CFO view splits it by the toggle; the Sub-Division Head
   *  view keeps its own (already sub-division-scoped) list. */
  get listedScopes(): ScopeItem[] {
    if (!this.isCfo) return this.scopes;
    return this.scopes.filter(s => !!s.divisionLevel === (this.scopeListView === 'division'));
  }

  /** Unit name + its parent division (blank for a division-level unit). */
  private unitCells(u: DashboardUnit): DashboardDetailRow {
    return u.subDivision === null
      ? { unit: u.division, division: '—' }
      : { unit: u.subDivision, division: u.division };
  }

  private viewNoun(view: UnitView, plural = false): string {
    return view === 'division' ? (plural ? 'divisions' : 'division') : (plural ? 'sub-divisions' : 'sub-division');
  }

  openAuditsDetail(): void {
    const noun = this.viewNoun(this.auditsByView);
    const total = this.auditUnitRows.reduce((s, r) => s + r.engagements, 0);
    this.drawer.open<void, DashboardDetailDrawerData>(ClientDashboardDetailDrawerComponent, {
      width: '720px',
      data: {
        title: `Audits by ${noun}`,
        subtitle: `${this.auditUnitRows.length} ${this.viewNoun(this.auditsByView, true)} · ${total} engagements`,
        entityLabel: this.viewNoun(this.auditsByView, true),
        chart: {
          labelKey: 'unit',
          sublabelKey: 'division',
          series: [{ key: 'engagements', label: 'Engagements', color: '#4169E1' }],
        },
        columns: [
          { key: 'unit', label: this.unitViewLabel(this.auditsByView) },
          ...(this.auditsByView === 'subDivision' ? [{ key: 'division', label: 'Division' }] : []),
          { key: 'engagements', label: 'Engagements', numeric: true },
        ],
        rows: this.auditUnitRows.map(r => ({ ...this.unitCells(r.unit), engagements: r.engagements })),
      },
    });
  }

  openRfisDetail(): void {
    const noun = this.viewNoun(this.rfisByView);
    this.drawer.open<void, DashboardDetailDrawerData>(ClientDashboardDetailDrawerComponent, {
      width: '760px',
      data: {
        title: `RFIs by ${noun}`,
        subtitle: `${this.rfiUnitRows.length} ${this.viewNoun(this.rfisByView, true)} · open vs overdue`,
        entityLabel: this.viewNoun(this.rfisByView, true),
        chart: {
          labelKey: 'unit',
          sublabelKey: 'division',
          series: [
            { key: 'total',   label: 'Total RFIs', color: this.SUB_DIVISION_BAR_COLORS.total },
            { key: 'open',    label: 'Open',       color: this.SUB_DIVISION_BAR_COLORS.open },
            { key: 'overdue', label: 'Overdue',    color: this.SUB_DIVISION_BAR_COLORS.overdue },
          ],
        },
        columns: [
          { key: 'unit', label: this.unitViewLabel(this.rfisByView) },
          ...(this.rfisByView === 'subDivision' ? [{ key: 'division', label: 'Division' }] : []),
          { key: 'total', label: 'Total RFIs', numeric: true },
          { key: 'open', label: 'Open', numeric: true },
          { key: 'overdue', label: 'Overdue', numeric: true },
        ],
        rows: this.rfiUnitRows.map(r => ({ ...this.unitCells(r.unit), total: r.total, open: r.open, overdue: r.overdue })),
      },
    });
  }

  openScopesDetail(): void {
    const cfo = this.isCfo;
    const plural = this.viewNoun(this.scopeListView, true);
    this.drawer.open<void, DashboardDetailDrawerData>(ClientDashboardDetailDrawerComponent, {
      width: '820px',
      data: {
        title: cfo ? `Scope summary — all ${plural}` : 'My scope',
        subtitle: `${this.listedScopes.length} scope items`,
        entityLabel: 'scope items',
        // Progress per scope, each bar in its status colour (same palette as the card's progress bars).
        chart: {
          labelKey: 'name',
          horizontal: true,
          percent: true,
          series: [{ key: 'progress', label: 'Progress', color: '#378ADD' }],
          colorBy: { key: 'status', colors: this.progressColor },
        },
        columns: [
          { key: 'name', label: 'Scope' },
          ...(cfo && this.scopeListView === 'subDivision' ? [{ key: 'subDivision', label: 'Sub-Division' }] : []),
          ...(cfo ? [{ key: 'division', label: 'Division' }] : []),
          { key: 'progress', label: 'Progress', numeric: true, percent: true },
          { key: 'status', label: 'Status', tag: true },
        ],
        rows: this.listedScopes.map(s => ({
          name: s.name,
          subDivision: s.ownSubDivision ?? s.subDivision ?? '—',
          division: s.division ?? '—',
          progress: s.progress,
          status: s.status,
        })),
        tagSeverity: this.scopeSeverity,
      },
    });
  }

  // ── Chart data ───────────────────────────────────────────────────────────
  auditStatusLegend: DonutLegendItem[] = [];

  auditsBySubDivisionChartData: any;
  auditsBySubDivisionChartOptions: any;

  /** Highlights the hovered category's full column, matching the overall dashboard's Audits by Sub-Division chart. */
  private readonly auditsBySubDivisionHoverBandPlugin = {
    id: 'auditsBySubDivisionHoverBand',
    beforeDatasetsDraw: (chart: any) => {
      const active = chart.getActiveElements();
      if (!active || !active.length) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales['x'];
      const index = active[0].index;
      const bandWidth = xScale.width / xScale.ticks.length;
      const centerX = xScale.getPixelForTick(index);
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(centerX - bandWidth / 2, chartArea.top, bandWidth, chartArea.bottom - chartArea.top);
      ctx.restore();
    },
  };

  readonly auditsBySubDivisionHoverBandPlugins = [this.auditsBySubDivisionHoverBandPlugin];

  /** Highlights the hovered sub-division's full column, matching the Audits by Sub-Division chart. */
  private readonly rfisBySubDivisionHoverBandPlugin = {
    id: 'rfisBySubDivisionHoverBand',
    beforeDatasetsDraw: (chart: any) => {
      const active = chart.getActiveElements();
      if (!active || !active.length) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales['x'];
      const index = active[0].index;
      const bandWidth = xScale.width / xScale.ticks.length;
      const centerX = xScale.getPixelForTick(index);
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(centerX - bandWidth / 2, chartArea.top, bandWidth, chartArea.bottom - chartArea.top);
      ctx.restore();
    },
  };

  readonly rfisBySubDivisionHoverBandPlugins = [this.rfisBySubDivisionHoverBandPlugin];

  rfiStatusLegend: DonutLegendItem[] = [];

  rfisBySubDivisionChartData: any;
  rfisBySubDivisionChartOptions: any;

  /* Built-in legend disabled — `rfisBySubDivisionLegend` renders the same info as a
   * custom HTML legend below the canvas instead, styled to match the RFI
   * status distribution donut's legend. */
  rfisBySubDivisionLegend: DonutLegendItem[] = [];
  rfisBySubDivisionHidden: boolean[] = [];

  @ViewChild('rfisBySubDivisionChart') private rfisBySubDivisionChartRef?: UIChart;

  /** Toggles a dataset's visibility when its legend entry is clicked. */
  toggleRfisBySubDivisionDataset(index: number): void {
    const chart = this.rfisBySubDivisionChartRef?.chart;
    if (!chart) return;
    chart.setDatasetVisibility(index, !chart.isDatasetVisible(index));
    chart.update();
    this.rfisBySubDivisionHidden[index] = !this.rfisBySubDivisionHidden[index];
  }

  // ── Notification modal ───────────────────────────────────────────────────
  notifDialogVisible = false;
  selectedNotif: AuditNotification | null = null;
  readonly DESCRIPTION_TRUNCATE_LENGTH = 80;

  // ── Lookup maps ──────────────────────────────────────────────────────────
  // Matches rfi-management-client.ts's own statusSeverity()/statusLabel() — the real RFI
  // pool (rfi-static-data.ts) only ever uses these 5 statuses, not the old placeholder set.
  readonly rfiSeverity: Record<string, 'danger' | 'warn' | 'success' | 'info' | 'secondary'> = {
    Overdue: 'danger',
    Pending: 'warn',
    'Under Review': 'secondary',
    Reopened: 'danger',
    Completed: 'success',
  };

  readonly scopeSeverity: Record<string, 'danger' | 'warn' | 'success' | 'info' | 'secondary'> = {
    'On track': 'success',
    'In progress': 'info',
    'At risk': 'warn',
    Delayed: 'danger',
    Completed: 'success',
    'Not started': 'danger',
    Pending: 'warn',
    // Added alongside ScopeStatus's 'Overdue' | 'Planned' additions — without these, a scope
    // tagged Overdue/Planned would render its p-tag with no severity at all (blank styling)
    // instead of a colour matching audit-scope-summary.component.ts's own choice for that status.
    Overdue: 'danger',
    Planned: 'secondary',
  };

  readonly upcomingAuditSeverity: Record<string, 'danger' | 'warn' | 'success' | 'info' | 'secondary'> = {
    'In Progress': 'info',
    Planned: 'secondary',
    Completed: 'success',
    Overdue: 'danger',
  };

  readonly notifIcon: Record<string, string> = {
    danger: 'pi pi-exclamation-circle',
    warn: 'pi pi-exclamation-triangle',
    info: 'pi pi-info-circle',
    secondary: 'pi pi-check-circle',
  };

  readonly progressColor: Record<string, string> = {
    'On track': '#1D9E75',
    'In progress': '#378ADD',
    'At risk': '#EF9F27',
    Delayed: '#E24B4A',
    Completed: '#1D9E75',
    'Not started': '#E24B4A',
    Pending: '#EF9F27',
    // Added alongside ScopeStatus's 'Overdue' | 'Planned' additions — same reasoning as
    // scopeSeverity above: without these the progress bar for an Overdue/Planned scope would
    // fall back to the CSS default (--bar-color unset) instead of a colour matching its status.
    Overdue: '#E24B4A',
    Planned: '#94a3b8',
  };

  // ── Chart palette ────────────────────────────────────────────────────────
  private readonly AUDIT_STATUS_COLORS = ['#4169E1', '#9E9E9E', '#4CAF50', '#EF4444'];
  // Same 5 colors rfi-management-client.scss uses for its own stat cards, so the pie chart
  // here reads as the same palette as the full RFI Management page.
  private readonly RFI_STATUS_COLOR_MAP: Record<string, string> = {
    Pending: '#f59e0b',
    Overdue: '#ef4444',
    'Under Review': '#6366f1',
    Reopened: '#f97316',
    Completed: '#10b981',
  };
  private readonly SUB_DIVISION_BAR_COLORS = { total: '#4169E1', open: '#FF9800', overdue: '#EF4444' };

  private buildLegend(labels: string[], values: number[], colors: string[]): DonutLegendItem[] {
    return labels.map((label, i) => ({ label, value: values[i], color: colors[i] }));
  }

  // Maps rfi-static-data.ts's lowercase-hyphen status vocabulary to this dashboard's
  // Title Case labels (same 5 statuses, just different casing/spacing conventions).
  private readonly STATUS_LABEL_MAP: Record<EnrichedStaticRfi['status'], RfiStatus> = {
    pending: 'Pending',
    overdue: 'Overdue',
    'under-review': 'Under Review',
    reopened: 'Reopened',
    completed: 'Completed',
  };

  // Maps audit-scope-summary.component.ts's status vocabulary ('not-started' | 'planned' |
  // 'in-progress' | 'overdue' | 'completed') to this dashboard's ScopeStatus labels.
  private readonly SCOPE_STATUS_LABEL_MAP: Record<ClientScope['status'], 'Not started' | 'Planned' | 'In progress' | 'Overdue' | 'Completed'> = {
    'not-started': 'Not started',
    planned: 'Planned',
    'in-progress': 'In progress',
    overdue: 'Overdue',
    completed: 'Completed',
  };

  // Mirrors audit-scope-summary.component.ts's own `subDivisionLabels` map exactly (now the
  // real, already-human-readable sub-division names — no more short-code translation needed),
  // so a scope's `linkedSubDivisions` render identically on this dashboard as they do on that
  // page.
  private readonly SCOPE_SUB_DIVISION_LABEL_MAP: Record<string, string> = {
    'Finance & Accounts': 'Finance & Accounts',
    'Retail Operations': 'Retail Operations',
    'Inventory & Warehouse': 'Inventory & Warehouse',
    'Compliance & AML': 'Compliance & AML',
    'Human Resources': 'Human Resources',
    'IT & Systems': 'IT & Systems',
    'Procurement': 'Procurement',
    'Quality Assurance': 'Quality Assurance',
    'Logistics': 'Logistics',
    'Customer Service': 'Customer Service',
  };

  // ── Navigation targets ───────────────────────────────────────────────────
  // NOTE: adjust these paths to match your app routing if they differ.
  private readonly RFI_ROUTE   = ['/client/manage-client-rfi'];
  private readonly SCOPE_ROUTE = ['/client/scope-summary'];

  // Sub-division used for the Sub-Division Head persona's RFI pool (rfi-static-data.ts's
  // `subDivisionValue`). NOTE: rfi-management-client.ts's own shipped default is
  // 'Human Resources' (its `sub-division` field), not this — change this constant if the
  // Sub-Division Head persona should line up with that page's default instead of Finance & Accounts
  // (which is what this dashboard's Scope tab is currently built around, per audit-scope-
  // summary.component.ts's "Finance" filtered view).
  //
  // Exception: when this build is running in 'internal-audit' CLIENT_MODE (single-company
  // internal-audit client, per client-mode.ts), the Sub-Division Head persona represents HR — using
  // INDI_ORG_HR_SUB_DIVISION_NAME, the real sub-division name read from sub-division-static-
  // indi-org.data.ts (currently 'HR Dept', its DAR-BR-04 entry) rather than a separately hardcoded
  // 'Human Resources' label that could drift out of sync with that seed. NOTE: this only lines
  // up rfi-static-data.ts's filtering correctly if that file's own internal-audit RFI records
  // use this same 'HR Dept' subDivisionValue string — check that if Sub-Division Head RFIs come up empty.
  private get SUB_DIVISION_HEAD_SUB_DIVISION(): string {
    if (CLIENT_MODE_VALUE === 'internal-audit') {
      return this.selectedSubDivision ?? INDI_ORG_HR_SUB_DIVISION_NAME;
    }
    return 'Finance & Accounts';
  }

  // Sub-division used for the Sub-Division Head persona's Scope pool. Mirrors SUB_DIVISION_HEAD_SUB_DIVISION
  // above (same 'internal-audit' → INDI_ORG_HR_SUB_DIVISION_NAME override) — audit-scope-summary.
  // component.ts's data source moved from its own short sub-division codes ('finance') to the
  // real auditscopestaticdata.ts vocabulary, which uses the identical full sub-division names
  // rfi-static-data.ts already used. Kept as a separate constant (rather than reusing
  // SUB_DIVISION_HEAD_SUB_DIVISION directly) only because the two source pages are independent and could
  // diverge again later; change both together if you change which sub-division this persona
  // represents. NOTE: this only lines up audit-scope-summary.component.ts's filtering correctly
  // if that internal-audit scope data's `linkedSubDivisions` also uses 'HR Dept' — check that if
  // the Sub-Division Head Scope tab comes up empty.
  private get SUB_DIVISION_HEAD_SCOPE_SUB_DIVISION(): string {
    return this.SUB_DIVISION_HEAD_SUB_DIVISION;
  }

  private readonly kpiNav: Record<string, { path: string[]; status?: string }> = {
    // Overview tab
    'Total open RFIs': { path: this.RFI_ROUTE },                      // full list, no filter
    'Pending RFIs':    { path: this.RFI_ROUTE, status: 'pending' },
    'My open RFIs':    { path: this.RFI_ROUTE, status: 'pending' },
    // RFIs tab
    'Total RFIs':      { path: this.RFI_ROUTE },                       // full list, no filter
    'Pending':         { path: this.RFI_ROUTE, status: 'pending' },
    'Overdue':         { path: this.RFI_ROUTE, status: 'overdue' },
    'Under Review':    { path: this.RFI_ROUTE, status: 'under-review' },
    'Reopened':        { path: this.RFI_ROUTE, status: 'reopened' },
    // 'SLA Compliance' intentionally omitted — metric only, not a filterable list
  };

  /** Drives the custom .tab-bar/.tab-btn navigation (see .tab-content in the
   * template) — replaces PrimeNG's <p-tabs>, which fought CSS overrides for
   * its tablist/tabpanel background no matter how the styles were applied. */
  activeTab: '0' | '1' | '2' | '3' = '0';

  private readonly downloader = inject(FileDownloadService);
  private readonly drawer = inject(RightDrawerService);

  

  constructor(private cdr: ChangeDetectorRef, private router: Router, private layoutService: LayoutService) {
    /** Re-builds the Chart.js configs whenever dark mode toggles — they read
     *  CSS theme variables via getComputedStyle, which Chart.js can't
     *  consume directly, so they must be rebuilt (not just re-styled) on
     *  every theme change instead of being computed once at load time. */
    effect(() => {
      this.layoutService.layoutConfig().darkTheme;
      this.initSharedChartOptions();
      this.cdr.markForCheck();
    });
  }

  /** True when a KPI card has a configured navigation target. */
  isKpiClickable(kpi: KpiCard): boolean {
    return !!this.kpiNav[kpi.label];
  }

  /**
   * Query params that tell rfi-management-client.ts which role/sub-division to open as.
   * Explicit for BOTH roles (not just CFO) — leaving it to that page's own defaults for Sub-Division
   * Head was the bug: its default sub-division ('Human Resources') doesn't match this
   * dashboard's Sub-Division Head persona (SUB_DIVISION_HEAD_SUB_DIVISION, 'Finance & Accounts'), so a Sub-Division
   * Head click would land on the wrong sub-division's RFIs (or, before `role` was added at
   * all, silently on whatever that page's default role happened to be).
   */
  private rfiRoleQueryParams(): Record<string, string> {
    return this.isCfo
      ? { role: 'cfo' }
      : { role: 'subDivision', 'sub-division': this.SUB_DIVISION_HEAD_SUB_DIVISION };
  }

  /**
   * Query params that tell audit-scope-summary.component.ts which role/sub-division to open
   * as. Explicit for BOTH roles — that page's `role`/`userSubDivision` are `@Input()`s that
   * only get a value when a parent template binds them directly; reached via
   * `router.navigate()` (as every click here does) they're never set, so the page always
   * fell back to its 'cfo' default regardless of who clicked. This is the fix for that
   * "Sub-Division Head clicks land in admin/CFO mode" bug. Mirrors that destination page's own
   * `role`/`sub-division` query keys (sub-division terminology, matching rfi-management-
   * client.ts's `role`/`sub-division` keys).
   */
  private scopeRoleQueryParams(): Record<string, string> {
    return this.isCfo
      ? { role: 'cfo' }
      : { role: 'sub-division-head', 'sub-division': this.SUB_DIVISION_HEAD_SCOPE_SUB_DIVISION };
  }

  /**
   * Navigate to the target component for a clicked KPI card. Every RFI KPI on this
   * dashboard is scoped to the current role (CFO = every company pooled; Sub-Division Head =
   * SUB_DIVISION_HEAD_SUB_DIVISION only — see loadRfiData()), so the destination page needs to open
   * in the matching view via rfiRoleQueryParams() above rather than whatever it defaults to.
   */
  onKpiClick(kpi: KpiCard): void {
    const nav = this.kpiNav[kpi.label];
    if (!nav) return;
    const queryParams: Record<string, string> = { ...this.rfiRoleQueryParams() };
    if (nav.status) queryParams['status'] = nav.status;
    this.router.navigate(nav.path, { queryParams });
  }

  /**
   * Navigate to the audit scope summary, optionally filtered by status (see
   * scopeRoleQueryParams() above for the role/sub-division part). Called with no `status`
   * argument for the cards that don't correspond to a single status filter on that page
   * ("Total items", "Avg. completion") — those open the full, unfiltered list for the role.
   */
  goToScopeSummary(status?: string): void {
    const queryParams: Record<string, string> = { ...this.scopeRoleQueryParams() };
    if (status) queryParams['status'] = status;
    this.router.navigate(this.SCOPE_ROUTE, { queryParams });
  }

  /**
   * "View all" on the RFIs tab's table — same destination and role/sub-division scoping as the
   * "Total open RFIs"/"Total RFIs" KPI cards (full list, no status filter).
   */
  viewAllRfis(): void {
    this.router.navigate(this.RFI_ROUTE, { queryParams: this.rfiRoleQueryParams() });
  }

  /**
   * Header "Refresh" action — re-pulls RFI counts live from rfi-static-data.ts via
   * loadDataForRole()/loadRfiData(), so any RFI an auditor has added or updated since this
   * page loaded (e.g. through the Add RFI drawer) shows up in the KPI cards and charts.
   * This app has no push/observable data layer, so counts otherwise only refresh on
   * ngOnInit/ngOnChanges — this button is the manual "pull fresh data now" action, the same
   * role rfi-management-client.ts's own refreshRfis() plays after its edit drawer closes.
   */
  onRefresh(): void {
    this.loadDataForRole();
    this.cdr.markForCheck();
  }

  /**
   * "Viewing as" toggle in the header — lets this dashboard flip between the CFO and
   * Sub-Division Head views in-page, the same way audit-scope-summary.component.ts's own role
   * switcher works. `role` is technically an `@Input()` (so a host page can still fix it), but
   * mutating it here and re-running loadDataForRole() is exactly what ngOnChanges() already does
   * when a host changes that input — this just gives the same effect a first-class in-page action.
   */
  setRole(role: UserRole): void {
    if (this.role === role) return;
    this.role = role;
    this.loadDataForRole();
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.initSharedChartOptions();
    this.loadDataForRole();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['role'] && !changes['role'].firstChange) {
      this.loadDataForRole();
      this.cdr.markForCheck();
    }
  }

  private loadDataForRole(): void {
    this.isCfo = this.role === 'CFO';
    this.isCfo ? this.loadCfoData() : this.loadSubDivisionHeadData();
    this.resetUpcomingCalendar();
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  /**
   * True RFI status breakdown for the current role, computed LIVE each time loadRfiData()
   * runs (on init, on role change, and on Refresh) by calling rfi-static-data.ts's real
   * `getAllEnrichedRfis()` directly — NOT from `rfis` below, which is only a small "most
   * urgent, one per status" preview of that same pool for this tab's table (the "View all"
   * button links to the full RFI Management page). Because it's recomputed from the live
   * store rather than snapshotted, an RFI an auditor adds elsewhere in the app is reflected
   * here the next time this runs. CFO = every RFI across all 8 client companies, matching
   * rfi-management-client.ts's own (company-unscoped) CFO view. Sub-Division Head = the
   * SUB_DIVISION_HEAD_SUB_DIVISION sub-division, pooled across every company that has one — same
   * sub-division-head filter behaviour as that page.
   */
  rfiBreakdown = { pending: 0, overdue: 0, underReview: 0, reopened: 0, completed: 0 };

  /** Total open (non-completed) RFIs for the current role — pending + overdue + under-review + reopened. */
  get rfiOpenTotal(): number {
    const b = this.rfiBreakdown;
    return b.pending + b.overdue + b.underReview + b.reopened;
  }

  get overdueRfiCount(): number {
    return this.rfiBreakdown.overdue;
  }

  /** Count of reports still in 'draft' status, derived from `reports` so it can't drift out of sync. */
  get draftReportCount(): number {
    return this.reports.filter((r) => r.status === 'draft').length;
  }

  get scopeStats() {
    const total = this.scopes.length;
    const completed = this.scopes.filter(s => s.status === 'Completed').length;
    const onTrack  = this.scopes.filter(s => ['On track', 'In progress'].includes(s.status)).length;
    // 'Overdue' counts as at-risk (self-evidently); 'Planned' is grouped with 'Not started' here
    // too, mirroring audit-scope-summary.component.ts's own notStartedCount roll-up.
    const atRisk   = this.scopes.filter(s => ['At risk', 'Delayed', 'Not started', 'Pending', 'Overdue', 'Planned'].includes(s.status)).length;
    const avgProgress = total
      ? Math.round(this.scopes.reduce((acc, s) => acc + s.progress, 0) / total)
      : 0;
    return { total, completed, onTrack, atRisk, avgProgress };
  }

  isTruncated(description: string): boolean {
    return description.length > this.DESCRIPTION_TRUNCATE_LENGTH;
  }

  truncate(description: string): string {
    return this.isTruncated(description)
      ? description.slice(0, this.DESCRIPTION_TRUNCATE_LENGTH).trimEnd() + '…'
      : description;
  }

  openNotif(notif: AuditNotification): void {
    notif.read = true;
    this.selectedNotif = notif;
    this.notifDialogVisible = true;
    this.cdr.markForCheck();
  }

  closeNotifDialog(): void {
    this.notifDialogVisible = false;
    this.selectedNotif = null;
  }

  downloadReport(report: ReportItem): void {
    this.downloader.download(SAMPLE_REPORT_FILE_URL, `${report.name}.docx`);
  }

  openRfi(rfi: RfiItem): void {
    console.log('Opening RFI:', rfi.id);
  }

  // ── Shared chart options ──────────────────────────────────────────────────

  private initSharedChartOptions(): void {
    const ds = getComputedStyle(document.documentElement);
    const surfaceCard = ds.getPropertyValue('--surface-card').trim() || '#ffffff';
    const surfaceBorder = ds.getPropertyValue('--surface-border').trim() || '#e2e8f0';
    const text = ds.getPropertyValue('--text-color').trim() || '#0f172a';

    const tooltipDefaults = {
      backgroundColor: surfaceCard,
      titleColor: text,
      bodyColor: text,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      padding: 10,
    };

    this.auditsBySubDivisionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipDefaults },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: surfaceBorder } },
      },
      datasets: {
        bar: {
          barPercentage: 0.35,
          categoryPercentage: 0.412,
        },
      },
    };

    this.rfisBySubDivisionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltipDefaults,
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: surfaceBorder } },
      },
      datasets: {
        bar: {
          barPercentage: 0.35,
          categoryPercentage: 0.412,
        },
      },
    };
  }

  // ── Live RFI data (dynamic — reads rfi-static-data.ts directly) ────────────

  /** Counts a pool of enriched RFIs into the dashboard's 5-status breakdown shape. */
  private computeRfiBreakdown(pool: EnrichedStaticRfi[]) {
    return {
      pending: pool.filter((r) => r.status === 'pending').length,
      overdue: pool.filter((r) => r.status === 'overdue').length,
      underReview: pool.filter((r) => r.status === 'under-review').length,
      reopened: pool.filter((r) => r.status === 'reopened').length,
      completed: pool.filter((r) => r.status === 'completed').length,
    };
  }

  /** Maps one live rfi-static-data.ts record onto this dashboard's RfiItem shape. */
  private toRfiItem(r: EnrichedStaticRfi): RfiItem {
    return {
      id: `RFI-${r.id}`,
      title: r.title,
      subDivision: r.subDivisionLabel || r.subDivisionLabel,
      dueDate: r.dueDate,
      assignee: r.ownerLabel,
      status: this.STATUS_LABEL_MAP[r.status],
    };
  }

  /**
   * A small "most urgent, one per open status" preview of the live pool for this tab's
   * table — the earliest-due record in each of Overdue/Pending/Under Review/Reopened.
   * Skips a status entirely if the pool currently has none in it, rather than assuming
   * exactly 4 rows the way the old hardcoded preview did.
   */
  private buildRfiPreview(pool: EnrichedStaticRfi[]): RfiItem[] {
    const openStatuses: EnrichedStaticRfi['status'][] = ['overdue', 'pending', 'under-review', 'reopened'];
    const preview: RfiItem[] = [];
    for (const status of openStatuses) {
      const earliest = pool
        .filter((r) => r.status === status)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
      if (earliest) preview.push(this.toRfiItem(earliest));
    }
    return preview;
  }

  /** Where an RFI sits — `subDivisionLabel` is '' for a division-level RFI. */
  private rfiUnit(r: EnrichedStaticRfi): DashboardUnit {
    return { division: r.divisionName, subDivision: r.subDivisionLabel || null };
  }

  /** Total(open)/Open(non-overdue)/Overdue bars, one group per unit. */
  /**
   * CFO-only "RFIs by Division / Sub-Division" chart, computed live from the full (unscoped) RFI
   * pool and split by the card's toggle (`rfisByView`): division-level RFIs or sub-division RFIs
   * only. Units are derived from whatever currently exists in the live data, so a new unit
   * showing up in the store is picked up too. Only the first PREVIEW_COUNT units are charted —
   * "View all" (openRfisDetail) lists every one.
   */
  private buildRfisByUnitChart(): void {
    const units = distinctUnits(this.allRfisForChart.map((r) => this.rfiUnit(r)))
      .filter((u) => (u.subDivision === null) === (this.rfisByView === 'division'));
    this.rfiUnitRows = units.map((unit) => {
      const inUnit = this.allRfisForChart.filter((r) => {
        const ru = this.rfiUnit(r);
        return ru.division === unit.division && ru.subDivision === unit.subDivision;
      });
      const total = inUnit.filter((r) => r.status !== 'completed').length;
      const overdue = inUnit.filter((r) => r.status === 'overdue').length;
      return { unit, total, open: total - overdue, overdue };
    });

    const preview = this.rfiUnitRows.slice(0, this.PREVIEW_COUNT);
    this.rfisBySubDivisionChartData = {
      labels: preview.map((r) => unitLabel(r.unit)),
      datasets: [
        { label: 'Total RFIs', data: preview.map((r) => r.total),   backgroundColor: this.SUB_DIVISION_BAR_COLORS.total,   borderRadius: 3 },
        { label: 'Open',       data: preview.map((r) => r.open),    backgroundColor: this.SUB_DIVISION_BAR_COLORS.open,    borderRadius: 3 },
        { label: 'Overdue',    data: preview.map((r) => r.overdue), backgroundColor: this.SUB_DIVISION_BAR_COLORS.overdue, borderRadius: 3 },
      ],
    };
    this.refreshRfisBySubDivisionLegend();
  }

  /** Legend totals always follow whatever `rfisBySubDivisionChartData` currently plots. */
  private refreshRfisBySubDivisionLegend(): void {
    this.rfisBySubDivisionLegend = this.rfisBySubDivisionChartData.datasets.map((ds: any) => ({
      label: ds.label,
      value: ds.data.reduce((sum: number, n: number) => sum + n, 0),
      color: ds.backgroundColor,
    }));
    this.rfisBySubDivisionHidden = this.rfisBySubDivisionLegend.map(() => false);
  }

  /**
   * Loads all RFI-derived dashboard state (rfiBreakdown, the `rfis` preview, and both RFI
   * charts) live from rfi-static-data.ts's getAllEnrichedRfis(). `subDivision === null` means
   * CFO/unscoped (every company, every unit); otherwise scoped to that one
   * subDivisionValue, pooled across every company that has it — matching
   * rfi-management-client.ts's own roleRFIs scoping exactly.
   */
  private loadRfiData(subDivision: string | null): void {
    const allRfis = getAllEnrichedRfis();
    const pool = subDivision === null ? allRfis : allRfis.filter((r) => r.subDivisionValue === subDivision);

    this.rfiBreakdown = this.computeRfiBreakdown(pool);
    this.rfis = this.buildRfiPreview(pool);

    const rfiStatuses: RfiStatus[] = ['Pending', 'Overdue', 'Under Review', 'Reopened', 'Completed'];
    this.rfiStatusChartData = {
      labels: rfiStatuses,
      datasets: [{
        data: [this.rfiBreakdown.pending, this.rfiBreakdown.overdue, this.rfiBreakdown.underReview, this.rfiBreakdown.reopened, this.rfiBreakdown.completed],
        backgroundColor: rfiStatuses.map((s) => this.RFI_STATUS_COLOR_MAP[s]),
        hoverOffset: 4,
      }],
    };

   this.rfiStatusLegend = this.buildLegend(
  rfiStatuses,
  [this.rfiBreakdown.pending, this.rfiBreakdown.overdue, this.rfiBreakdown.underReview, this.rfiBreakdown.reopened, this.rfiBreakdown.completed],
  rfiStatuses.map((s) => this.RFI_STATUS_COLOR_MAP[s]),
);

    this.allRfisForChart = allRfis;
    if (subDivision === null) {
      this.buildRfisByUnitChart();
    } else {
      // Sub-Division Head: one bar for its own sub-division. Not currently rendered (the card is
      // CFO-only — see the `@if (isCfo)` gate in the template) but kept correct for later.
      this.rfisBySubDivisionChartData = {
        labels: [subDivision],
        datasets: [
          { label: 'Total RFIs', data: [pool.filter((r) => r.status !== 'completed').length], backgroundColor: this.SUB_DIVISION_BAR_COLORS.total, borderRadius: 3 },
          { label: 'Open', data: [pool.filter((r) => r.status !== 'completed' && r.status !== 'overdue').length], backgroundColor: this.SUB_DIVISION_BAR_COLORS.open, borderRadius: 3 },
          { label: 'Overdue', data: [pool.filter((r) => r.status === 'overdue').length], backgroundColor: this.SUB_DIVISION_BAR_COLORS.overdue, borderRadius: 3 },
        ],
      };
      this.refreshRfisBySubDivisionLegend();
    }
  }

  // ── Live scope data (dynamic — reads audit-scope-summary.component.ts directly) ─────────

  /** Maps one live audit-scope-summary.component.ts record onto this dashboard's ScopeItem shape. */
  private toScopeItem(s: ClientScope): ScopeItem {
    // Source data bug: a scope can be 'completed' with progressPercent still 0 (see s-008 in
    // that file) — that page never renders a progress bar so it never shows, but this one
    // does, so it's normalized to 100% here rather than pairing a "Completed" tag with an
    // empty bar. See the original hardcoded version of this dashboard for the same call.
    const progress = s.status === 'completed' ? 100 : (s.progressPercent ?? 0);
    return {
      name: s.scopeName,
      progress,
      status: this.SCOPE_STATUS_LABEL_MAP[s.status],
      subDivision: s.linkedSubDivisions.map((d) => this.SCOPE_SUB_DIVISION_LABEL_MAP[d] ?? d).join(' / '),
      division: s.divisionName ?? s.division,
      divisionLevel: s.subDivisionName === null,
      ownSubDivision: s.subDivisionName ?? undefined,
    };
  }

  /**
   * Loads `this.scopes` live from audit-scope-summary.component.ts's getAllClientScopes().
   * Only top-level scopes are included (`scopeLevel === 'scope'`) — sub-scopes are excluded
   * here exactly as that page's own `applyFilters()` excludes them from its top-level list.
   * `subDivisionKey === null` means CFO/unscoped (every top-level scope); otherwise scoped to
   * whichever of that record's `linkedSubDivisions` names matches (e.g. 'Finance & Accounts') —
   * the same restriction that page's own sub-division-head view applies.
   */
  private loadScopeData(subDivisionKey: string | null): void {
    const topLevel = getAllClientScopes().filter((s) => s.scopeLevel === 'scope');
    const pool = subDivisionKey === null ? topLevel : topLevel.filter((s) => s.linkedSubDivisions.includes(subDivisionKey));
    this.scopes = pool.map((s) => this.toScopeItem(s));
  }

  // ── CFO data ──────────────────────────────────────────────────────────────

  private loadCfoData(): void {
    this.upcomingAudits = [
      { name: 'IT Security Assessment',   subDivision: 'IT',          assignee: 'Sarah Johnson', date: new Date('2026-01-15'), status: 'In Progress' },
      { name: 'HR Compliance Audit',      subDivision: 'HR',          assignee: 'Michael Brown', date: new Date('2026-01-20'), status: 'In Progress' },
      { name: 'Procurement Process Review', subDivision: 'Procurement', assignee: 'Emily Davis', date: new Date('2026-02-10'), status: 'Planned' },
      { name: 'Customer Data Privacy',    subDivision: 'IT',          assignee: 'Sarah Johnson', date: new Date('2026-02-20'), status: 'Planned' },
      { name: 'Vendor Management Audit',  subDivision: 'Procurement', assignee: 'Emily Davis',  date: new Date('2026-01-25'), status: 'In Progress' },
    ];

    // Scope data (this.scopes, feeding scopeStats below) is loaded live from
    // audit-scope-summary.component.ts via loadScopeData() — see that method for details.
    // `null` = CFO/unscoped, i.e. every top-level scope (matching that page's own CFO view).
    this.loadScopeData(null);

    // RFI-derived state (rfiBreakdown, the `rfis` preview, and both RFI charts below) is
    // loaded live from rfi-static-data.ts via loadRfiData() — see that method for details.
    // `null` = CFO/unscoped, i.e. every RFI across all 8 client companies (matching
    // rfi-management-client.ts's own company-unscoped CFO view).
    this.loadRfiData(null);

    this.notifications = [
      {
        title: 'RFI #108 overdue — Operations',
        description: 'RFI #108 requesting the fixed asset register for FY2025 was due on 18 Jun 2026 and has not been responded to. The Operations sub-division head has been notified. Immediate action is required to avoid further delays to the audit fieldwork schedule.',
        date: new Date('2026-06-23T09:02:00'),
        severity: 'danger',
        read: false,
      },
      {
        title: 'Draft report ready for review',
        description: 'The Finance Audit draft report has been uploaded and is available for your review.',
        date: new Date('2026-06-22T15:45:00'),
        severity: 'info',
        read: false,
      },
      {
        title: 'IT Security fieldwork starts Monday',
        description: 'The IT Security Assessment fieldwork is scheduled to begin on Monday 29 Jun 2026. The audit team will require access to the server room and network monitoring tools. Please ensure the IT sub-division head is available for the opening meeting at 9:00 AM. A detailed agenda has been shared separately.',
        date: new Date('2026-06-22T11:00:00'),
        severity: 'warn',
        read: false,
      },
      {
        title: 'HR scope document uploaded',
        description: 'The HR Compliance scope document has been uploaded by Michael Brown.',
        date: new Date('2026-06-20T10:00:00'),
        severity: 'secondary',
        read: true,
      },
    ];

    this.reports = [
      { name: 'Finance Audit — Draft Report',      uploadedDate: new Date('2026-06-21'), fileSize: '2.4 MB', status: 'draft' },
      { name: 'Procurement Final Report',           uploadedDate: new Date('2026-06-10'), fileSize: '1.8 MB', status: 'final' },
      { name: 'IT Security — Management Letter',   uploadedDate: new Date('2026-05-30'), fileSize: '890 KB', status: 'final' },
    ];

    // ── KPIs — derived from scopeStats/rfiBreakdown above so they can never drift out of sync ──
    this.kpis = [
      { label: 'Total open RFIs',    value: this.rfiOpenTotal, sub: `${this.overdueRfiCount} overdue`, subColor: 'danger',  icon: 'pi pi-file-edit' },
      // "Avg. 4 days" is illustrative — there's no per-RFI turnaround-time field to compute it from.
      { label: 'Pending RFIs',       value: this.rfiBreakdown.pending, sub: 'Avg. 4 days', subColor: 'warning', icon: 'pi pi-clock' },
      { label: 'Scopes in progress', value: `${this.scopeStats.onTrack}/${this.scopeStats.total}`, sub: `${this.scopeStats.avgProgress}% complete`, subColor: 'muted', icon: 'pi pi-list-check' },
      { label: 'Reports available',  value: this.reports.length, sub: `${this.draftReportCount} draft${this.draftReportCount === 1 ? '' : 's'}`, subColor: 'muted', icon: 'pi pi-file-pdf' },
    ];

    // Mirrors rfi-management-client.ts's own 6 stat cards (Total/Pending/Overdue/Under
    // Review/Completed/Reopened) so the two pages always tell the same story.
    this.rfiKpis = [
      { label: 'Total RFIs',    value: this.rfiOpenTotal,              sub: 'Excl. completed',     subColor: 'muted',   icon: 'pi pi-folder-open' },
      { label: 'Pending',       value: this.rfiBreakdown.pending,      sub: 'Awaiting response',   subColor: 'warning', icon: 'pi pi-clock' },
      { label: 'Overdue',       value: this.rfiBreakdown.overdue,      sub: 'Action required',     subColor: 'danger',  icon: 'pi pi-exclamation-circle' },
      { label: 'Under Review',  value: this.rfiBreakdown.underReview,  sub: 'With the auditor',    subColor: 'muted',   icon: 'pi pi-eye' },
      { label: 'Completed',     value: this.rfiBreakdown.completed,    sub: 'Accepted',            subColor: 'success', icon: 'pi pi-check-circle' },
      { label: 'Reopened',      value: this.rfiBreakdown.reopened,     sub: 'Needs resubmission',  subColor: 'warning', icon: 'pi pi-refresh' },
    ];

    // ── Audit charts ──
    this.auditStatusLegend = this.buildAuditStatusLegend();

    this.auditsBySubDivisionChartData = this.buildAuditsBySubDivisionChartData();
    // rfiStatusChartData / rfisBySubDivisionChartData are set inside loadRfiData(null) above.
  }

  /**
   * "Audit status distribution" donut legend for the CFO/admin Overview tab. For
   * CLIENT_MODE_VALUE === 'internal-audit', counts come from `this.scopes` (loaded live in
   * loadScopeData(), the same 12 real scopes scopeStats.total counts) grouped by
   * ScopeItem.status — not a hardcoded [3, 2, 2, 1] placeholder that summed to 8 regardless of
   * how many real scopes existed. `Not started` has no bucket of its own in this 4-slice donut,
   * so it's folded into `Planned` (both mean "hasn't begun"), matching how scopeStats.atRisk
   * already groups the two together elsewhere on this page.
   *
   * For 'audit-firm' mode, the original hardcoded placeholder is kept exactly as before — no
   * equivalent audit-firm scope-status seed was provided to derive it from here.
   */
  private buildAuditStatusLegend(): DonutLegendItem[] {
    if (CLIENT_MODE_VALUE === 'internal-audit') {
      const counts = { 'In Progress': 0, Planned: 0, Completed: 0, Overdue: 0 };
      for (const scope of this.scopes) {
        switch (scope.status) {
          case 'In progress':   counts['In Progress'] += 1; break;
          case 'Not started':
          case 'Planned':       counts.Planned += 1; break;
          case 'Completed':     counts.Completed += 1; break;
          case 'Overdue':       counts.Overdue += 1; break;
        }
      }
      return this.buildLegend(
        ['In Progress', 'Planned', 'Completed', 'Overdue'],
        [counts['In Progress'], counts.Planned, counts.Completed, counts.Overdue],
        this.AUDIT_STATUS_COLORS,
      );
    }
    return this.buildLegend(
      ['In Progress', 'Planned', 'Completed', 'Overdue'],
      [3, 2, 2, 1],
      this.AUDIT_STATUS_COLORS,
    );
  }

  /**
   * "Audits by Division / Sub-Division" bar chart data for the CFO/admin Overview tab, in both
   * client modes. The bar height is the count of `this.scopes` (loaded live in loadScopeData(),
   * the same top-level scopes scopeStats.total counts) on each unit, split by the card's toggle
   * (`auditsByView`): division-level scopes (sitting directly under a division with no
   * sub-division) or sub-division scopes only — so each engagement shows up in exactly one
   * view. Sub-divisions are keyed by their division too, so same-named sub-divisions of
   * different divisions never merge. (This replaces the old audit-firm hardcoded placeholder
   * and the internal-audit per-sub-division-name tally, which ignored division-level scopes.)
   */
  private buildAuditsBySubDivisionChartData() {
    const unitOf = (s: ScopeItem): DashboardUnit => ({
      division: s.division ?? 'Unassigned',
      subDivision: s.divisionLevel ? null : (s.ownSubDivision ?? null),
    });
    const units = distinctUnits(this.scopes.map(unitOf))
      .filter((u) => (u.subDivision === null) === (this.auditsByView === 'division'));
    this.auditUnitRows = units.map((unit) => ({
      unit,
      engagements: this.scopes.filter((s) => {
        const su = unitOf(s);
        return su.division === unit.division && su.subDivision === unit.subDivision;
      }).length,
    }));
    // Only the first PREVIEW_COUNT units are charted — "View all" (openAuditsDetail) lists every one.
    const preview = this.auditUnitRows.slice(0, this.PREVIEW_COUNT);
    return {
      labels: preview.map((r) => unitLabel(r.unit)),
      datasets: [{
        label: 'Engagements',
        data: preview.map((r) => r.engagements),
        backgroundColor: '#4169E1',
        borderRadius: 4,
      }],
    };
  }

  // ── Sub-Division Head data ─────────────────────────────────────────────────

  private loadSubDivisionHeadData(): void {
    // Defaults the sub-division picker to HR Dept on first entry into this view — subsequent
    // calls (Refresh, tab switches) leave whatever the user already picked untouched.
    if (CLIENT_MODE_VALUE === 'internal-audit' && !this.selectedSubDivision) {
      this.selectedSubDivision = INDI_ORG_HR_SUB_DIVISION_NAME;
    }

    this.upcomingAudits = [
      { name: 'IT Security Assessment',    subDivision: 'IT', assignee: 'Sarah Johnson', date: new Date('2026-01-15'), status: 'In Progress' },
      { name: 'Network Security Audit',    subDivision: 'IT', assignee: 'Raj Mehta',     date: new Date('2026-02-01'), status: 'Planned' },
      { name: 'Vendor Management Audit',   subDivision: 'IT', assignee: 'Emily Davis',   date: new Date('2026-01-25'), status: 'In Progress' },
    ];

    // Scope data (this.scopes, feeding scopeStats below) is loaded live from
    // audit-scope-summary.component.ts via loadScopeData() — see that method for details.
    // Scoped to SUB_DIVISION_HEAD_SCOPE_SUB_DIVISION ('Finance & Accounts'), matching that page's own
    // sub-division-head view (top-level scopes with 'Finance & Accounts' in linkedSubDivisions).
    this.loadScopeData(this.SUB_DIVISION_HEAD_SUB_DIVISION);

    // RFI-derived state (rfiBreakdown, the `rfis` preview, and both RFI charts below) is
    // loaded live from rfi-static-data.ts via loadRfiData() — see that method for details.
    // Scoped to SUB_DIVISION_HEAD_SUB_DIVISION, pooled across every company that has it (matching
    // rfi-management-client.ts's own sub-division-head filter, which isn't company-scoped either).
    this.loadRfiData(this.SUB_DIVISION_HEAD_SUB_DIVISION);

    this.notifications = [
      {
        title: 'RFI #108 overdue — action needed',
        description: 'Your response to RFI #108 (Fixed asset register FY2025) was due on 18 Jun 2026. Please submit the required documents immediately to avoid blocking the audit timeline. Contact the audit team if you need an extension.',
        date: new Date('2026-06-23T09:02:00'),
        severity: 'danger',
        read: false,
      },
      {
        title: 'Message from Sarah Johnson',
        description: 'Sarah Johnson has sent you a message regarding the vendor security contracts scope.',
        date: new Date('2026-06-23T08:30:00'),
        severity: 'info',
        read: false,
      },
      {
        title: 'Fieldwork visit confirmed — Jun 30',
        description: 'The on-site fieldwork visit for the IT Security Assessment has been confirmed for 30 Jun 2026. The audit team will arrive at 9:00 AM. Please ensure all relevant personnel are available and system access is provisioned in advance.',
        date: new Date('2026-06-21T10:00:00'),
        severity: 'warn',
        read: false,
      },
      {
        title: 'RFI #115 marked as received',
        description: 'Your submission for RFI #115 (IT access control log) has been acknowledged by the audit team.',
        date: new Date('2026-06-20T14:00:00'),
        severity: 'secondary',
        read: true,
      },
    ];

    this.reports = [
      { name: 'IT Security — Interim Findings',      uploadedDate: new Date('2026-06-21'), fileSize: '1.2 MB', status: 'draft' },
      { name: 'Access Control Review Report',         uploadedDate: new Date('2026-06-10'), fileSize: '980 KB', status: 'final' },
      { name: 'Network Security — Management Letter', uploadedDate: new Date('2026-05-30'), fileSize: '640 KB', status: 'final' },
    ];

    // ── KPIs — derived from scopeStats/rfiBreakdown above so they can never drift out of sync ──
    this.kpis = [
      { label: 'My open RFIs',         value: this.rfiOpenTotal, sub: `${this.overdueRfiCount} overdue`, subColor: 'danger', icon: 'pi pi-file-edit' },
      // Replaces the old "Documents submitted 11/18" card, which was a hardcoded placeholder
      // with no real data behind it. This mirrors the CFO tab's own "Pending RFIs" card —
      // derived from rfiBreakdown (see loadRfiData()), already clickable via kpiNav's
      // existing 'Pending RFIs' entry, and sub-division-scoped like the rest of this persona's data.
      { label: 'Pending RFIs', value: this.rfiBreakdown.pending, sub: 'Awaiting response', subColor: 'warning', icon: 'pi pi-clock' },
      { label: 'My scope progress',    value: `${this.scopeStats.avgProgress}%`, sub: 'At risk', subColor: 'warning', icon: 'pi pi-list-check' },
      { label: 'Unread notifications', value: this.unreadCount, sub: 'From audit team', subColor: 'muted', icon: 'pi pi-bell' },
    ];

    // Mirrors rfi-management-client.ts's own 6 stat cards, scoped to this sub-division.
    this.rfiKpis = [
      { label: 'Total RFIs',    value: this.rfiOpenTotal,             sub: 'Excl. completed',    subColor: 'muted',   icon: 'pi pi-folder-open' },
      { label: 'Pending',       value: this.rfiBreakdown.pending,     sub: 'Awaiting response',  subColor: 'warning', icon: 'pi pi-clock' },
      { label: 'Overdue',       value: this.rfiBreakdown.overdue,     sub: 'Action required',    subColor: 'danger',  icon: 'pi pi-exclamation-circle' },
      { label: 'Under Review',  value: this.rfiBreakdown.underReview, sub: 'With the auditor',   subColor: 'muted',   icon: 'pi pi-eye' },
      { label: 'Completed',     value: this.rfiBreakdown.completed,   sub: 'Accepted',           subColor: 'success', icon: 'pi pi-check-circle' },
      { label: 'Reopened',      value: this.rfiBreakdown.reopened,    sub: 'Needs resubmission', subColor: 'warning', icon: 'pi pi-refresh' },
    ];

    // ── Audit status donut — same buildAuditStatusLegend() the CFO tab uses, which (in
    // internal-audit mode) counts from `this.scopes`, already scoped to this sub-division above
    // via loadScopeData(). Previously this set the unused `auditStatusChartData` field instead
    // of `auditStatusLegend` (the one the template actually renders), so the Sub-Division Head donut
    // silently showed stale/empty data instead of this sub-division's own breakdown.
    this.auditStatusLegend = this.buildAuditStatusLegend();
    // rfiStatusChartData / rfisBySubDivisionChartData are set inside loadRfiData(this.SUB_DIVISION_HEAD_SUB_DIVISION)
    // above. rfisBySubDivisionChartData isn't currently rendered for this role (the "RFIs by sub-division"
    // card is CFO-only — see the `@if (isCfo)` gate in the template) but is kept correct/live for
    // when a sub-division comparison view is added.
  }
}