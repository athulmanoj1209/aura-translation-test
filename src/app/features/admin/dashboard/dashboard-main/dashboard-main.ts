import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RfiTab } from './tabs/rfi-tab/rfi-tab';
import { ComplianceTab } from './tabs/compliance-tab/compliance-tab';
import { AuditOverviewComponent } from '../audit-overview/audit-overview.component';
import { AuditFindingsComponent } from '../audit-findings/audit-findings.component';
import { AuditStaffPerformanceComponent } from '@/app/features/admin/dashboard/audit-staff-performance/audit-staff-performance.component';

@Component({
  selector: 'app-dashboard-main',
  imports: [NgClass, RfiTab, ComplianceTab,AuditOverviewComponent,
    AuditFindingsComponent,
    AuditStaffPerformanceComponent],
  templateUrl: './dashboard-main.html',
  styleUrl: './dashboard-main.scss',
})
export class DashboardMain {
  activeTab = 'audit-overview';

  tabs = [
    { id: 'audit-overview',    label: $localize`:@@dashboard.main.tabAuditOverview:Audit Overview`,       icon: 'pi pi-table' },
    { id: 'findings',          label: $localize`:@@dashboard.main.tabFindings:Findings`,                  icon: 'pi pi-exclamation-circle' },
    { id: 'rfi',               label: $localize`:@@dashboard.main.tabRfi:RFI`,                            icon: 'pi pi-file' },
    { id: 'staff-performance', label: $localize`:@@dashboard.main.tabStaffPerformance:Staff Performance`, icon: 'pi pi-users' },
    { id: 'compliance',        label: $localize`:@@dashboard.main.tabCompliance:Compliance`,              icon: 'pi pi-shield' },
  ];
}
