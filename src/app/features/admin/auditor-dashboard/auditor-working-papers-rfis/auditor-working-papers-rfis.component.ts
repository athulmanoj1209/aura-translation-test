import { Component, Input, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { CurrentAuditor } from '@/app/features/admin/auditor-dashboard/models/current-auditor.model';
import { getAllEnrichedRfis } from '@/app/features/audits/audit-execution/rfi-management/rfi-static-data';
import {
  countWorkingPapersForAuditorByStatus,
  getWorkingPapersForAuditor,
  AuditorWorkingPaperRow,
  WorkingPaperStatus,
} from '@/app/features/audits/audit-execution/working-papers/working-papers-list/working-papers-list.component';
import { WorkingPaperDetailComponent, WorkingPaperDetailDrawerData } from '@/app/features/audits/audit-execution/working-papers/working-paper-detail/working-paper-detail.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { DonutStatusChartComponent, DonutLegendItem } from '@/app/shared/components/donut-status-chart/donut-status-chart.component';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';

/** RFI statuses understood by the RFI management screen. */
type RfiStatus = 'pending' | 'overdue' | 'under-review' | 'completed' | 'reopened';

/** Display label for the "RFI List" table's status column. */
const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  pending: 'Pending Client',
  'under-review': 'Client Responded',
  overdue: 'Overdue',
  completed: 'Closed',
  reopened: 'Reopened',
};

/** An RFI dashboard KPI card that drills into the RFI management list. */
interface RfiKpiCard {
  label: string;
  value: string;
  icon: string;
  cardClass: string;
  /** Status to pre-filter the RFI list by. Omit for "all" (e.g. RFIs Sent). */
  status?: RfiStatus;
}

/** A working-paper summary card that drills into the working-paper list. */
interface WpSummaryCard {
  label: string;
  value: string;
  icon: string;
  cardClass: string;
  /** Status to pre-filter the working-paper list by. Omit for "all" (e.g. Total). */
  status?: WorkingPaperStatus;
}

/** An RFI, shaped for the "RFI List" table. */
interface RfiListRow {
  rfiNo: string; audit: string; scope: string; subDivision: string; dueDate: string; status: string;
}

@Component({
  selector: 'app-auditor-working-papers-rfis',
  imports: [NgClass, ChartModule, TableModule, TagModule, ButtonModule, TooltipModule, DrawIconComponent, DonutStatusChartComponent],
  templateUrl: './auditor-working-papers-rfis.component.html',
  styleUrl: './auditor-working-papers-rfis.component.scss',
})
export class AuditorWorkingPapersRfisComponent implements OnInit {

  @Input() currentAuditor: CurrentAuditor = { id: 'bob', name: 'Bob Smith' };

  private readonly router = inject(Router);
  private readonly drawer = inject(RightDrawerService);

  /** Target route for the RFI management screen. */
  private readonly RFI_ROUTE = '/audits/audit-execution/manage-rfi';

  /** Target route for the working-paper list screen. */
  private readonly WP_ROUTE = '/audits/audit-execution/working-papers';

  /**
   * `status` maps each card to the closest working-paper list filter value:
   *  • Total Working Papers → no status (all working papers for this auditor)
   *  • Draft                → draft
   *  • Submitted            → under_review (submitted for review)
   *  • Returned             → reopened
   *  • Approved             → approved
   */

  readonly rfiResponseLegend: DonutLegendItem[] = [
    { label: 'Responded', value: this.countRfis('under-review'), color: '#22c55e' },
    { label: 'Pending',   value: this.countRfis('pending'), color: '#94a3b8' },
    { label: 'Overdue',   value: this.countRfis('overdue'), color: '#ef4444' },
    { label: 'Reopened',  value: this.countRfis('reopened'), color: '#f59e0b' },
    { label: 'Closed',    value: this.countRfis('completed'), color: '#3b82f6' },
  ];

  get wpSummaryCards(): WpSummaryCard[] {
    const name = this.currentAuditor.name;
    return [
      { label: 'Total Working Papers', value: String(countWorkingPapersForAuditorByStatus(name, null)),           icon: 'pi pi-file',         cardClass: '' },
      { label: 'Draft',                value: String(countWorkingPapersForAuditorByStatus(name, 'draft')),        icon: 'pi pi-pencil',       cardClass: '',              status: 'draft' },
      { label: 'Submitted',            value: String(countWorkingPapersForAuditorByStatus(name, 'under_review')), icon: 'pi pi-send',         cardClass: 'stat--info',    status: 'under_review' },
      { label: 'Returned',             value: String(countWorkingPapersForAuditorByStatus(name, 'reopened')),      icon: 'pi pi-undo',         cardClass: 'stat--warning', status: 'reopened' },
      { label: 'Approved',             value: String(countWorkingPapersForAuditorByStatus(name, 'approved')),      icon: 'pi pi-check-circle', cardClass: 'stat--success', status: 'approved' },
    ];
  }

  /**
   * `status` maps each card to the closest RFI management filter value:
   *  • RFIs Sent        → no status (all RFIs for this auditor)
   *  • RFIs Responded   → under-review (client responded, awaiting auditor review)
   *  • Pending Responses→ pending
   *  • Overdue RFIs     → overdue
   *  • Reopened RFIs    → reopened
   *  • Closed RFIs      → completed
   */
  get rfiKpiCards(): RfiKpiCard[] {
    return [
      { label: 'RFIs Sent',         value: String(this.countRfis(null)),           icon: 'pi pi-send',                 cardClass: '' },
      { label: 'RFIs Responded',    value: String(this.countRfis('under-review')), icon: 'pi pi-reply',                cardClass: 'stat--success', status: 'under-review' },
      { label: 'Pending Responses', value: String(this.countRfis('pending')),      icon: 'pi pi-clock',                cardClass: 'stat--warning', status: 'pending' },
      { label: 'Overdue RFIs',      value: String(this.countRfis('overdue')),      icon: 'pi pi-exclamation-triangle', cardClass: 'stat--danger',  status: 'overdue' },
      { label: 'Reopened RFIs',     value: String(this.countRfis('reopened')),     icon: 'pi pi-refresh',              cardClass: 'stat--orange',  status: 'reopened' },
      { label: 'Closed RFIs',       value: String(this.countRfis('completed')),    icon: 'pi pi-times-circle',         cardClass: '',              status: 'completed' },
    ];
  }

  /** Every RFI assigned to this auditor, matching an exact status when given (null = all). */
  private countRfis(status: RfiStatus | null): number {
    const id = this.currentAuditor.id;
    return getAllEnrichedRfis().filter(r => r.auditorIds?.includes(id) && (status === null || r.status === status)).length;
  }

  rfiResponseChartData: any;
  rfiResponseChartOptions: any;

  // Computed once in ngOnInit (not as getters) — a getter bound directly to
  // p-table's [value] re-runs and returns a brand-new array of brand-new
  // row objects on every change-detection cycle, which makes the table
  // tear down and rebuild its rows constantly and can drop a real click on
  // the "view" button mid-render.
  workingPapers: AuditorWorkingPaperRow[] = [];
  rfiList: RfiListRow[] = [];

  ngOnInit(): void {
    this.workingPapers = getWorkingPapersForAuditor(this.currentAuditor.name);

    const id = this.currentAuditor.id;
    this.rfiList = getAllEnrichedRfis()
      .filter(r => r.auditorIds?.includes(id))
      .map(r => ({
        rfiNo: `RFI-${String(r.id).padStart(3, '0')}`,
        audit: r.subDivisionLabel,
        scope: r.subScopeLabel ?? r.scopeLabel ?? '—',
        subDivision: r.subDivisionLabel,
        dueDate: r.dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: RFI_STATUS_LABELS[r.status],
      }));
  }

  /**
   * Drill into the working-paper list, pre-filtered to the card's status
   * (if any) and scoped to the current auditor.
   */
  goToWorkingPapers(card: WpSummaryCard): void {
    this.router.navigate([this.WP_ROUTE], {
      queryParams: {
        ...(card.status ? { status: card.status } : {}),
        auditorId: this.currentAuditor.name,
      },
    });
  }

  openWorkingPaperDrawer(row: AuditorWorkingPaperRow): void {
    this.drawer.open<WorkingPaperDetailComponent, WorkingPaperDetailDrawerData>(
      WorkingPaperDetailComponent,
      { width: '720px', data: { workingPaper: row.detail } },
    );
  }

  goToRfis(card: RfiKpiCard): void {
    this.router.navigate([this.RFI_ROUTE], {
      queryParams: {
        ...(card.status ? { status: card.status } : {}),
        auditorId: this.currentAuditor.id,
      },
    });
  }
 

  getWpStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'In Progress': 'info', 'Submitted': 'info',
      'Returned': 'warn', 'Approved': 'success',
    };
    return map[status] ?? 'secondary';
  }

  getReviewerStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Approved': 'success', 'Under Review': 'info', 'Pending': 'warn',
      'Returned': 'danger', '-': 'secondary',
    };
    return map[status] ?? 'secondary';
  }

  getRfiStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'Sent': 'info', 'Client Responded': 'success',
      'Auditor Reviewed': 'success', 'Reopened': 'warn', 'Pending Client': 'info',
      'Overdue': 'danger', 'Closed': 'secondary',
    };
    return map[status] ?? 'secondary';
  }

  isAlertRfi(status: string): boolean {
    return status === 'Overdue';
  }
}
