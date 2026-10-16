import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { CLIENT_MODE } from '@/app/core/config/client-mode';


@Component({
  selector: 'app-audit-plan-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule, TooltipModule, DrawIconComponent],
  templateUrl: './audit-plan-selector.component.html',
  styleUrl:    './audit-plan-selector.component.scss',
})
export class AuditPlanSelectorComponent {
  private readonly router = inject(Router);
  private readonly companyDataService = inject(CompanyDataService);
  private readonly clientMode = inject(CLIENT_MODE);

  /**
   * Reactive company list, sourced from CompanyDataService rather than a
   * local hardcoded list. CompanyDataService already seeds itself from
   * company-static-indi-org.data.ts (single company) when CLIENT_MODE is
   * 'internal-audit', or company-static-data.ts (multi-company) otherwise —
   * so in internal-audit mode this screen shows just DAR Exchange as the
   * only chip/dropdown option (still clickable, no auto-redirect).
   */
  readonly companies = this.companyDataService.companies;

  readonly dropdownOptions = computed(() =>
    this.companies().map(c => ({ label: c.companyName, value: c.id })),
  );

  /** Handy in the template if you want to tweak copy/layout for the single-company case. */
  readonly isInternalAudit = computed(() => this.clientMode === 'internal-audit');

  selected = signal<string | null>(null);

  selectCompany(id: string): void {
    this.selected.set(id);
    this.navigate(id);
  }

  onDropdownChange(id: string | null): void {
    if (id) this.navigate(id);
  }

  private navigate(id: string): void {
    const company = this.companyDataService.getById(id);
    this.router.navigate(['/audits/audit-plan/audit-plan'], {
      queryParams: {
        company:     id,
        companyName: company?.companyName ?? '',
      },
    });
  }
}