import { Routes } from '@angular/router';

const userRoutes: Routes = [
    { path: '', redirectTo: 'user-list', pathMatch: 'full' },
    {
        path: 'user-list',
        loadComponent: () => import('./users/user-list/user-list.component').then((c) => c.UsersListComponent),
        data: { breadcrumb: 'Users' }
    },
    {
        path: 'role',
        loadComponent: () => import('./role-permissions/role-permissions.component').then((c) => c.RolePermissionsComponent),
        data: { breadcrumb: 'Roles' }
    }
];

export default userRoutes;
