import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DonutStatusChartComponent, DonutLegendItem } from '@/app/shared/components/donut-status-chart/donut-status-chart.component';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { FindingProfileComponent, FindingProfileData } from '@/app/features/audits/audit-execution/findings/finding-profile/finding-profile.component';
import { EvidenceDetailComponent, EvidenceDetailDrawerData } from '@/app/features/audits/audit-execution/evidence/evidence-detail/evidence-detail.component';
import { ObservationDetailComponent, ObservationDetailDrawerData } from '@/app/features/audits/audit-execution/observation/observation-detail/observation-detail.component';
import { Evidence } from '@/app/features/audits/audit-execution/evidence/evidence-list/evidence-list.component';
import { Observation, type ObservationStatus } from '@/app/features/audits/audit-execution/observation/observation-list/observation-list.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CurrentAuditor } from '@/app/features/admin/auditor-dashboard/models/current-auditor.model';
import { MOCK_FINDINGS, RichAuditFinding } from '@/app/features/audits/audit-execution/findings/audit-finding-data';
import { FindingStatus } from '@/app/features/audits/audit-execution/findings/services/audit-finding.service';
import { LayoutService } from '@/app/layout/service/layout.service';
import {
  PendingItem, type PendingStatus,
  getPendingItemsByType,
} from '@/app/features/admin/review/execution-requests/execution-requests.component';

interface ApprovalRow {
  item: string;
  type: 'Evidence' | 'Finding' | 'Observation';
  submittedOn: string;
  currentStage: string;
  status: string;
  evidenceDetail?: Evidence;
  findingDetail?: FindingProfileData;
  observationDetail?: Observation;
}

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  cardClass: string;
  reviewType?: 'finding' | 'observation' | 'evidence';
}

/**
 * Findings that are actually awaiting a reviewer/approver action — matches
 * the '/findings?view=pending' drill-through in findings-list.component.ts
 * exactly, so this tab's counts never disagree with the list they open.
 * Excludes still-drafting findings ('open'/'rejected') and already-finalised
 * ones ('verified'/'closed').
 */
const FINDING_PENDING_REVIEW_STATUSES: FindingStatus[] = ['in-progress'];
const FINDING_PENDING_APPROVAL_STATUSES: FindingStatus[] = ['responded', 'escalated', 'overdue'];
const FINDING_REVIEW_STATUSES: FindingStatus[] = [...FINDING_PENDING_REVIEW_STATUSES, ...FINDING_PENDING_APPROVAL_STATUSES];

/** Maps execution-approval-list's PendingStatus onto the closest Observation
 *  review status, so a card sourced from that queue can still be opened in
 *  the ObservationDetail drawer. ObservationStatus has no 'rejected' value,
 *  so a rejected pending item falls back to 'draft' — sent back for rework,
 *  the same treatment already given to the (oddly-named) 'submitted'
 *  PendingStatus above. */
const PENDING_TO_OBSERVATION_STATUS: Record<PendingStatus, ObservationStatus> = {
  pending_review: 'submitted',
  pending_approval: 'reviewed',
  submitted: 'draft',
  approved: 'approved',
  rejected: 'draft',
};

const PENDING_STATUS_LABEL: Record<PendingStatus, string> = {
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

@Component({
  selector: 'app-auditor-reviews',
  imports: [NgClass, ChartModule, TableModule, TagModule, ButtonModule, TooltipModule, DonutStatusChartComponent, DrawIconComponent],
  templateUrl: './auditor-reviews.component.html',
  styleUrl: './auditor-reviews.component.scss',
})
export class AuditorReviewsComponent implements OnInit {

  @Input() currentAuditor: CurrentAuditor = { id: 'bob', name: 'Bob Smith' };

  private readonly drawer = inject(RightDrawerService);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);

  /** Re-reads the app's CSS theme variables whenever dark mode toggles, so
   *  Chart.js configs below (which can't consume `var(--...)` directly)
   *  stay in sync instead of baking in light-mode-only hex at load time. */
  private readonly themeColors = computed(() => {
    this.layoutService.layoutConfig().darkTheme;
    const ds = getComputedStyle(document.documentElement);
    return {
      surfaceCard: ds.getPropertyValue('--surface-card').trim() || '#ffffff',
      surfaceBorder: ds.getPropertyValue('--surface-border').trim() || '#e2e8f0',
      text: ds.getPropertyValue('--text-color').trim() || '#0f172a',
      textSecondary: ds.getPropertyValue('--text-color-secondary').trim() || '#64748b',
    };
  });

  reviewsByTypeBarData: any;

  readonly reviewsByTypeBarOptions = computed(() => {
    const c = this.themeColors();
    return {
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
          intersect: false,
          displayColors: false,
          backgroundColor: c.surfaceCard,
          borderColor: c.surfaceBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          titleColor: c.text,
          titleFont: { size: 12, weight: 'bold' as const },
          bodyColor: c.text,
          bodyFont: { size: 13, weight: 'bold' as const },
          caretSize: 6,
        },
      },
      interaction: { mode: 'index' as const, intersect: false },
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: c.surfaceBorder } },
      },
      datasets: {
        bar: {
          barPercentage: 0.35,
          categoryPercentage: 0.412,
        },
      },
    };
  });

  reviewStatusBarData: any;

  readonly reviewStatusBarOptions = computed(() => {
    const c = this.themeColors();
    return {
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
          intersect: false,
          displayColors: false,
          backgroundColor: c.surfaceCard,
          borderColor: c.surfaceBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          titleColor: c.text,
          titleFont: { size: 12, weight: 'bold' as const },
          bodyColor: c.text,
          bodyFont: { size: 13, weight: 'bold' as const },
          caretSize: 6,
        },
      },
      interaction: { mode: 'index' as const, intersect: false },
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: c.surfaceBorder } },
      },
      datasets: {
        bar: {
          barPercentage: 0.35,
          categoryPercentage: 0.412,
        },
      },
    };
  });

  reviewStatusLegend: DonutLegendItem[] = [];
  reviewsByTypeLegend: DonutLegendItem[] = [];


  
  /** Highlights the hovered category's full column, matching the Audits by Department chart. */
  private readonly reviewsByTypeHoverBandPlugin = {
    id: 'reviewsByTypeHoverBand',
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

  readonly reviewsByTypeHoverBandPlugins = [this.reviewsByTypeHoverBandPlugin];

  /** Highlights the hovered category's full column, matching the Audits by Department chart. */
  private readonly reviewStatusHoverBandPlugin = {
    id: 'reviewStatusHoverBand',
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

  readonly reviewStatusHoverBandPlugins = [this.reviewStatusHoverBandPlugin];
  /**
   * Stat cards, charts and the workflow table are all built ONCE here (not
   * as template getters) so p-table gets a stable `[value]` array reference
   * — a getter re-evaluated on every change-detection tick fed p-table a
   * brand-new array every cycle, which reset its internal state on the fly
   * and made the row "view" button's click silently fail to open a drawer.
   */
  summaryCards: SummaryCard[] = [];
  approvalWorkflow: ApprovalRow[] = [];

  ngOnInit(): void {
    const reviewFindings = MOCK_FINDINGS.filter(f => FINDING_REVIEW_STATUSES.includes(f.status));
    const reviewObservations = getPendingItemsByType('observation');
    const reviewEvidence = getPendingItemsByType('evidence');

    const findingsCount = reviewFindings.length;
    const observationCount = reviewObservations.length;
    const evidenceCount = reviewEvidence.length;

    this.summaryCards = [
      { label: 'Total Pending Reviews', value: String(findingsCount + observationCount + evidenceCount), icon: 'pi pi-inbox', cardClass: '' },
      { label: 'Findings Reviews', value: String(findingsCount), icon: 'pi pi-exclamation-circle', cardClass: 'stat--danger', reviewType: 'finding' },
      { label: 'Observation Reviews', value: String(observationCount), icon: 'pi pi-eye', cardClass: 'stat--warning', reviewType: 'observation' },
      { label: 'Evidence Reviews', value: String(evidenceCount), icon: 'pi pi-paperclip', cardClass: 'stat--info', reviewType: 'evidence' },
    ];

    const findingRows: ApprovalRow[] = reviewFindings.map(f => {
      const bucket = FINDING_PENDING_REVIEW_STATUSES.includes(f.status) ? 'Pending Review' : 'Pending Approval';
      return {
        item: `Finding: ${f.title}`,
        type: 'Finding',
        submittedOn: f.createdAt ? this.formatDate(f.createdAt) : '—',
        currentStage: bucket,
        status: bucket,
        findingDetail: this.toFindingProfileData(f),
      };
    });

    const observationRows: ApprovalRow[] = reviewObservations.map(i => ({
      item: `Observation: ${i.title}`,
      type: 'Observation',
      submittedOn: this.formatDate(i.submittedDate),
      currentStage: PENDING_STATUS_LABEL[i.status],
      status: PENDING_STATUS_LABEL[i.status],
      observationDetail: this.toObservationDetail(i),
    }));

    const evidenceRows: ApprovalRow[] = reviewEvidence.map(i => ({
      item: `Evidence: ${i.title}`,
      type: 'Evidence',
      submittedOn: this.formatDate(i.submittedDate),
      currentStage: PENDING_STATUS_LABEL[i.status],
      status: PENDING_STATUS_LABEL[i.status],
      evidenceDetail: this.toEvidenceDetail(i),
    }));

    this.approvalWorkflow = [...findingRows, ...observationRows, ...evidenceRows];

    const typeLabels = ['Finding', 'Observation', 'Evidence'];
    const typeColors = ['#3b82f6', '#ef4444', '#f59e0b'];
    const typeData = [findingsCount, observationCount, evidenceCount];

    this.reviewsByTypeBarData = {
      labels: typeLabels,
      datasets: [{ label: 'Reviews', data: typeData, backgroundColor: typeColors, borderRadius: 6 }]
    };
    this.reviewsByTypeLegend = typeLabels.map((label, i) => ({ label, value: typeData[i], color: typeColors[i] }));

    const statusLabels = ['Pending Review', 'Pending Approval', 'Submitted'];
    const statusColors = ['#3b82f6', '#f59e0b', '#94a3b8'];
    const statusData = [
      reviewFindings.filter(f => FINDING_PENDING_REVIEW_STATUSES.includes(f.status)).length
      + reviewObservations.filter(i => i.status === 'pending_review').length
      + reviewEvidence.filter(i => i.status === 'pending_review').length,
      reviewFindings.filter(f => FINDING_PENDING_APPROVAL_STATUSES.includes(f.status)).length
      + reviewObservations.filter(i => i.status === 'pending_approval').length
      + reviewEvidence.filter(i => i.status === 'pending_approval').length,
      reviewObservations.filter(i => i.status === 'submitted').length
      + reviewEvidence.filter(i => i.status === 'submitted').length,
    ];

    this.reviewStatusBarData = {
      labels: statusLabels,
      datasets: [{ label: 'Reviews', data: statusData, backgroundColor: statusColors, borderRadius: 6 }]
    };
    this.reviewStatusLegend = statusLabels.map((label, i) => ({ label, value: statusData[i], color: statusColors[i] }));
  }

  onSummaryCardClick(card: SummaryCard): void {
    if (card.reviewType === 'finding') {
      this.router.navigate(['/audits/audit-execution/findings'], { queryParams: { view: 'pending' } });
    } else if (card.reviewType === 'observation' || card.reviewType === 'evidence') {
      this.router.navigate(['/admin/review/approval-list'], { queryParams: { type: card.reviewType } });
    } else {
      this.router.navigate(['/admin/review/approval-list']);
    }
  }

  private formatDate(d: Date): string {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  private toFindingProfileData(f: RichAuditFinding): FindingProfileData {
    return {
      id: f.id, title: f.title, severity: f.severity, status: f.status,
      subDivision: f.subDivision, scope: f.scope, subscope: f.subscope,
      taskId: f.taskId, company: f.company, division: f.division, risk: f.risk,
      dueDate: f.dueDate, createdAt: f.createdAt, owner: f.owner,
      description: f.description, observationIds: f.observationIds,
      documents: f.documents, financialImpact: f.financialImpact,
      isRepeated: f.isRepeated, flaggedForEscalation: f.flaggedForEscalation,
      daysOverdue: f.daysOverdue,
    };
  }

  /** Best-effort mapping — PendingItem doesn't carry every field the
   *  Observation model does (scope/subscope/task/finding linkage), so those
   *  fall back to placeholders until the pending-approvals queue tracks them. */
  private toObservationDetail(i: PendingItem): Observation {
    return {
      id: i.id, title: i.title, description: i.description, riskRating: i.riskRating,
      scope: '—', subscope: '—', taskId: i.linkedId ?? '—',
      findingTitle: i.linkedId ?? '—', evidenceIds: [],
      status: PENDING_TO_OBSERVATION_STATUS[i.status],
      auditor: i.submittedBy, createdDate: i.submittedDate,
      company: i.company, division: i.division, subDivision: i.subDivision,
    };
  }

  /** Same best-effort mapping as {@link toObservationDetail}, for the Evidence model. */
  private toEvidenceDetail(i: PendingItem): Evidence {
    return {
      id: i.id, title: i.title, evidenceType: 'document',
      scope: '—', subscope: '—', taskId: i.linkedId ?? '—',
      taskTitle: '—', findingId: i.linkedId ?? '', findingTitle: '—',
      createdDate: i.submittedDate, files: [],
      description: i.description, uploadedBy: i.submittedBy,
      company: i.company, branch: i.division, department: i.subDivision,
    };
  }

  openApprovalDrawer(row: ApprovalRow): void {
    if (row.type === 'Evidence' && row.evidenceDetail) {
      this.drawer.open<EvidenceDetailComponent, EvidenceDetailDrawerData>(
        EvidenceDetailComponent,
        { width: '720px', data: { evidence: row.evidenceDetail } },
      );
    } else if (row.type === 'Finding' && row.findingDetail) {
      this.drawer.open<FindingProfileComponent, FindingProfileData>(
        FindingProfileComponent,
        { width: '760px', data: row.findingDetail },
      );
    } else if (row.type === 'Observation' && row.observationDetail) {
      this.drawer.open<ObservationDetailComponent, ObservationDetailDrawerData>(
        ObservationDetailComponent,
        { width: '720px', data: { observation: row.observationDetail } },
      );
    }
  }

  getApprovalTypeSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Evidence': 'info',
      'Finding': 'danger',
      'Observation': 'warn',
    };
    return map[type] ?? 'secondary';
  }

  getReviewStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Pending Review': 'info',
      'Pending Approval': 'warn',
      'Submitted': 'secondary',
    };
    return map[status] ?? 'secondary';
  }
}