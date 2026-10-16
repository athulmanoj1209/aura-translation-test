import { Routes } from '@angular/router';
import { AppLayout } from '@/app/layout/components/app.layout';
// import { Landing } from '@/app/apps/pages/landing/landing';
// import { Notfound } from '@/app/apps/pages/notfound/notfound';
import { DashboardMain } from './app/features/admin/dashboard/dashboard-main/dashboard-main';
import { ClientDashboardComponent } from './app/features/client/client-dashboard/client-dashboard.component';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [
            {
                path: '',
                component: DashboardMain,
                data: { breadcrumb: 'Dashboard' }
            },
            {
                path: 'admin',
                loadChildren: () => import('@/app/features/admin/admin.routes'),
                data: { breadcrumb: 'Admin' }
            },
            {
                path: 'audits',
                loadChildren: () => import('@/app/features/audits/audits.routes'),
                data: { breadcrumb: 'Audits' }
            },
            {
                path: 'findings',
                loadComponent: () => import('./app/features/audits/audit-execution/findings/findings-list/findings-list.component').then((c) => c.FindingsListComponent),
                data: { breadcrumb: 'Findings' }
            },
            {
                path: 'assign-auditors',
                loadComponent: () => import('./app/features/audits/audit-execution/auditor-assignment/auditor-assignment.component').then((c) => c.AuditorAssignmentComponent),
                data: { breadcrumb: 'Review Risks' }
            },
            {
                path: 'events-meetings',
                loadComponent: () => import('./app/features/audits/audit-calendar/events-meetings/events-meetings-list/events-meetings-list.component').then((c) => c.EventMeetingListComponent),
                data: { breadcrumb: 'Events & Meetings' }
            },
            {
                path: 'industry-type',
                loadComponent: () => import('./app/features/admin/look-up/industry-type/industry-type-list/industry-type-list.component').then((c) => c.IndustryTypeListComponent),
                data: { breadcrumb: 'Industry type' }
            }
            ,
            {
                path: 'ownership-type',
                loadComponent: () => import('./app/features/admin/look-up/ownership-type/ownership-type-list/ownership-type-list.component').then((c) => c.OwnershipTypeListComponent),
                data: { breadcrumb: 'Industry type' }
            }
            ,
            {
                path: 'entity-type',
                loadComponent: () => import('./app/features/admin/look-up/entity-type/entity-type-list/entity-type-list.component').then((c) => c.EntityTypeListComponent),
                data: { breadcrumb: 'Entity type' }
            },

            {
                path: 'revenue-bracket',
                loadComponent: () => import('./app/features/admin/look-up/revenue-bracket/revenue-bracket-list/revenue-bracket-list.component').then((c) => c.RevenueBracketListComponent),
                data: { breadcrumb: 'Revenue Bracket' }
            },
            {
                path: 'next audit cycle',
                loadComponent: () => import('./app/features/admin/look-up/next-audit-cycle/next-audit-cycle-list/next-audit-cycle-list.component').then((c) => c.NextAuditCycleListComponent),
                data: { breadcrumb: 'Revenue Bracket' }
            }
            ,
            {
                path: 'areas of expertise',
                loadComponent: () => import('./app/features/admin/look-up/areas-of-expertise/areas-of-expertise-list/areas-of-expertise-list.component').then((c) => c.AreaOfExpertiseListComponent),
                data: { breadcrumb: 'Revenue Bracket' }
            }
            ,
            {
                path: 'evidence type',
                loadComponent: () => import('./app/features/admin/look-up/evidence-type/evidence-type-list/evidence-type-list.component').then((c) => c.EvidenceTypeListComponent),
                data: { breadcrumb: 'Evidence Type' }
            }
            ,
            {
                path: 'related functions',
                loadComponent: () => import('./app/features/admin/look-up/related-functions/related-functions-list/related-functions-list.component').then((c) => c.RelatedFunctionListComponent),
                data: { breadcrumb: 'Related Functions' }
            }
            ,
            {
                path: 'rfi category',
                loadComponent: () => import('./app/features/admin/look-up/rfi-category/rfi-category-list/rfi-category-list.component').then((c) => c.RfiCategoryListComponent),
                data: { breadcrumb: 'RFI Category' }
            },
            {
                path: 'risk-ratings',
                loadComponent: () => import('./app/features/admin/look-up/risk-rating/risk-rating-list/risk-rating-list.component').then((c) => c.RiskRatingListComponent),
                data: { breadcrumb: 'Risk Ratings' }
            },
            {
                path: 'risk-statuses',
                loadComponent: () => import('./app/features/admin/look-up/risk-status/risk-status-list/risk-status-list.component').then((c) => c.RiskStatusListComponent),
                data: { breadcrumb: 'Risk Statuses' }
            },
            {
                path: 'risk-categories',
                loadComponent: () => import('./app/features/admin/look-up/risk-category/risk-category-list/risk-category-list.component').then((c) => c.RiskCategoryListComponent),
                data: { breadcrumb: 'Risk Categories' }
            },
            {
                path: 'risk-owners',
                loadComponent: () => import('./app/features/admin/look-up/risk-owner/risk-owner-list/risk-owner-list.component').then((c) => c.RiskOwnerListComponent),
                data: { breadcrumb: 'Risk Owners' }
            },
            {
                path: 'audit-frequencies',
                loadComponent: () => import('./app/features/admin/look-up/audit-frequency/audit-frequency-list/audit-frequency-list.component').then((c) => c.AuditFrequencyListComponent),
                data: { breadcrumb: 'Audit Frequencies' }
            },
            {
                path: 'audit-modes',
                loadComponent: () => import('./app/features/admin/look-up/audit-mode/audit-mode-list/audit-mode-list.component').then((c) => c.AuditModeListComponent),
                data: { breadcrumb: 'Audit Modes' }
            },
            {
                path: 'scope-types',
                loadComponent: () => import('./app/features/admin/look-up/scope-type/scope-type-list/scope-type-list.component').then((c) => c.ScopeTypeListComponent),
                data: { breadcrumb: 'Scope Types' }
            },
            {
                path: 'sampling-methodologies',
                loadComponent: () => import('./app/features/admin/look-up/sampling-methodology/sampling-methodology-list/sampling-methodology-list.component').then((c) => c.SamplingMethodologyListComponent),
                data: { breadcrumb: 'Sampling Methodologies' }
            },
            {
                path: 'hourly-rates',
                loadComponent: () => import('./app/features/admin/look-up/hourly-rates/hourly-rates-list/hourly-rates-list.component').then((c) => c.HourlyRatesListComponent),
                data: { breadcrumb: 'Hourly Rates' }
            },
            {
                path: 'applicable-frameworks',
                loadComponent: () => import('./app/features/admin/look-up/applicable-framework/applicable-framework-list/applicable-framework-list.component').then((c) => c.ApplicableFrameworkListComponent),
                data: { breadcrumb: 'Applicable Frameworks' }
            },
            {
                path: 'department-type',
                loadComponent: () => import('./app/features/admin/look-up/department-type/department-type-list/department-type-list.component').then((c) => c.DepartmentTypeListComponent),
                data: { breadcrumb: 'department-type' }
            },
            {
                path: 'cfo-audit-team-chart',
                loadComponent: () => import('./app/features/client/cfo-audit-team-chart/cfo-audit-team-chart.component').then((c) => c.CfoAuditTeamChartComponent),
                data: { breadcrumb: 'Audit team chart' }
            }
            ,
            {
                path: 'dept-head-audit-team-chart',
                loadComponent: () => import('./app/features/client/dept-head-audit-team-chart/dept-head-audit-team-chart.component').then((c) => c.DeptHeadAuditTeamChartComponent),
                data: { breadcrumb: 'Audit team chart' }
            },
            {
                path: 'scope-jobs',
                loadComponent: () => import('./app/features/audits/audit-plan/scope-job/scope-job-list/scope-job-list.component').then((c) => c.ScopeJobListComponent),
                data: { breadcrumb: 'Sope Jobs' }
            },
            {
                path: 'reassign-auditors',
                loadComponent: () => import('./app/features/audits/audit-execution/reassign-auditors/auditor-reassignment/auditor-reassignment.component').then((c) => c.AuditorReassignmentComponent),
                data: { breadcrumb: 'Reassign Auditors' }
            },
            {
                path: 'audit-plan',
                loadComponent: () => import('./app/features/audits/audit-plan/audit-plan/audit-plan.component').then((c) => c.AuditPlanComponent),
                data: { breadcrumb: 'Audit plan ' }
            }
            ,
            {
                path: 'audit-plan-selector',
                loadComponent: () => import('./app/features/audits/audit-plan/audit-plan/audit-plan-selector/audit-plan-selector.component').then((c) => c.AuditPlanSelectorComponent),
                data: { breadcrumb: 'Audit Plan Selectors' }
            },
            {
                path: 'audit-plan-list',
                loadComponent: () => import('./app/features/audits/audit-plan/audit-plan/audit-plan-list/audit-plan-list.component').then((c) => c.AuditPlanListComponent),
                data: { breadcrumb: 'Audit Plan Selectors' }
            },
            {
                path: 'download-report',
                loadComponent: () => import('./app/features/audits/audit-report/download-report/download-report.component').then((c) => c.ReportDownloadComponent),
                data: { breadcrumb: 'Working Papers' }
            }
            ,
            {
                path: 'upload-report',
                loadComponent: () => import('./app/features/audits/audit-report/upload-report/upload-report.component').then((c) => c.ReportUploadComponent),
                data: { breadcrumb: 'Working Papers' }
            }
            ,
            {
                path: 'draft-reports',
                loadComponent: () => import('./app/features/admin/review/draft-report-requests/draft-report-requests.component').then((c) => c.DraftReportsListComponent),
                data: { breadcrumb: 'Draft report list' }
            }
            , {
                path: 'audit-description-picker',
                loadComponent: () => import('./app/features/audits/audit-report/audit-description-picker/audit-description-picker.component').then((c) => c.AuditDescriptionPickerComponent),
                data: { breadcrumb: 'Audit Description Picker' }
            },
            {
                path: 'working-papers',
                loadComponent: () => import('./app/features/audits/audit-execution/working-papers/working-papers-list/working-papers-list.component').then((c) => c.WorkingPaperListComponent),
                data: { breadcrumb: 'Working Papers' }
            }
            ,
            {
                path: 'review-working-papers',
                loadComponent: () => import('./app/features/admin/review/working-paper-requests/working-paper-requests.component').then((c) => c.WorkingPaperReviewListComponent),
                data: { breadcrumb: 'Working Papers' }
            },
            {
                path: 'audit-scope',
                loadComponent: () => import('./app/features/audits/audit-plan/audit-scope-management/audit-scope-management-list/audit-scope-management-list.component').then((c) => c.AuditScopeManagementListComponent),
                data: { breadcrumb: 'Audit Scope Management' }
            },
            {
                path: 'organization-requests',
                loadComponent: () => import('./app/features/admin/review/organization-requests/organization-requests-list/organization-requests-list.component').then((c) => c.OrganizationRequestsListComponent),
                data: { breadcrumb: 'Organization Requests' }
            },
            {
                path: 'library-requests',
                loadComponent: () => import('./app/features/admin/review/library-requests/library-requests-list/library-requests-list.component').then((c) => c.LibraryRequestsListComponent),
                data: { breadcrumb: 'Library Requests' }
            },
            {
                path: 'scope-requests',
                loadComponent: () => import('./app/features/admin/review/scope-requests/scope-requests-list/scope-requests-list.component').then((c) => c.ScopeRequestsListComponent),
                data: { breadcrumb: 'Scope Requests' }
            },
            {
                path: 'divisions',
                loadComponent: () => import('./app/features/audits/organization/divisions/divisions-list/divisions-list.component').then((c) => c.DivisionsListComponent),
                data: { breadcrumb: 'Divisions' }
            },
            {
                path: 'sub-divisions',
                loadComponent: () => import('./app/features/audits/organization/sub-divisions/sub-divisions-list/sub-divisions-list.component').then((c) => c.SubDivisionsListComponent),
                data: { breadcrumb: 'Sub-Divisions' }
            },
            {
                path: 'client-org-chart',
                loadComponent: () => import('./app/features/audits/organization/client-organizational-chart/client-organizational-chart').then((c) => c.ClientOrganizationalChart),
                data: { breadcrumb: 'Client Org Chart' }
            },
            {
                path: 'manage-rfi',
                loadComponent: () => import('./app/features/audits/audit-execution/rfi-management/rfi-management-list/rfi-management-list.component').then((c) => c.RfiManagementListComponent),
                data: { breadcrumb: 'Audit Scope Management' }
            },
            {
                path: 'audit-scope-library',
                loadComponent: () => import('./app/features/audits/libraries/audit-scope-library/audit-scope-library-list/audit-scope-library-list.component').then((c) => c.AuditScopeLibraryListComponent),
                data: { breadcrumb: 'Audit Scope Library' }
            },
            {
                path: 'rfi-management-library',
                loadComponent: () => import('./app/features/audits/libraries/rfi-management-library/rfi-management-library-list/rfi-management-library-list.component').then((c) => c.RfiManagementLibraryListComponent),
                data: { breadcrumb: 'RFI Management Library' }
            },
            {
                path: 'report-templates',
                loadComponent: () => import('./app/features/audits/audit-report/report-templates/report-templates-list/report-templates-list.component').then(c => c.ReportTemplatesListComponent),
                data: { breadcrumb: 'report-templates' }
            },
            {
                path: 'reports-lists',
                loadComponent: () => import('./app/features/audits/audit-report/final-reports/final-reports-lists/final-reports-lists.component').then(c => c.FinalReports),
                data: { breadcrumb: 'reports-lists' }
            },
            {
                path: 'manage-client-rfi',
                loadComponent: () => import('./app/features/client/rfi-management-client/rfi-management-client-list/rfi-management-client-list.component').then((c) => c.RfiManagementClientListComponent),
                data: { breadcrumb: 'Client RFI Management' }
            },
            {
                path: 'dashboard-main',
                component: DashboardMain,
                data: { breadcrumb: 'Dashboard' }
            },
            {
                path: 'client-dashboard',
                component: ClientDashboardComponent,
                data: { breadcrumb: 'client dashboard' }
            },
            {
                path: 'scope-summary',
                loadComponent: () => import('./app/./features/client/audit-scope-summary/audit-scope-summary.component').then((c) => c.AuditScopeSummaryComponent),
                data: { breadcrumb: 'scope-summary' }
            },
            {
                path: 'notifications',
                loadComponent: () => import('./app/./features/audits/audit-calendar/notifications/notifications').then(c => c.Notifications),
                data: { breadcrumb: 'notifications' }
            },
        ]
    },
    // { path: 'landing', component: Landing },
    // { path: 'notfound', component: Notfound },
    // {
    //     path: 'auth',
    //     loadChildren: () => import('@/app/apps/pages/auth/auth.routes')
    // },
    { path: '**', redirectTo: '/notfound' }
];
