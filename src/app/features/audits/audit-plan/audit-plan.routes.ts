import { Routes } from '@angular/router';

const auditPlanRoutes: Routes = [
    { path: '', redirectTo: 'audit-plan-selector', pathMatch: 'full' },
    {
        path: 'risks',
        loadComponent: () => import('./risk/risk-register-list/risk-register-list.component').then((c) => c.RiskRegisterListComponent),
        data: { breadcrumb: 'Risks' }
    },
    {
        path: 'audit-scope',
        loadComponent: () => import('./audit-scope-management/audit-scope-management-list/audit-scope-management-list.component').then((c) => c.AuditScopeManagementListComponent),
        data: { breadcrumb: 'Audit Scope Management' }
    },
    {
        path: 'scope-jobs',
        loadComponent: () => import('./scope-job/scope-job-list/scope-job-list.component').then((c) => c.ScopeJobListComponent),
        data: { breadcrumb: 'Scope Jobs' }
    },
    {
        path: 'audit-plan',
        loadComponent: () => import('./audit-plan/audit-plan.component').then((c) => c.AuditPlanComponent),
        data: { breadcrumb: 'Audit Plan' }
    },
    {
        path: 'audit-plan-selector',
        loadComponent: () => import('./audit-plan/audit-plan-selector/audit-plan-selector.component').then((c) => c.AuditPlanSelectorComponent),
        data: { breadcrumb: 'Audit Plan Selector' }
    },
    {
        path: 'audit-plan-list',
        loadComponent: () => import('./audit-plan/audit-plan-list/audit-plan-list.component').then((c) => c.AuditPlanListComponent),
        data: { breadcrumb: 'Audit Plan List' }
    }
];

export default auditPlanRoutes;
