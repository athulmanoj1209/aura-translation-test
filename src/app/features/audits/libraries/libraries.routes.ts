import { Routes } from '@angular/router';

const librariesRoutes: Routes = [
    { path: '', redirectTo: 'regulations', pathMatch: 'full' },
    {
        path: 'regulations',
        loadComponent: () => import('./regulation-library/regulation-library-list/regulation-library-list.component').then((c) => c.RegulationLibraryComponent),
        data: { breadcrumb: 'Regulations' }
    },
    {
        path: 'regulation-details/:id',
        loadComponent: () => import('./regulation-library/regulation-detail/regulation-detail.component').then((c) => c.RegulationDetailComponent),
        data: { breadcrumb: 'Regulation Details' }
    },
    {
        path: 'audit-scope-library',
        loadComponent: () => import('./audit-scope-library/audit-scope-library-list/audit-scope-library-list.component').then((c) => c.AuditScopeLibraryListComponent),
        data: { breadcrumb: 'Audit Scope Library' }
    },
    {
        path: 'rfi-management-library',
        loadComponent: () => import('./rfi-management-library/rfi-management-library-list/rfi-management-library-list.component').then((c) => c.RfiManagementLibraryListComponent),
        data: { breadcrumb: 'RFI Management Library' }
    }
];

export default librariesRoutes;
