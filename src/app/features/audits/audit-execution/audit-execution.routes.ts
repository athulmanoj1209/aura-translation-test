import { Routes } from '@angular/router';

const auditExecutionRoutes: Routes = [
    { path: '', redirectTo: 'manage-rfi', pathMatch: 'full' },
    {
        path: 'manage-rfi',
        loadComponent: () => import('./rfi-management/rfi-management-list/rfi-management-list.component').then((c) => c.RfiManagementListComponent),
        data: { breadcrumb: 'RFI Management' }
    },
    {
        path: 'evidence-list',
        loadComponent: () => import('./evidence/evidence-list/evidence-list.component').then((c) => c.EvidenceListComponent),
        data: { breadcrumb: 'Evidence' }
    },
    {
        path: 'observation-list',
        loadComponent: () => import('./observation/observation-list/observation-list.component').then((c) => c.ObservationListComponent),
        data: { breadcrumb: 'Observations' }
    },
    {
        path: 'findings',
        loadComponent: () => import('./findings/findings-list/findings-list.component').then((c) => c.FindingsListComponent),
        data: { breadcrumb: 'Findings' }
    },
    {
        path: 'recommendation-list',
        loadComponent: () => import('./recommendation/recommendation-list/recommendation-list.component').then((c) => c.RecommendationListComponent),
        data: { breadcrumb: 'Recommendations' }
    },
    {
        path: 'working-papers',
        loadComponent: () => import('./working-papers/working-papers-list/working-papers-list.component').then((c) => c.WorkingPaperListComponent),
        data: { breadcrumb: 'Working Papers' }
    },
    {
        path: 'assign-auditors',
        loadComponent: () => import('./auditor-assignment/auditor-assignment.component').then((c) => c.AuditorAssignmentComponent),
        data: { breadcrumb: 'Assign Auditors' }
    },
    {
        path: 'reassign-auditors',
        loadComponent: () => import('./reassign-auditors/auditor-reassignment/auditor-reassignment.component').then((c) => c.AuditorReassignmentComponent),
        data: { breadcrumb: 'Reassign Auditors' }
    }
];

export default auditExecutionRoutes;
