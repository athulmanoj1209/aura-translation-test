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
import { Observation } from '@/app/features/audits/audit-execution/observation/observation-list/observation-list.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CurrentAuditor } from '@/app/features/admin/auditor-dashboard/models/current-auditor.model';
import { LayoutService } from '@/app/layout/service/layout.service';
import {
  countFindingsForAuditorByDisplayStatus,
  countHighRiskFindingsForAuditor,
  getFindingsForAuditor,
} from '@/app/features/audits/audit-execution/findings/findings-list/findings-list.component';
import {
  countEvidenceForAuditorByStatus,
  getEvidenceForAuditor,
} from '@/app/features/audits/audit-execution/evidence/evidence-list/evidence-list.component';
import {
  countObservationsForAuditorByDisplayStatus,
  countObservationsForAuditorByRiskBand,
  getObservationsForAuditor,
} from '@/app/features/audits/audit-execution/observation/observation-list/observation-list.component';

interface FindingRow {
  finding: string; audit: string; scope: string; risk: string; status: string; owner: string;
  detail: FindingProfileData;
}

interface EvidenceRow {
  evidence: string; scope: string; type: string; risk: string; status: string; dueDate: string;
  detail: Evidence;
}

interface ObservationRow {
  observation: string; audit: string; scope: string; riskRating: string; status: string; createdDate: string;
  detail: Observation;
}

interface FindingCard { label: string; value: string; icon: string; cardClass: string; view?: string; }
interface ObservationCard { label: string; value: string; icon: string; cardClass: string; status?: string; riskBand?: 'High' | 'Medium'; }
interface EvidenceCard { label: string; value: string; icon: string; cardClass: string; status?: string; }

@Component({
  selector: 'app-auditor-execution',
  imports: [NgClass, ChartModule, TableModule, TagModule, ButtonModule, TooltipModule, DonutStatusChartComponent, DrawIconComponent],
  templateUrl: './auditor-execution.component.html',
  styleUrl: './auditor-execution.component.scss',
})
export class AuditorExecutionComponent implements OnInit {

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

  findingsSummaryCards: FindingCard[] = [
    { label: 'Draft Findings',     value: String(countFindingsForAuditorByDisplayStatus(this.currentAuditor.id, 'Draft')), icon: 'pi pi-pencil',             cardClass: '', view: 'draft' },
    { label: 'Submitted',          value: String(countFindingsForAuditorByDisplayStatus(this.currentAuditor.id, 'Submitted')), icon: 'pi pi-send',               cardClass: 'stat--info', view: 'submitted' },
    { label: 'Under Review',       value: String(countFindingsForAuditorByDisplayStatus(this.currentAuditor.id, 'Under Review')), icon: 'pi pi-search',             cardClass: 'stat--warning', view: 'under-review' },
    { label: 'Approved',           value: String(countFindingsForAuditorByDisplayStatus(this.currentAuditor.id, 'Approved')), icon: 'pi pi-check-circle',       cardClass: 'stat--success', view: 'approved' },
    { label: 'Closed',             value: String(countFindingsForAuditorByDisplayStatus(this.currentAuditor.id, 'Closed')), icon: 'pi pi-times-circle',       cardClass: '', view: 'my-closed' },
    { label: 'High Risk Findings', value: String(countHighRiskFindingsForAuditor(this.currentAuditor.id)), icon: 'pi pi-exclamation-circle', cardClass: 'stat--danger', view: 'high-risk' },
  ];

  observationSummaryCards: ObservationCard[] = [
    { label: 'Total Observations', value: String(countObservationsForAuditorByDisplayStatus(this.currentAuditor.name, null)), icon: 'pi pi-eye',               cardClass: '' },
    { label: 'Open',               value: String(countObservationsForAuditorByDisplayStatus(this.currentAuditor.name, 'Open')), icon: 'pi pi-folder-open',        cardClass: 'stat--danger', status: 'Open' },
    { label: 'Under Review',       value: String(countObservationsForAuditorByDisplayStatus(this.currentAuditor.name, 'Under Review')), icon: 'pi pi-search',             cardClass: 'stat--warning', status: 'Under Review' },
    { label: 'Resolved',           value: String(countObservationsForAuditorByDisplayStatus(this.currentAuditor.name, 'Resolved')), icon: 'pi pi-check-circle',       cardClass: 'stat--success', status: 'Resolved' },
    { label: 'High Risk',          value: String(countObservationsForAuditorByRiskBand(this.currentAuditor.name, 'High')), icon: 'pi pi-exclamation-circle', cardClass: 'stat--danger', riskBand: 'High' },
    { label: 'Medium Risk',        value: String(countObservationsForAuditorByRiskBand(this.currentAuditor.name, 'Medium')), icon: 'pi pi-info-circle',        cardClass: 'stat--warning', riskBand: 'Medium' },
  ];

  evidenceSummaryCards: EvidenceCard[] = [
    { label: 'Total Evidences', value: String(countEvidenceForAuditorByStatus(this.currentAuditor.name, null)), icon: 'pi pi-paperclip',    cardClass: '' },
    { label: 'Requested',       value: String(countEvidenceForAuditorByStatus(this.currentAuditor.name, 'Requested')), icon: 'pi pi-send',          cardClass: 'stat--info', status: 'requested' },
    { label: 'Uploaded',        value: String(countEvidenceForAuditorByStatus(this.currentAuditor.name, 'Uploaded')), icon: 'pi pi-upload',        cardClass: 'stat--info', status: 'uploaded' },
    { label: 'Under Review',    value: String(countEvidenceForAuditorByStatus(this.currentAuditor.name, 'Under Review')), icon: 'pi pi-search',        cardClass: 'stat--warning', status: 'under_review' },
    { label: 'Accepted',        value: String(countEvidenceForAuditorByStatus(this.currentAuditor.name, 'Accepted')), icon: 'pi pi-check-circle',  cardClass: 'stat--success', status: 'accepted' },
    { label: 'Rejected',        value: String(countEvidenceForAuditorByStatus(this.currentAuditor.name, 'Rejected')), icon: 'pi pi-times-circle',  cardClass: 'stat--danger', status: 'rejected' },
  ];

  onFindingCardClick(card: FindingCard): void {
    this.router.navigate(['/audits/audit-execution/findings'], {
      queryParams: { auditorId: this.currentAuditor.id, ...(card.view ? { view: card.view } : {}) },
    });
  }

  onObservationCardClick(card: ObservationCard): void {
    this.router.navigate(['/audits/audit-execution/observation-list'], {
      queryParams: {
        auditorId: this.currentAuditor.name,
        ...(card.status ? { status: card.status } : {}),
        ...(card.riskBand ? { riskBand: card.riskBand } : {}),
      },
    });
  }

  onEvidenceCardClick(card: EvidenceCard): void {
    this.router.navigate(['/audits/audit-execution/evidence-list'], {
      queryParams: { auditorId: this.currentAuditor.name, ...(card.status ? { status: card.status } : {}) },
    });
  }

  findingsByRiskChartData: any;

  readonly findingsByRiskChartOptions = computed(() => {
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
      datasets: { bar: { barPercentage: 0.35, categoryPercentage: 0.412 } },
    };
  });

  findingsStatusChartData: any;
  findingsStatusChartOptions: any;
  evidencesByRiskChartData: any;

  readonly evidencesByRiskChartOptions = computed(() => {
    const c = this.themeColors();
    return {
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: c.surfaceBorder } },
      },
      datasets: { bar: { barPercentage: 0.35, categoryPercentage: 0.412 } },
    };
  });

  evidencesStatusChartData: any;
  evidencesStatusChartOptions: any;
  observationsByRiskChartData: any;

  readonly observationsByRiskChartOptions = computed(() => {
    const c = this.themeColors();
    return {
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: c.surfaceBorder } },
      },
      datasets: { bar: { barPercentage: 0.35, categoryPercentage: 0.412 } },
    };
  });

  observationsStatusChartData: any;
  observationsStatusChartOptions: any;

  findingsStatusLegend: DonutLegendItem[] = [];
  evidencesStatusLegend: DonutLegendItem[] = [];
  observationsStatusLegend: DonutLegendItem[] = [];

   /** Highlights the hovered category's full column, matching the Audits by Department chart. */
  private readonly findingsByRiskHoverBandPlugin = {
    id: 'findingsByRiskHoverBand',
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

  readonly findingsByRiskHoverBandPlugins = [this.findingsByRiskHoverBandPlugin];

  // Computed once (not as getters) — a getter bound directly to p-table's
  // [value] re-runs and returns a brand-new array of brand-new row objects
  // on every change-detection cycle, which makes the table tear down and
  // rebuild its rows constantly and can drop a real click on the "view"
  // button mid-render. See findings-list/evidence-list/observation-list
  // for the underlying data.
  myFindings: FindingRow[] = [];
  myEvidences: EvidenceRow[] = [];
  myObservations: ObservationRow[] = [];

  ngOnInit(): void {
    this.myFindings = getFindingsForAuditor(this.currentAuditor.id);
    this.myEvidences = getEvidenceForAuditor(this.currentAuditor.name);
    this.myObservations = getObservationsForAuditor(this.currentAuditor.name);
    this.initCharts();
  }

  openFindingsDrawer(row: FindingRow): void {
    this.drawer.open<FindingProfileComponent, FindingProfileData>(
      FindingProfileComponent,
      { width: '760px', data: row.detail },
    );
  }

  openEvidencesDrawer(row: EvidenceRow): void {
    this.drawer.open<EvidenceDetailComponent, EvidenceDetailDrawerData>(
      EvidenceDetailComponent,
      { width: '720px', data: { evidence: row.detail } },
    );
  }

  openObservationsDrawer(row: ObservationRow): void {
    this.drawer.open<ObservationDetailComponent, ObservationDetailDrawerData>(
      ObservationDetailComponent,
      { width: '720px', data: { observation: row.detail } },
    );
  }

  /**
   * Every chart below counts straight from the same row arrays (myFindings/
   * myEvidences/myObservations) used by the tables and, for the shared
   * buckets, the same helper calls used by the summary cards — so slices
   * always add up to what the cards and tables show.
   */
  private initCharts(): void {
    const findings = this.myFindings;
    const evidences = this.myEvidences;
    const observations = this.myObservations;

    const countBy = <T>(rows: T[], key: keyof T, value: string) => rows.filter(r => r[key] === value).length;

    this.findingsByRiskChartData = {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        label: 'Findings',
        data: [countBy(findings, 'risk', 'High'), countBy(findings, 'risk', 'Medium'), countBy(findings, 'risk', 'Low')],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderRadius: 6,
      }]
    };
    this.findingsStatusChartData = {
      labels: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Closed'],
      datasets: [{
        data: [
          countBy(findings, 'status', 'Draft'),
          countBy(findings, 'status', 'Submitted'),
          countBy(findings, 'status', 'Under Review'),
          countBy(findings, 'status', 'Approved'),
          countBy(findings, 'status', 'Closed'),
        ],
        backgroundColor: ['#94a3b8', '#3b82f6', '#f59e0b', '#22c55e', '#64748b'],
        hoverBackgroundColor: ['#64748b', '#2563eb', '#d97706', '#16a34a', '#475569'],
        borderWidth: 2, borderColor: '#ffffff',
      }]
    };
    this.findingsStatusChartOptions = {
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14, font: { size: 12 } } } },
      maintainAspectRatio: false, cutout: '60%',
    };
    this.findingsStatusLegend = [
      { label: 'Draft',        value: countBy(findings, 'status', 'Draft'),        color: '#94a3b8' },
      { label: 'Submitted',    value: countBy(findings, 'status', 'Submitted'),    color: '#3b82f6' },
      { label: 'Under Review', value: countBy(findings, 'status', 'Under Review'), color: '#f59e0b' },
      { label: 'Approved',     value: countBy(findings, 'status', 'Approved'),     color: '#22c55e' },
      { label: 'Closed',       value: countBy(findings, 'status', 'Closed'),       color: '#64748b' },
    ];

    this.evidencesByRiskChartData = {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        label: 'Evidences',
        data: [countBy(evidences, 'risk', 'High'), countBy(evidences, 'risk', 'Medium'), countBy(evidences, 'risk', 'Low')],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderRadius: 6,
      }]
    };
    this.evidencesStatusChartData = {
      labels: ['Requested', 'Uploaded', 'Under Review', 'Accepted', 'Rejected'],
      datasets: [{
        data: [
          countBy(evidences, 'status', 'Requested'),
          countBy(evidences, 'status', 'Uploaded'),
          countBy(evidences, 'status', 'Under Review'),
          countBy(evidences, 'status', 'Accepted'),
          countBy(evidences, 'status', 'Rejected'),
        ],
        backgroundColor: ['#3b82f6', '#94a3b8', '#f59e0b', '#22c55e', '#ef4444'],
        hoverBackgroundColor: ['#2563eb', '#64748b', '#d97706', '#16a34a', '#dc2626'],
        borderWidth: 2, borderColor: '#ffffff',
      }]
    };
    this.evidencesStatusChartOptions = {
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } },
      maintainAspectRatio: false, cutout: '60%',
    };
    this.evidencesStatusLegend = [
      { label: 'Requested',    value: countBy(evidences, 'status', 'Requested'),    color: '#3b82f6' },
      { label: 'Uploaded',     value: countBy(evidences, 'status', 'Uploaded'),     color: '#94a3b8' },
      { label: 'Under Review', value: countBy(evidences, 'status', 'Under Review'), color: '#f59e0b' },
      { label: 'Accepted',     value: countBy(evidences, 'status', 'Accepted'),     color: '#22c55e' },
      { label: 'Rejected',     value: countBy(evidences, 'status', 'Rejected'),     color: '#ef4444' },
    ];

    this.observationsByRiskChartData = {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        label: 'Observations',
        data: [
          observations.filter(o => o.riskRating === 'High' || o.riskRating === 'Critical').length,
          countBy(observations, 'riskRating', 'Medium'),
          countBy(observations, 'riskRating', 'Low'),
        ],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderRadius: 6,
      }]
    };
    this.observationsStatusChartData = {
      labels: ['Open', 'Under Review', 'Resolved'],
      datasets: [{
        data: [
          countBy(observations, 'status', 'Open'),
          countBy(observations, 'status', 'Under Review'),
          countBy(observations, 'status', 'Resolved'),
        ],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        hoverBackgroundColor: ['#dc2626', '#d97706', '#16a34a'],
        borderWidth: 2, borderColor: '#ffffff',
      }]
    };
    this.observationsStatusChartOptions = {
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } },
      maintainAspectRatio: false, cutout: '60%',
    };
    this.observationsStatusLegend = [
      { label: 'Open',         value: countBy(observations, 'status', 'Open'),         color: '#ef4444' },
      { label: 'Under Review', value: countBy(observations, 'status', 'Under Review'), color: '#f59e0b' },
      { label: 'Resolved',     value: countBy(observations, 'status', 'Resolved'),     color: '#22c55e' },
    ];

  }

  getFindingStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Draft': 'secondary', 'Submitted': 'info', 'Under Review': 'warn',
      'Approved': 'success', 'Rejected': 'danger', 'Sent to Client': 'info',
      'Management Response Received': 'success', 'Closed': 'secondary',
    };
    return map[status] ?? 'secondary';
  }

  getRiskSeverity(risk: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = { Critical: 'danger', High: 'danger', Medium: 'warn', Low: 'success' };
    return map[risk] ?? 'secondary';
  }

  getEvidenceStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Requested': 'info', 'Uploaded': 'info', 'Under Review': 'warn',
      'Rejected': 'danger', 'Accepted': 'success',
    };
    return map[status] ?? 'secondary';
  }

  getObservationRiskSeverity(risk: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = { Critical: 'danger', High: 'danger', Medium: 'warn', Low: 'success' };
    return map[risk] ?? 'secondary';
  }

  getObservationStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Open': 'danger', 'Under Review': 'warn', 'Resolved': 'success',
    };
    return map[status] ?? 'secondary';
  }

  getCommentStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Pending': 'warn', 'In Progress': 'info', 'Resolved': 'success', 'Closed': 'secondary',
    };
    return map[status] ?? 'secondary';
  }

  isHighRiskRow(risk: string): boolean {
    return risk === 'High' || risk === 'Critical';
  }
}
