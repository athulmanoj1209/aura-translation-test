import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { Router } from '@angular/router';
import { Division } from '@/app/features/audits/organization/divisions/models/division.model';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import {
  AddCompanyModalComponent,
  CompanyFormModel,
} from '../add-company-modal/add-company-modal.component';
import {  CompanyProfileComponent, CompanyProfileData } from '../company-profile/company-profile.component';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// Global company data store — see company-data.service.ts.
// Every component that needs company data injects this service instead of
// importing a local copy, so all screens read/write the same store.

import { Company as CompanyRecord, OrgStatus } from '../models/company.model';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';

/**
 * Domain model for the list view. Distinct from the form payload —
 * the form returns CompanyFormModel; we convert into Company before
 * inserting into our list.
 */
export interface Company {
  id: string;
  name: string;
  entityType: string;         // e.g. "LLC"
  industry: string;           // e.g. "Construction & Real Estate"
  location: string;           // e.g. "United Arab Emirates"
  primaryContact: {
    name: string;
    phone: string;
    avatarUrl?: string;
  };
  blocked: boolean;
  createdAt: Date;
  orgStatus?: OrgStatus;
  submittedBy?: string;
  submittedDate?: string;
  dueDate?: string | null;
  /**
   * Full source record from the global CompanyDataService (populated when
   * hydrated from the shared store, or from the Add/Edit Company form).
   * The list view only needs the lean fields above, but keeping the full
   * record around lets the profile drawer — and re-opening the Edit form —
   * show every field the form actually captures (registration no.,
   * address, regulatory, financial, risk & audit) instead of just the
   * list-display subset.
   */
  raw?: CompanyRecord;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'name_asc' | 'name_desc' | 'recent' | 'location';

interface FilterForm {
  search: string;
  sortBy: SortOption;
}

@Component({
  selector: 'app-companies-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    DialogModule,
    TagModule,
    PaginationBarComponent,DrawIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-list.component.html',
  styleUrls: ['./company-list.component.scss'],
})
export class CompaniesListComponent {

  private readonly fb = inject(FormBuilder);
  private readonly drawer = inject(RightDrawerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly companyData = inject(CompanyDataService);
   readonly loadingCompanyId = signal<string | null>(null);


  // ---------------- Filter form (reactive) ----------------
  readonly filters = this.fb.group({
    search: [''],
    sortBy: ['name_asc' as SortOption],
  });

  /** Debounced + de-duped form value as a signal. */
  private readonly filtersSignal = toSignal(
    this.filters.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(
        (a, b) => a.search === b.search && a.sortBy === b.sortBy,
      ),
      startWith(this.filters.value),
    ),
    { initialValue: this.filters.value },
  );

  // ---------------- Page-level state ----------------
  readonly viewMode = signal<ViewMode>('grid');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  // ---------------- Data ----------------
  /**
   * Source of truth is CompanyDataService (global, DI-injected) — this is
   * just the list-view projection of it. Because it's a computed() driven
   * by the service's signal, any mutation made here (or from any other
   * component sharing the service) is reflected automatically.
   */
  private readonly companiesData = computed<Company[]>(() =>
    this.companyData.companies().map(c => this.toListCompany(c)),
  );

  /** Filtered + sorted view. */
  readonly filteredCompanies = computed<Company[]>(() => {
    const all = this.companiesData();
    const { search, sortBy } = this.filtersSignal() ?? {};

    let result = [...all];

    const q = (search ?? '').trim().toLowerCase();
    if (q) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.entityType.toLowerCase().includes(q),
      );
    }

    switch (sortBy ?? 'name_asc') {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'recent':
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
          }

    return result;
  });

  /** The current page slice. */
  readonly pagedCompanies = computed<Company[]>(() => {
    const filtered = this.filteredCompanies();
    const size = this.pageSize();
    const start = (this.currentPage() - 1) * size;
    return filtered.slice(start, start + size);
  });

  readonly totalCount = computed(() => this.filteredCompanies().length);

  // ---------------- Dropdown options ----------------
  readonly sortOptions: { label: string; value: SortOption }[] = [
    { label: 'Name (A–Z)', value: 'name_asc' },
    { label: 'Name (Z–A)', value: 'name_desc' },
    { label: 'Recently Added', value: 'recent' },

  ];

  /** Options for the "items per page" dropdown in <app-pagination-bar>. */
  readonly pageSizeOptions: number[] = [10, 25, 50, 100];

  // ---------------- Approval status chip (orgStatus) ----------------
  readonly orgStatusLabel: Record<string, string> = {
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  readonly orgStatusSeverity: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
    pending_review: 'warn',
    approved: 'success',
    rejected: 'danger',
  };

  // ---------------- Constructor / setup ----------------
  constructor() {
    // Reset to page 1 whenever filters change
    this.filters.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.currentPage.set(1));
  }

  // ---------------- Actions ----------------
  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  /** <app-pagination-bar> emits a zero-based page index. */
  onPageChange(page: number): void {
    this.currentPage.set(page + 1);
  }

  /** Called when the "items per page" dropdown changes. Resets to page 1
   *  so the visible slice stays consistent with the new page size. */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  async openAddCompany(): Promise<void> {
    const ref = this.drawer.open<CompanyFormModel>(AddCompanyModalComponent, {
     // ariaLabel: 'Add new company',
      width: '720px',
    });
    const result = await ref.afterClosed;
    if (result) {
      this.companyData.add(this.toCompanyRecord(result));
    }
  }

  async editCompany(company: Company): Promise<void> {
    const ref = this.drawer.open<CompanyFormModel>(AddCompanyModalComponent, {
     // ariaLabel: `Edit ${company.name}`,
      data: { existing: this.toFormModel(company),type:"Edit" },
       width: '720px',
    });
    const result = await ref.afterClosed;
    if (result) {
      this.companyData.update(
        company.id,
        this.toCompanyRecord(result, company.id, company.raw),
      );
    }
  }

async viewCompany(company: Company): Promise<void> {
  if (this.loadingCompanyId()) return;                       // dedupe double clicks
  this.loadingCompanyId.set(company.id);

  let profile: CompanyProfileData;
  try {
    // Build the profile from the row that was actually clicked.
    // Swap this for a real backend call when one is available, e.g.:
    // const fetched = await firstValueFrom(this.companiesApi.getById(company.id));
    const fetched = this.companyToProfile(company);
    if (!fetched) return;                                    // 404
    profile = fetched;
  } catch (err) {
    console.error('Failed to load company profile', err);
    return;
  } finally {
    this.loadingCompanyId.set(null);
  }

  this.drawer.open(CompanyProfileComponent, { data: profile, width: '820px' });
}


  /**
   * Maps the lean list model — enriched with the full source record in
   * `raw` when available — onto every field the profile drawer can show.
   */
  private companyToProfile(company: Company): CompanyProfileData {
    const r = company.raw;

    return {
      id:            company.id,
      name:          company.name,
      logoUrl:       undefined,
      entityType:    r?.typeOfEntity ?? company.entityType,
      industry:      r?.industrySector ?? company.industry,
      ownershipType: r?.ownershipType ? this.lookupOwnershipLabel(r.ownershipType) : undefined,
      blocked:       company.blocked,

      // ---- Location -----------------------------------------------
      country: r?.countryOfIncorporation ? this.lookupCountryLabel(r.countryOfIncorporation) : company.location,
      region:  r?.regionEmirate ? this.lookupRegionLabel(r.regionEmirate) : undefined,
      city:    r?.city ?? undefined,
      address: r?.address ?? undefined,

      // ---- Contact ---------------------------------------------------
      email:   r?.email ?? undefined,
      phone:   r?.phone ?? company.primaryContact.phone,
      website: r?.website ?? undefined,

      // ---- Registration ------------------------------------------------
      tradeLegalRegNumber: r?.tradeLegalRegNumber ?? undefined,
      dateOfIncorporation: r?.dateOfIncorporation ?? undefined,
      parentCompany:       r?.parentCompany ?? undefined,
      groupAffiliation:    r?.groupAffiliation ?? undefined,
      notes:               r?.notes ?? undefined,

      // ---- Regulatory --------------------------------------------------
      isRegulated:             r?.isRegulated ?? undefined,
      regIndustry:             r?.regIndustry ?? undefined,
      regulatoryLicenseNumber: r?.regulatoryLicenseNumber ?? undefined,
      licenseExpiryDate:       r?.licenseExpiryDate ?? undefined,
      regulatoryNotes:         r?.regulatoryNotes ?? undefined,

      // ---- Financial & Operational ---------------------------------
      currencyAccount:              r?.currencyAccount ?? undefined,
      annualTurnoverBracket:        r?.annualTurnoverBracket ?? undefined,
      numberOfEmployees:            r?.numberOfEmployees ?? undefined,
      numberOfSubDivisionsLocations: r?.numberOfSubDivisionsLocations ?? undefined,
      fiscalYearStart:              r?.fiscalYearStart ?? undefined,
      treasuryFunctionsPresent:     r?.treasuryFunctionsPresent ?? undefined,
      cashHandlingInvolved:         r?.cashHandlingInvolved ?? undefined,

      // ---- Risk & Audit ----------------------------------------------
      riskRating:            r?.riskRating ?? undefined,
      riskOwner:             r?.riskOwner ? this.lookupRiskOwnerLabel(r.riskOwner) : undefined,
      lastAuditDate:         r?.lastAuditDate ?? undefined,
      nextPlannedAuditCycle: r?.nextPlannedAuditCycle ? this.lookupAuditCycleLabel(r.nextPlannedAuditCycle) : undefined,
      residualRiskScore:     r?.residualRiskScore ?? undefined,
      riskNotes:             r?.riskNotes ?? undefined,

      primaryContact: company.primaryContact
        ? {
            name:      company.primaryContact.name,
            phone:     company.primaryContact.phone,
            avatarUrl: company.primaryContact.avatarUrl,
            role:      'Primary Contact',
          }
        : undefined,
    };
  }


  toggleBlocked(company: Company): void {
    this.companyData.toggleBlocked(company.id);
  }

  trackById = (_: number, c: Company) => c.id;

  // ---------------- Helpers ----------------

  /**
   * Maps a shared-store record (CompanyDataService) onto the lean
   * list-view model. This replaces the old module-level `MOCK_COMPANIES`
   * constant — it has to be an instance method now since the source data
   * comes from an injected service rather than a static import.
   */
  private toListCompany(c: CompanyRecord): Company {
    return {
      id: c.id,
      name: c.companyName,
      entityType: c.typeOfEntity ?? '',
      // Fall back to the seed's own `industry` (e.g. "jewelry") when the
      // richer `industrySector` profile field hasn't been filled in yet.
      industry: c.industrySector ?? c.industry ?? '',
      location: this.lookupCountryLabel(c.countryOfIncorporation ?? ''),
      primaryContact: {
        name: c.email ?? '',
        phone: c.phone ?? '',
      },
      blocked: c.blocked ?? false,
      createdAt: new Date(c.dateOfIncorporation ?? '2020-01-01'),
      orgStatus: c.orgStatus,
      submittedBy: c.submittedBy,
      submittedDate: c.submittedDate,
      dueDate: c.dueDate,
      raw: c,
    };
  }

  /**
   * Builds a shared-store record from the Add/Edit Company form payload.
   * - When adding, `existingId`/`base` are omitted: a fresh id is minted.
   * - When editing, pass the company's own id and its current raw record
   *   so `blocked` (and any other store-only state) is preserved instead
   *   of being wiped out by the profile-only edit.
   */
  private toCompanyRecord(
    form: CompanyFormModel,
    existingId?: string,
    base?: CompanyRecord,
  ): CompanyRecord {
    return {
      ...form,
      id: existingId ?? crypto.randomUUID(),
      companyName: form.companyName ?? 'Untitled company',
      blocked: base?.blocked ?? false,
    } as CompanyRecord;
  }

  private toFormModel(company: Company): CompanyFormModel {
    const r = company.raw;
    if (r) {
      // The stored source record already mirrors the form's field names —
      // pass it straight through so every tab (Regulatory, Financial,
      // Risk & Audit) re-hydrates, not just Basic Information.
      return {
        companyName: r.companyName ?? company.name,
        orgStatus: r.orgStatus,
        tradeLegalRegNumber: r.tradeLegalRegNumber,
        dateOfIncorporation: r.dateOfIncorporation ? new Date(r.dateOfIncorporation) : null,
        countryOfIncorporation: r.countryOfIncorporation,
        regionEmirate: r.regionEmirate,
        city: r.city,
        industrySector: r.industrySector,
        typeOfEntity: r.typeOfEntity,
        ownershipType: r.ownershipType,
        address: r.address,
        email: r.email,
        phone: r.phone,
        website: r.website,
        parentCompany: r.parentCompany,
        groupAffiliation: r.groupAffiliation,
        notes: r.notes,
        isRegulated: r.isRegulated,
        regIndustry: r.regIndustry,
        regulatoryLicenseNumber: r.regulatoryLicenseNumber,
        licenseExpiryDate: r.licenseExpiryDate ? new Date(r.licenseExpiryDate) : null,
        regulatoryNotes: r.regulatoryNotes,
        currencyAccount: r.currencyAccount,
        annualTurnoverBracket: r.annualTurnoverBracket,
        numberOfEmployees: r.numberOfEmployees,
        numberOfSubDivisionsLocations: r.numberOfSubDivisionsLocations,
        fiscalYearStart: r.fiscalYearStart,
        treasuryFunctionsPresent: r.treasuryFunctionsPresent,
        cashHandlingInvolved: r.cashHandlingInvolved,
        riskRating: r.riskRating,
        riskOwner: r.riskOwner,
        lastAuditDate: r.lastAuditDate ? new Date(r.lastAuditDate) : null,
        nextPlannedAuditCycle: r.nextPlannedAuditCycle,
        residualRiskScore: r.residualRiskScore,
        riskNotes: r.riskNotes,
      };
    }

    // Fallback — no source record yet, only the lean list fields are known.
    return {
      companyName: company.name,
      typeOfEntity: company.entityType,
      industrySector: company.industry,
      countryOfIncorporation: company.location,
      phone: company.primaryContact.phone,
    };
  }

  /** Resolve dropdown codes back to human labels. Keep these in sync with
   *  the option lists inside AddCompanyModalComponent. */
  private lookupCountryLabel(code: string): string {
    return COUNTRY_LABELS[code] ?? code;
  }

  private lookupRegionLabel(code: string): string {
    return REGION_LABELS[code] ?? code;
  }

  private lookupOwnershipLabel(code: string): string {
    return OWNERSHIP_LABELS[code] ?? code;
  }

  private lookupRiskOwnerLabel(code: string): string {
    return RISK_OWNER_LABELS[code] ?? code;
  }

  private lookupAuditCycleLabel(code: string): string {
    return AUDIT_CYCLE_LABELS[code] ?? code;
  }

  readonly displayConfirmation = signal(false);
  private readonly pendingCompany = signal<Company | null>(null);

  /** True label for the confirm button — "Block" or "Unblock". */
  readonly confirmationAction = computed(() =>
    this.pendingCompany()?.blocked ? 'Activate' : 'Deactivate',
  );

  readonly confirmationTarget = computed(() => this.pendingCompany());

  openConfirmation(company: Company): void {
    this.pendingCompany.set(company);
    this.displayConfirmation.set(true);
  }

  closeConfirmation(): void {
    this.displayConfirmation.set(false);
    this.pendingCompany.set(null);
  }

  /** Called when the user clicks "Yes" — toggles, then closes. */
  confirmToggleBlocked(): void {
    const c = this.pendingCompany();
    if (c) this.toggleBlocked(c);
    this.closeConfirmation();
  }

  viewOrgChart(company: Company): void {
    this.router.navigate(['/audits/organization/client-org-chart'], { queryParams: { company: company.id } });
  }

}

/* =====================================================================
 * Label maps for dropdown codes captured by the Add/Edit Company form.
 * Kept here (rather than in the global company data module) since only
 * this component's presentation layer needs them.
 * ===================================================================== */

/** Full country list — keep in sync with AddCompanyModalComponent's
 *  `countries` dropdown so codes always resolve to a proper name instead
 *  of falling back to the raw code. */
const COUNTRY_LABELS: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola',
  AR: 'Argentina', AM: 'Armenia', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan',
  BH: 'Bahrain', BD: 'Bangladesh', BY: 'Belarus', BE: 'Belgium', BT: 'Bhutan',
  BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil', BN: 'Brunei',
  BG: 'Bulgaria', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CR: 'Costa Rica', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czech Republic', DK: 'Denmark', EG: 'Egypt', EE: 'Estonia', FI: 'Finland',
  FR: 'France', GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece',
  HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland', IN: 'India', ID: 'Indonesia',
  IR: 'Iran', IQ: 'Iraq', IE: 'Ireland', IL: 'Israel', IT: 'Italy',
  JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KW: 'Kuwait',
  LB: 'Lebanon', LU: 'Luxembourg', MY: 'Malaysia', MV: 'Maldives', MX: 'Mexico',
  MA: 'Morocco', NP: 'Nepal', NL: 'Netherlands', NZ: 'New Zealand', NG: 'Nigeria',
  NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PH: 'Philippines', PL: 'Poland',
  PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia',
  SG: 'Singapore', ZA: 'South Africa', KR: 'South Korea', ES: 'Spain', LK: 'Sri Lanka',
  SE: 'Sweden', CH: 'Switzerland', TH: 'Thailand', TR: 'Turkey', UA: 'Ukraine',
  AE: 'United Arab Emirates', GB: 'United Kingdom', UK: 'United Kingdom',
  US: 'United States', VN: 'Vietnam',
};

/** Keep in sync with AddCompanyModalComponent's `regions` dropdown. */
const REGION_LABELS: Record<string, string> = {
  AUH: 'Abu Dhabi', AAN: 'Al Ain', DXB: 'Dubai', JEA: 'Jebel Ali', HTA: 'Hatta',
  SHJ: 'Sharjah', KFK: 'Khor Fakkan', KLB: 'Kalba', DBH: 'Dibba Al Hisn',
  AJM: 'Ajman', MSF: 'Masfout', MNM: 'Manama',
  RAK: 'Ras Al Khaimah', HAM: 'Al Hamra',
  FUJ: 'Fujairah', DBF: 'Dibba Al Fujairah',
  UAQ: 'Umm Al Quwain', FLJ: 'Falaj Al Mualla',
};

/** Keep in sync with AddCompanyModalComponent's `ownershipTypes` dropdown. */
const OWNERSHIP_LABELS: Record<string, string> = {
  private: 'Private',
  public: 'Public',
  government: 'Government',
  family: 'Family-Owned',
  'joint-venture': 'Joint Venture',
  foreign: 'Foreign-Owned',
};

/** Keep in sync with AddCompanyModalComponent's `riskOwners` dropdown. */
const RISK_OWNER_LABELS: Record<string, string> = {
  'audit-partner': 'Audit Partner',
  'audit-manager': 'Audit Manager',
  'risk-officer': 'Risk Officer',
  'compliance-officer': 'Compliance Officer',
  cfo: 'CFO',
};

/** Keep in sync with AddCompanyModalComponent's `auditCycles` dropdown. */
const AUDIT_CYCLE_LABELS: Record<string, string> = {
  quarterly: 'Quarterly',
  'semi-annual': 'Semi-Annual',
  annual: 'Annual',
  'bi-annual': 'Bi-Annual',
  'ad-hoc': 'Ad-hoc',
};