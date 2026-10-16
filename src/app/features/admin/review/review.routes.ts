import { Routes } from '@angular/router';

const reviewRoutes: Routes = [
    { path: '', redirectTo: 'organization-requests', pathMatch: 'full' },
    {
        path: 'organization-requests',
        loadComponent: () => import('./organization-requests/organization-requests-list/organization-requests-list.component').then((c) => c.OrganizationRequestsListComponent),
        data: { breadcrumb: 'Organization Requests' }
    },
    {
        path: 'scope-requests',
        loadComponent: () => import('./scope-requests/scope-requests-list/scope-requests-list.component').then((c) => c.ScopeRequestsListComponent),
        data: { breadcrumb: 'Scope Requests' }
    },
    {
        path: 'risk-approval-list',
        loadComponent: () => import('./risk-requests/risk-requests.component').then((c) => c.RiskPendingApprovalsComponent),
        data: { breadcrumb: 'Risk Requests' }
    },
    {
        path: 'approval-list',
        loadComponent: () => import('./execution-requests/execution-requests.component').then((c) => c.ExecutionApprovalListComponent),
        data: { breadcrumb: 'Execution Requests' }
    },
    {
        path: 'library-requests',
        loadComponent: () => import('./library-requests/library-requests-list/library-requests-list.component').then((c) => c.LibraryRequestsListComponent),
        data: { breadcrumb: 'Library Requests' }
    },
    {
        path: 'draft-reports',
        loadComponent: () => import('./draft-report-requests/draft-report-requests.component').then((c) => c.DraftReportsListComponent),
        data: { breadcrumb: 'Draft Reports' }
    },
    {
        path: 'working-papers',
        loadComponent: () => import('./working-paper-requests/working-paper-requests.component').then((c) => c.WorkingPaperReviewListComponent),
        data: { breadcrumb: 'Working Papers' }
    }
];

export default reviewRoutes;
