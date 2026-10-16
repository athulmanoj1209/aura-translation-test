import { Routes } from '@angular/router';

const followUpRoutes: Routes = [
    {
        path: '',
        loadComponent: () => import('./followup-list/followup-list.component').then((c) => c.FollowupListComponent),
        data: { breadcrumb: 'Follow Up' }
    },
    {
        path: 'details/:id',
        loadComponent: () => import('../audit-execution/findings/findings-detail/findings-detail.component').then((c) => c.FindingDetailComponent),
        data: { breadcrumb: 'Follow-up Details' }
    }
];

export default followUpRoutes;
