import { Routes } from '@angular/router';

const clientRoutes: Routes = [
    { path: '', redirectTo: 'client-dashboard', pathMatch: 'full' },
    {
        path: 'client-dashboard',
        loadComponent: () => import('./client-dashboard/client-dashboard.component').then((c) => c.ClientDashboardComponent),
        data: { breadcrumb: 'Dashboard' }
    },
    {
        path: 'scope-summary',
        loadComponent: () => import('./audit-scope-summary/audit-scope-summary.component').then((c) => c.AuditScopeSummaryComponent),
        data: { breadcrumb: 'Scope Summary' }
    },
    {
        path: 'manage-client-rfi',
        loadComponent: () => import('./rfi-management-client/rfi-management-client-list/rfi-management-client-list.component').then((c) => c.RfiManagementClientListComponent),
        data: { breadcrumb: 'RFI Management' }
    },
    {
        path: 'cfo-audit-team-chart',
        loadComponent: () => import('./cfo-audit-team-chart/cfo-audit-team-chart.component').then((c) => c.CfoAuditTeamChartComponent),
        data: { breadcrumb: 'Audit Team Chart' }
    },
    {
        path: 'dept-head-audit-team-chart',
        loadComponent: () => import('./dept-head-audit-team-chart/dept-head-audit-team-chart.component').then((c) => c.DeptHeadAuditTeamChartComponent),
        data: { breadcrumb: 'Audit Team Chart' }
    }
];

export default clientRoutes;
