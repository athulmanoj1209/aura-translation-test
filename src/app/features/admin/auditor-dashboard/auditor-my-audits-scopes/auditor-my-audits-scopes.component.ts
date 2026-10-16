import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DonutStatusChartComponent, DonutLegendItem } from '@/app/shared/components/donut-status-chart/donut-status-chart.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CurrentAuditor } from '@/app/features/admin/auditor-dashboard/models/current-auditor.model';
import { getAllPlansForAuditor } from '@/app/features/audits/audit-plan/audit-plan/audit-plan-list/audit-plan-list.component';
import {
  countScopesForAuditorByStatus,
  getScopeRowsForAuditor,
} from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-management-list/audit-scope-management-list.component';
import type { ScopeStatus } from '@/app/features/audits/audit-plan/audit-scope-management/models/audit-scope.model';
import { getTaskRowsForAuditor } from '@/app/features/audits/audit-plan/scope-job/scope-job-details/scope-job-details.component';
import { LayoutService } from '@/app/layout/service/layout.service';

interface ScopeSummaryCard {
  label: string;
  value: string;
  icon: string;
  cardClass: string;
  /** Exact ScopeStatus to filter by when clicked; omitted for the "Total Scopes" card. */
  status?: ScopeStatus;
}

@Component({
  selector: 'app-auditor-my-audits-scopes',
  imports: [NgClass, ChartModule, TableModule, TagModule, ButtonModule, TooltipModule, DonutStatusChartComponent, DrawIconComponent],
  templateUrl: './auditor-my-audits-scopes.component.html',
  styleUrl: './auditor-my-audits-scopes.component.scss',
})
export class AuditorMyAuditsScopesComponent implements OnInit {

  @Input() currentAuditor: CurrentAuditor = { id: 'bob', name: 'Bob Smith' };

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

  taskFilter = 'All';
  taskFilterOptions = ['All', 'Due Today', 'High Priority', 'Overdue', 'Completed'];

  readonly scopeStatusLegend: DonutLegendItem[] = [
    { label: 'Completed',   value: countScopesForAuditorByStatus(this.currentAuditor.id, 'Completed'), color: '#22c55e' },
    { label: 'In Progress', value: countScopesForAuditorByStatus(this.currentAuditor.id, 'In Progress'), color: '#3b82f6' },
    { label: 'Pending',     value: countScopesForAuditorByStatus(this.currentAuditor.id, 'Pending Review'), color: '#94a3b8' },
    { label: 'Overdue',     value: countScopesForAuditorByStatus(this.currentAuditor.id, 'Overdue'), color: '#ef4444' },
  ];

  scopeTrendChartData: any;

  readonly scopeTrendChartOptions = computed(() => {
    const c = this.themeColors();
    return {
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14, font: { size: 12 }, color: c.textSecondary } } },
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: c.surfaceBorder } },
      }
    };
  });

  get scopeSummaryCards(): ScopeSummaryCard[] {
    const id = this.currentAuditor.id;
    return [
      { label: 'Total Scopes',   value: String(countScopesForAuditorByStatus(id, null)),               icon: 'pi pi-list',                cardClass: '' },
      { label: 'Completed',      value: String(countScopesForAuditorByStatus(id, 'Completed')),         icon: 'pi pi-check-circle',        cardClass: 'stat--success', status: 'Completed' },
      { label: 'In Progress',    value: String(countScopesForAuditorByStatus(id, 'In Progress')),       icon: 'pi pi-spinner',             cardClass: '',              status: 'In Progress' },
      { label: 'Not Started',    value: String(countScopesForAuditorByStatus(id, 'Not Started')),       icon: 'pi pi-clock',               cardClass: '',              status: 'Not Started' },
      { label: 'Overdue Scopes', value: String(countScopesForAuditorByStatus(id, 'Overdue')),           icon: 'pi pi-exclamation-triangle', cardClass: 'stat--danger', status: 'Overdue' },
    ];
  }

  /** Clicking a summary card opens Scope Management pre-filtered to this auditor (and status, unless it's "Total Scopes"). */
  onScopeCardClick(card: ScopeSummaryCard): void {
    this.router.navigate(['/audits/audit-plan/audit-scope'], {
      queryParams: {
        auditorId: this.currentAuditor.id,
        ...(card.status ? { status: card.status } : {}),
      },
    });
  }

  /** Every plan (any status) assigned to this auditor. */
  get myAudits() {
    return getAllPlansForAuditor(this.currentAuditor.name);
  }

  get assignedScopes() {
    return getScopeRowsForAuditor(this.currentAuditor.id, 'scope');
  }

  get assignedSubScopes() {
    return getScopeRowsForAuditor(this.currentAuditor.id, 'subscope').map(r => ({
      subScope: r.scope,
      parentScope: r.parentScopeName ?? '—',
      status: r.status,
      dueDate: r.dueDate,
    }));
  }

  get allTasks() {
    return getTaskRowsForAuditor(this.currentAuditor.id);
  }

  get filteredTasks() {
    if (this.taskFilter === 'Due Today')      return this.allTasks.filter(t => t.dueDate === 'Today');
    if (this.taskFilter === 'High Priority')  return this.allTasks.filter(t => t.priority === 'High');
    if (this.taskFilter === 'Overdue')        return this.allTasks.filter(t => t.status === 'Overdue');
    if (this.taskFilter === 'Completed')      return this.allTasks.filter(t => t.status === 'Completed');
    return this.allTasks;
  }

  ngOnInit(): void {
    this.initCharts();
  }

  private initCharts(): void {
    this.scopeTrendChartData = {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Scopes Completed',
        data: [1, 1, 2, 0],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4, fill: true,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      }]
    };
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'Completed': 'success', 'In Progress': 'info', 'In Review': 'info',
      'Pending': 'secondary', 'Not Started': 'secondary', 'Overdue': 'danger',
    };
    return map[status] ?? 'secondary';
  }

  getPrioritySeverity(priority: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = { High: 'danger', Medium: 'warn', Low: 'info' };
    return map[priority] ?? 'secondary';
  }

  getProgressColor(progress: number): string {
    if (progress >= 70) return '#22c55e';
    if (progress >= 30) return '#f59e0b';
    return '#ef4444';
  }

  isAlertRow(status: string): boolean {
    return status === 'Overdue';
  }
}
