import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { AuditorOverviewComponent } from '../auditor-overview/auditor-overview.component';
import { AuditorMyAuditsScopesComponent } from '../auditor-my-audits-scopes/auditor-my-audits-scopes.component';
import { AuditorWorkingPapersRfisComponent } from '../auditor-working-papers-rfis/auditor-working-papers-rfis.component';
import { AuditorExecutionComponent } from '../auditor-execution/auditor-execution.component';
import { AuditorReviewsComponent } from '../auditor-reviews/auditor-reviews.component';
import { CurrentAuditor } from '@/app/features/admin/auditor-dashboard/models/current-auditor.model';

@Component({
  selector: 'app-main-auditor-dashboard',
  imports: [
    NgClass,
    AuditorOverviewComponent,
    AuditorMyAuditsScopesComponent,
    AuditorWorkingPapersRfisComponent,
    AuditorExecutionComponent,
    AuditorReviewsComponent,
  ],
  templateUrl: './main-auditor-dashboard.component.html',
  styleUrl: './main-auditor-dashboard.component.scss',
})
export class MainAuditorDashboard {
  /** Hardcoded for now — the dashboard is scoped to this one auditor until real auth is wired in. */
  readonly currentAuditor: CurrentAuditor = { id: 'bob', name: 'Bob Smith' };

  activeTab = 'overview';

  tabs = [
    { id: 'overview',         label: 'Overview',                icon: 'pi pi-home' },
    { id: 'scope-management', label: 'My Audits & Scopes',      icon: 'pi pi-list' },
    { id: 'working-papers',   label: 'Working Papers & RFIs',   icon: 'pi pi-file' },
    { id: 'execution',        label: 'Execution',               icon: 'pi pi-play-circle' },
    { id: 'reviews',          label: 'Reviews',                 icon: 'pi pi-check-circle' },
  ];
}
