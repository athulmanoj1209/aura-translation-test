import { Component, Input, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { CurrentAuditor } from '@/app/features/admin/auditor-dashboard/models/current-auditor.model';
import { countActivePlansForAuditor, getActivePlansForAuditor } from '@/app/features/audits/audit-plan/audit-plan/audit-plan-list/audit-plan-list.component';
import { countScopesForAuditor } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-management-list/audit-scope-management-list.component';
import { getAllEnrichedRfis } from '@/app/features/audits/audit-execution/rfi-management/rfi-static-data';
import { countOpenFindingsForAuditor } from '@/app/features/audits/audit-execution/findings/findings-list/findings-list.component';
import { countPendingWorkingPapersForAuditor } from '@/app/features/audits/audit-execution/working-papers/working-papers-list/working-papers-list.component';
import { countTasksForAuditor } from '@/app/features/audits/audit-plan/scope-job/scope-job-details/scope-job-details.component';
import { MOCK_NOTIFICATIONS, NotificationItem } from '@/app/features/audits/audit-calendar/notifications/notifications';
import {  DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { DonutStatusChartComponent, DonutLegendItem } from '@/app/shared/components/donut-status-chart/donut-status-chart.component';
interface KpiCard {
  label: string;
  value: string;
  icon: string;
  cardClass: string;
  /** Optional action key — cards with an action are rendered as clickable. */
  action?: string;
}

@Component({
  selector: 'app-auditor-overview',
  imports: [NgClass, ChartModule, TableModule, TagModule, ButtonModule, TooltipModule, PaginatorModule, DrawIconComponent, DonutStatusChartComponent],
  templateUrl: './auditor-overview.component.html',
  styleUrl: './auditor-overview.component.scss',
})
export class AuditorOverviewComponent {

  private readonly router = inject(Router);

  /** The auditor this dashboard is scoped to — hardcoded by the parent dashboard for now. */
  @Input() currentAuditor: CurrentAuditor = { id: 'bob', name: 'Bob Smith' };

  /**
   * Stat cards for the current auditor. Seven of the ten drill down into a
   * filtered list; "Pending Review Comments" stays static (no comments
   * data model to compute it from yet).
   */
  get kpiCards(): KpiCard[] {
    const { id, name } = this.currentAuditor;
    return [
      { label: 'My Active Audits',        value: String(countActivePlansForAuditor(name)),                    icon: 'pi pi-briefcase',           cardClass: '', action: 'active-audits' },
      { label: 'Assigned Scopes',         value: String(countScopesForAuditor(id, 'scope')),                  icon: 'pi pi-list',                cardClass: '', action: 'assigned-scopes' },
      { label: 'Assigned Sub-scopes',     value: String(countScopesForAuditor(id, 'subscope')),               icon: 'pi pi-sitemap',             cardClass: '', action: 'assigned-subscopes' },
      { label: 'Open Tasks',              value: String(countTasksForAuditor(id, 'open') + countTasksForAuditor(id, 'in_progress')), icon: 'pi pi-check-square',        cardClass: '' },
      { label: 'Tasks Due Today',         value: String(countTasksForAuditor(id, 'due-today')),               icon: 'pi pi-calendar',            cardClass: 'stat--warning' },
      { label: 'Overdue Tasks',           value: String(countTasksForAuditor(id, 'overdue')),                 icon: 'pi pi-exclamation-triangle', cardClass: 'stat--danger' },
      { label: 'Pending Review Comments', value: '5',  icon: 'pi pi-comments',            cardClass: 'stat--orange' },
      { label: 'Pending RFI Responses',   value: String(this.pendingRfiCount()),                              icon: 'pi pi-file',                cardClass: 'stat--warning', action: 'pending-rfi' },
      { label: 'Open Findings',           value: String(countOpenFindingsForAuditor(id)),                     icon: 'pi pi-exclamation-circle',  cardClass: 'stat--danger', action: 'open-findings' },
      { label: 'Working Papers Pending',  value: String(countPendingWorkingPapersForAuditor(name)),           icon: 'pi pi-file-edit',           cardClass: '', action: 'working-papers-pending' },
    ];
  }

  private pendingRfiCount(): number {
    const id = this.currentAuditor.id;
    return getAllEnrichedRfis().filter(r => r.auditorIds?.includes(id) && r.status === 'pending').length;
  }


  readonly workDistLegend: DonutLegendItem[] = [
    { label: 'Active Audits',   value: countActivePlansForAuditor(this.currentAuditor.name),  color: '#3b82f6' },
    { label: 'Assigned Scopes', value: countScopesForAuditor(this.currentAuditor.id, 'scope'),  color: '#22c55e' },
    { label: 'Sub-scopes',      value: countScopesForAuditor(this.currentAuditor.id, 'subscope'), color: '#f59e0b' },
    { label: 'Open Findings',   value: countOpenFindingsForAuditor(this.currentAuditor.id),   color: '#ef4444' },
    { label: 'Pending RFIs',    value: this.pendingRfiCount(),            color: '#8b5cf6' },
  ];

  readonly taskStatusLegend: DonutLegendItem[] = [
    { label: 'Not Started', value: 3,  color: '#94a3b8' },
    { label: 'In Progress', value: 8,  color: '#3b82f6' },
    { label: 'Completed',   value: 15, color: '#22c55e' },
    { label: 'Overdue',     value: 2,  color: '#ef4444' },
    { label: 'Blocked',     value: 1,  color: '#f59e0b' },
  ];

  /** Same scope as the "My Active Audits" KPI card — the auditor's in-progress plans. */
  get auditProgress() {
    return getActivePlansForAuditor(this.currentAuditor.name);
  }

  deadlines = [
    { item: 'Submit Working Paper',         audit: 'Procurement',         dueDate: 'Today',    priority: 'High',   type: 'Working Paper' },
    { item: 'Respond to Review Comment',    audit: 'HR Audit',            dueDate: 'Tomorrow', priority: 'High',   type: 'Review Comment' },
    { item: 'Complete Scope Testing',       audit: 'IT Audit',            dueDate: '3 Jul',    priority: 'Medium', type: 'Scope Testing' },
    { item: 'Upload Evidence Files',        audit: 'Procurement',         dueDate: '5 Jul',    priority: 'Medium', type: 'Evidence' },
    { item: 'Submit RFI Response',          audit: 'Finance Audit',       dueDate: '7 Jul',    priority: 'Low',    type: 'RFI Response' },
    { item: 'Finalize Fieldwork Notes',     audit: 'Operations Audit',    dueDate: '8 Jul',    priority: 'Medium', type: 'Fieldwork' },
    { item: 'Raise Draft Finding',          audit: 'IT Audit',            dueDate: '9 Jul',    priority: 'High',   type: 'Finding' },
    { item: 'Review Sub-scope Checklist',   audit: 'HR Audit',            dueDate: '10 Jul',   priority: 'Medium', type: 'Checklist' },
    { item: 'Respond to Evidence Request',  audit: 'Finance Audit',       dueDate: '11 Jul',   priority: 'High',   type: 'Evidence' },
    { item: 'Submit Interim Audit Report',  audit: 'Procurement',         dueDate: '14 Jul',   priority: 'Low',    type: 'Audit Report' },
    { item: 'Complete Walkthrough Testing', audit: 'Inventory Audit',     dueDate: '15 Jul',   priority: 'High',   type: 'Scope Testing' },
    { item: 'Close Pending RFI',            audit: 'Compliance Audit',    dueDate: '16 Jul',   priority: 'Medium', type: 'RFI Response' },
    { item: 'Update Risk Assessment',       audit: 'Cybersecurity Audit', dueDate: '17 Jul',   priority: 'High',   type: 'Risk Assessment' },
    { item: 'Submit Scope Completion',      audit: 'Payroll Audit',       dueDate: '18 Jul',   priority: 'Medium', type: 'Scope Testing' },
    { item: 'Attend Exit Meeting',          audit: 'Warehouse Audit',     dueDate: '19 Jul',   priority: 'Low',    type: 'Meeting' },
  ];

  /** Sourced from the shared notifications mock data, scoped to this auditor's portal. */
  get notifications() {
    return MOCK_NOTIFICATIONS
      .filter(n => n.audience === 'auditor' && n.status === 'active')
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
      .map(n => ({
        icon: n.senderType === 'system' ? 'pi pi-bell' : 'pi pi-user',
        text: n.subject,
        time: this.timeAgo(n.dateTime),
        type: this.notifType(n),
      }));
  }

  private timeAgo(dateTime: string): string {
    const then = new Date(dateTime.replace(' ', 'T')).getTime();
    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1)  return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)   return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1)   return 'Yesterday';
    if (days < 30)    return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  private notifType(n: NotificationItem): 'info' | 'warn' | 'success' | 'danger' {
    const s = n.subject.toLowerCase();
    if (s.includes('overdue') || s.includes('high-risk')) return 'danger';
    if (s.includes('pending') || s.includes('required') || s.includes('reminder')) return 'warn';
    if (s.includes('approved') || s.includes('submitted') || s.includes('ready') || s.includes('scheduled')) return 'success';
    return 'info';
  }

  quickActions = [
    { label: 'Open Assigned Audit',  icon: 'pi pi-folder-open',       severity: 'primary',   action: 'open-assigned-audit' },
    { label: 'Raise Finding',        icon: 'pi pi-exclamation-circle', severity: 'danger',    action: 'raise-finding' },
    { label: 'Send RFI',             icon: 'pi pi-send',               severity: 'info',      action: 'send-rfi' },
    { label: 'Upload Working Paper', icon: 'pi pi-upload',             severity: 'secondary', action: 'upload-working-paper' },
  ];

  // Notification paginator
  notifFirst = 0;
  notifRows  = 4;

  get pagedNotifications() {
    return this.notifications.slice(this.notifFirst, this.notifFirst + this.notifRows);
  }

  onNotifPageChange(event: any): void {
    this.notifFirst = event.first ?? 0;
  }

  // Audit progress paginator
  auditFirst = 0;
  auditRows  = 5;

  get pagedAuditProgress() {
    return this.auditProgress.slice(this.auditFirst, this.auditFirst + this.auditRows);
  }

  onAuditPageChange(event: any): void {
    this.auditFirst = event.first ?? 0;
  }

  /**
   * Handles clicks on KPI cards.
   *  • "My Active Audits"       → audit plan list, in-progress plans for the auditor.
   *  • "Assigned Scopes"        → scope management, scopes assigned to the auditor.
   *  • "Assigned Sub-scopes"    → scope management, sub-scopes assigned to the auditor.
   *  • "Pending RFI Responses"  → RFI management, pending RFIs for the auditor.
   */
  onKpiClick(card: KpiCard): void {
    const { id, name } = this.currentAuditor;
    
    switch (card.action) {
      case 'active-audits':
        this.router.navigate(['/audits/audit-plan/audit-plan-list'], {
          queryParams: {
            status: 'in_progress',
            auditorId: name,
          },
        });
        break;

      case 'assigned-scopes':
        this.router.navigate(['/audits/audit-plan/audit-scope'], {
          queryParams: {
            auditorId: id,
            scopeLevel: 'scope',
          },
        });
        break;

      case 'assigned-subscopes':
        this.router.navigate(['/audits/audit-plan/audit-scope'], {
          queryParams: {
            auditorId: id,
            scopeLevel: 'subscope',
          },
        });
        break;

      case 'pending-rfi':
        this.router.navigate(['/audits/audit-execution/manage-rfi'], {
          queryParams: {
            status: 'pending',
            auditorId: id,
          },
        });
        break;

      case 'working-papers-pending':
        this.router.navigate(['/audits/audit-execution/working-papers'], {
          queryParams: {
            status: 'pending',
            auditorId: name,
          },
        });
        break;

      case 'open-findings':
        this.router.navigate(['/audits/audit-execution/findings'], {
          queryParams: {
            view: 'open',
            auditorId: id,
          },
        });
        break;
    }
  }

  /**
   * Handles clicks on the Quick Actions buttons.
   *  • "Open Assigned Audit"  → same destination as the "My Active Audits" KPI card.
   *  • "Raise Finding"        → Findings list, with the Add Finding drawer opened.
   *  • "Send RFI"             → RFI Management list, with the Add RFI drawer opened.
   *  • "Upload Working Paper" → Working Papers list, with the Add Working Paper drawer opened.
   */
  onQuickAction(action?: string): void {
    const { id, name } = this.currentAuditor;
    switch (action) {
      case 'open-assigned-audit':
        this.onKpiClick({ label: 'My Active Audits', value: '', icon: '', cardClass: '', action: 'active-audits' });
        break;

      case 'raise-finding':
        this.router.navigate(['/audits/audit-execution/findings'], {
          queryParams: {
            auditorId: id,
            openAdd: 'true',
          },
        });
        break;

      case 'send-rfi':
        this.router.navigate(['/audits/audit-execution/manage-rfi'], {
          queryParams: {
            auditorId: id,
            openAdd: 'true',
          },
        });
        break;

      case 'upload-working-paper':
        this.router.navigate(['/audits/audit-execution/working-papers'], {
          queryParams: {
            auditorId: name,
            openAdd: 'true',
          },
        });
        break;
    }
  }

  /**
   * Both charts below are built from the exact same helper calls used for
   * the KPI cards (see kpiCards() and pendingRfiCount() above), so their
   * slices always add up to what the stat cards show.
   */
  

  getPrioritySeverity(priority: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = { High: 'danger', Medium: 'warn', Low: 'info' };
    return map[priority] ?? 'secondary';
  }

  getTypeConfig(type: string): { icon: string; cls: string } {
    const map: Record<string, { icon: string; cls: string }> = {
      'Working Paper':   { icon: 'pi pi-file-edit',           cls: 'type--working-paper' },
      'RFI Response':    { icon: 'pi pi-reply',               cls: 'type--rfi' },
      'Scope Testing':   { icon: 'pi pi-check-circle',        cls: 'type--scope' },
      'Evidence':        { icon: 'pi pi-paperclip',           cls: 'type--evidence' },
      'Finding':         { icon: 'pi pi-exclamation-circle',  cls: 'type--finding' },
      'Fieldwork':       { icon: 'pi pi-pencil',              cls: 'type--fieldwork' },
      'Review Comment':  { icon: 'pi pi-comment',             cls: 'type--review' },
      'Risk Assessment': { icon: 'pi pi-shield',              cls: 'type--risk' },
      'Audit Report':    { icon: 'pi pi-file',                cls: 'type--audit-report' },
      'Checklist':       { icon: 'pi pi-list-check',          cls: 'type--checklist' },
      'Meeting':         { icon: 'pi pi-users',               cls: 'type--meeting' },
    };
    return map[type] ?? { icon: 'pi pi-tag', cls: 'type--default' };
  }

  getProgressColor(progress: number): string {
    if (progress >= 70) return '#22c55e';
    if (progress >= 40) return '#f59e0b';
    return '#ef4444';
  }
}