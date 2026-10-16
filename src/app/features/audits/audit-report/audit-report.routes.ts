import { Routes } from '@angular/router';

const auditReportRoutes: Routes = [
    { path: '', redirectTo: 'reports-lists', pathMatch: 'full' },
    {
        path: 'report-templates',
        loadComponent: () => import('./report-templates/report-templates-list/report-templates-list.component').then((c) => c.ReportTemplatesListComponent),
        data: { breadcrumb: 'Report Templates' }
    },
    {
        path: 'reports-lists',
        loadComponent: () => import('./final-reports/final-reports-lists/final-reports-lists.component').then((c) => c.FinalReports),
        data: { breadcrumb: 'Reports' }
    },
    {
        path: 'download-report',
        loadComponent: () => import('./download-report/download-report.component').then((c) => c.ReportDownloadComponent),
        data: { breadcrumb: 'Download Report' }
    },
    {
        path: 'upload-report',
        loadComponent: () => import('./upload-report/upload-report.component').then((c) => c.ReportUploadComponent),
        data: { breadcrumb: 'Upload Report' }
    },
    {
        path: 'audit-description-picker',
        loadComponent: () => import('./audit-description-picker/audit-description-picker.component').then((c) => c.AuditDescriptionPickerComponent),
        data: { breadcrumb: 'Audit Description Picker' }
    }
];

export default auditReportRoutes;
