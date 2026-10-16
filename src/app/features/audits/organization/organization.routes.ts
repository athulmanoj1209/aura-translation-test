import { Routes } from '@angular/router';

const organizationRoutes: Routes = [
    { path: '', redirectTo: 'company', pathMatch: 'full' },
    {
        path: 'company',
        loadComponent: () => import('./company/company-list/company-list.component').then((c) => c.CompaniesListComponent),
        data: { breadcrumb: 'Company' }
    },
    {
        path: 'divisions',
        loadComponent: () => import('./divisions/divisions-list/divisions-list.component').then((c) => c.DivisionsListComponent),
        data: { breadcrumb: 'Divisions' }
    },
    {
        path: 'sub-divisions',
        loadComponent: () => import('./sub-divisions/sub-divisions-list/sub-divisions-list.component').then((c) => c.SubDivisionsListComponent),
        data: { breadcrumb: 'Sub-Divisions' }
    },
    {
        path: 'client-org-chart',
        loadComponent: () => import('./client-organizational-chart/client-organizational-chart').then((c) => c.ClientOrganizationalChart),
        data: { breadcrumb: 'Client Org Chart' }
    }
];

export default organizationRoutes;
