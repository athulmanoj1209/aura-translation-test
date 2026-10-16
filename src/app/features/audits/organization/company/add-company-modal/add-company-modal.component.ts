import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// PrimeNG modules (v18+)
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { DrawerRef, DRAWER_DATA } from '../../../../../shared/components/drawer-ref';
import {
  firstErrorMessage,
  futureDateValidator,
  integerValidator,
  notFutureDateValidator,
  phoneValidator,
  urlValidator,textValidator
} from '@/app/shared/components/services/form-validators.service';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { OrgStatus } from '@/app/features/audits/organization/company/models/company.model';
import { ORG_STATUS_OPTIONS } from '@/app/features/audits/organization/company/company-static-data';

/**
 * Form payload exchanged with the opener.
 * Flat shape — internally we group by tab in the reactive form,
 * then flatten before emitting on close.
 */
export interface CompanyFormModel {
  // --- Basic Information --------------------------------------------------
  companyName?: string | null;
  tradeLegalRegNumber?: string | null;
  dateOfIncorporation?: Date | null;
  countryOfIncorporation?: string | null;
  regionEmirate?: string | null;
  city?: string | null;
  industrySector?: string | null;
  typeOfEntity?: string | null;
  ownershipType?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  parentCompany?: string | null;
  groupAffiliation?: string | null;
  notes?: string | null;
  orgStatus?: OrgStatus | null;

  // --- Regulatory ---------------------------------------------------------
  isRegulated?: boolean | null;
  regIndustry?: string | null;
  regulatoryLicenseNumber?: string | null;
  licenseExpiryDate?: Date | null;
  regulatoryNotes?: string | null;

  // --- Financial & Operational -------------------------------------------
  currencyAccount?: string | null;
  annualTurnoverBracket?: string | null;
  numberOfEmployees?: number | null;
  numberOfSubDivisionsLocations?: number | null;
  fiscalYearStart?: string | null;
  treasuryFunctionsPresent?: boolean | null;
  cashHandlingInvolved?: boolean | null;

  // --- Risk & Audit ------------------------------------------------------
  riskRating?: string | null;
  riskOwner?: string | null;
  lastAuditDate?: Date | null;
  nextPlannedAuditCycle?: string | null;
  residualRiskScore?: number | null;
  riskNotes?: string | null;

  viewType?:string | null;
  approval?: { action: 'approve' | 'reject'; notes: string };
}

export interface AddCompanyDrawerData {
  existing?: CompanyFormModel;
  type?:string | null;
  approvalMode?: boolean;
  /** Current workflow status of the request being reviewed — approve/reject controls only show when this is 'pending_review'. */
  requestStatus?: string;
}

interface Option {
  label: string;
  value: string;
}

@Component({
  selector: 'app-add-company-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TabsModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    CheckboxModule,
    ButtonModule,
    InputNumberModule,
    ToastModule,
    DrawIconComponent,
  ],
  providers: [MessageService],
  templateUrl: './add-company-modal.component.html',
  styleUrls: ['./add-company-modal.component.scss'],
})
export class AddCompanyModalComponent implements OnInit {

  private readonly drawerRef = inject(DrawerRef) as DrawerRef<CompanyFormModel, AddCompanyDrawerData>;
  private readonly drawerData = inject(DRAWER_DATA, { optional: true }) as AddCompanyDrawerData | null;
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmSvc = inject(ConfirmDialogService);
  private readonly messageService = inject(MessageService);
 private readonly toast = inject(ToastService);
  /** Currently active tab (string for PrimeNG v18 Tabs). */
  activeTabIndex: string = '0';
  readonly approvalMode: boolean = this.drawerData?.approvalMode ?? false;
  readonly requestStatus: string = this.drawerData?.requestStatus ?? 'pending_review';
  readonly canDecide: boolean = this.approvalMode && this.requestStatus === 'pending_review';
  approvalNotesSubmitted = false;
  typeOfAction=false;

  readonly orgStatusOptions = ORG_STATUS_OPTIONS;

  /**
   * Reactive form, nested by tab so each tab has its own validity.
   * We flatten on submit to match the flat CompanyFormModel API.
   */
  readonly form = this.fb.group({
    basic: this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200),textValidator]],
      tradeLegalRegNumber: ['', [Validators.required,Validators.maxLength(50)]],
      dateOfIncorporation: [null as Date | null, [Validators.required,notFutureDateValidator]],
      countryOfIncorporation: [null as string | null],
      regionEmirate: [null as string | null],
      city: ['', [Validators.maxLength(100)]],
      industrySector: [null as string | null],
      typeOfEntity: [null as string | null],
      ownershipType: [null as string | null],
      address: ['', [Validators.maxLength(255)]],
      email: ['', [Validators.email, Validators.maxLength(200)]],
      phone: ['', [phoneValidator]],
      website: ['', [urlValidator, Validators.maxLength(300)]],
      parentCompany: ['', [Validators.maxLength(200)]],
      groupAffiliation: ['', [Validators.maxLength(200)]],
      notes: ['', [Validators.maxLength(500)]],
      orgStatus: ['pending_review' as OrgStatus | null],
    }),
    regulatory: this.fb.group({
      isRegulated: [false],
      regIndustry: [null as string | null],
      regulatoryLicenseNumber: ['', [Validators.required,Validators.maxLength(100)]],
      licenseExpiryDate: [null as Date | null,[Validators.required]],
      regulatoryNotes: ['', [Validators.maxLength(1000)]],
    }),
    financial: this.fb.group({
      currencyAccount: [null as string | null, Validators.required],
      annualTurnoverBracket: [null as string | null],
      numberOfEmployees: [null as number | null, [Validators.min(0), Validators.max(1_000_000), integerValidator]],
      numberOfSubDivisionsLocations: [null as number | null, [Validators.min(0), Validators.max(100_000), integerValidator]],
      fiscalYearStart: ['', [Validators.maxLength(50)]],
      treasuryFunctionsPresent: [false],
      cashHandlingInvolved: [false],
    }),
    risk: this.fb.group({
      riskRating: [null as string | null, Validators.required],
      riskOwner: [null as string | null],
      lastAuditDate: [null as Date | null, [notFutureDateValidator]],
      nextPlannedAuditCycle: [null as string | null],
      residualRiskScore: [null as number | null, [Validators.min(0), Validators.max(10)]],
      riskNotes: ['', [Validators.maxLength(500)]],
    }),
    viewType: [''],
    approverNotes: [''],
  });

  // ---------------------------------------------------------------------
  // Dropdown options
  // ---------------------------------------------------------------------

  countries: Option[] = [
  { label: 'Afghanistan', value: 'AF' },
  { label: 'Albania', value: 'AL' },
  { label: 'Algeria', value: 'DZ' },
  { label: 'Andorra', value: 'AD' },
  { label: 'Angola', value: 'AO' },
  { label: 'Argentina', value: 'AR' },
  { label: 'Armenia', value: 'AM' },
  { label: 'Australia', value: 'AU' },
  { label: 'Austria', value: 'AT' },
  { label: 'Azerbaijan', value: 'AZ' },
  { label: 'Bahrain', value: 'BH' },
  { label: 'Bangladesh', value: 'BD' },
  { label: 'Belarus', value: 'BY' },
  { label: 'Belgium', value: 'BE' },
  { label: 'Bhutan', value: 'BT' },
  { label: 'Bolivia', value: 'BO' },
  { label: 'Bosnia and Herzegovina', value: 'BA' },
  { label: 'Botswana', value: 'BW' },
  { label: 'Brazil', value: 'BR' },
  { label: 'Brunei', value: 'BN' },
  { label: 'Bulgaria', value: 'BG' },
  { label: 'Cambodia', value: 'KH' },
  { label: 'Cameroon', value: 'CM' },
  { label: 'Canada', value: 'CA' },
  { label: 'Chile', value: 'CL' },
  { label: 'China', value: 'CN' },
  { label: 'Colombia', value: 'CO' },
  { label: 'Costa Rica', value: 'CR' },
  { label: 'Croatia', value: 'HR' },
  { label: 'Cyprus', value: 'CY' },
  { label: 'Czech Republic', value: 'CZ' },
  { label: 'Denmark', value: 'DK' },
  { label: 'Egypt', value: 'EG' },
  { label: 'Estonia', value: 'EE' },
  { label: 'Finland', value: 'FI' },
  { label: 'France', value: 'FR' },
  { label: 'Georgia', value: 'GE' },
  { label: 'Germany', value: 'DE' },
  { label: 'Ghana', value: 'GH' },
  { label: 'Greece', value: 'GR' },
  { label: 'Hong Kong', value: 'HK' },
  { label: 'Hungary', value: 'HU' },
  { label: 'Iceland', value: 'IS' },
  { label: 'India', value: 'IN' },
  { label: 'Indonesia', value: 'ID' },
  { label: 'Iran', value: 'IR' },
  { label: 'Iraq', value: 'IQ' },
  { label: 'Ireland', value: 'IE' },
  { label: 'Israel', value: 'IL' },
  { label: 'Italy', value: 'IT' },
  { label: 'Japan', value: 'JP' },
  { label: 'Jordan', value: 'JO' },
  { label: 'Kazakhstan', value: 'KZ' },
  { label: 'Kenya', value: 'KE' },
  { label: 'Kuwait', value: 'KW' },
  { label: 'Lebanon', value: 'LB' },
  { label: 'Luxembourg', value: 'LU' },
  { label: 'Malaysia', value: 'MY' },
  { label: 'Maldives', value: 'MV' },
  { label: 'Mexico', value: 'MX' },
  { label: 'Morocco', value: 'MA' },
  { label: 'Nepal', value: 'NP' },
  { label: 'Netherlands', value: 'NL' },
  { label: 'New Zealand', value: 'NZ' },
  { label: 'Nigeria', value: 'NG' },
  { label: 'Norway', value: 'NO' },
  { label: 'Oman', value: 'OM' },
  { label: 'Pakistan', value: 'PK' },
  { label: 'Philippines', value: 'PH' },
  { label: 'Poland', value: 'PL' },
  { label: 'Portugal', value: 'PT' },
  { label: 'Qatar', value: 'QA' },
  { label: 'Romania', value: 'RO' },
  { label: 'Russia', value: 'RU' },
  { label: 'Saudi Arabia', value: 'SA' },
  { label: 'Singapore', value: 'SG' },
  { label: 'South Africa', value: 'ZA' },
  { label: 'South Korea', value: 'KR' },
  { label: 'Spain', value: 'ES' },
  { label: 'Sri Lanka', value: 'LK' },
  { label: 'Sweden', value: 'SE' },
  { label: 'Switzerland', value: 'CH' },
  { label: 'Thailand', value: 'TH' },
  { label: 'Turkey', value: 'TR' },
  { label: 'Ukraine', value: 'UA' },
  { label: 'United Arab Emirates', value: 'AE' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'United States', value: 'US' },
  { label: 'Vietnam', value: 'VN' }
];

  regions: Option[] = [
  { label: 'Abu Dhabi', value: 'AUH' },
  { label: 'Al Ain', value: 'AAN' },

  { label: 'Dubai', value: 'DXB' },
  { label: 'Jebel Ali', value: 'JEA' },
  { label: 'Hatta', value: 'HTA' },

  { label: 'Sharjah', value: 'SHJ' },
  { label: 'Khor Fakkan', value: 'KFK' },
  { label: 'Kalba', value: 'KLB' },
  { label: 'Dibba Al Hisn', value: 'DBH' },

  { label: 'Ajman', value: 'AJM' },
  { label: 'Masfout', value: 'MSF' },
  { label: 'Manama', value: 'MNM' },

  { label: 'Ras Al Khaimah', value: 'RAK' },
  { label: 'Al Hamra', value: 'HAM' },

  { label: 'Fujairah', value: 'FUJ' },
  { label: 'Dibba Al Fujairah', value: 'DBF' },

  { label: 'Umm Al Quwain', value: 'UAQ' },
  { label: 'Falaj Al Mualla', value: 'FLJ' }
];

  industries: Option[] = [
    { label: 'CBUAE', value: 'CBUAE' },
    { label: 'DFSA', value: 'DFSA' },
    { label: 'ADGM', value: 'ADGM' },
    { label: 'ESCA', value: 'ESCA' },
    { label: 'MOE', value: 'MOE' },
    { label: 'Other', value: 'Other' },
      ];

  entityTypes: Option[] = [
    { label: 'LLC', value: 'LLC' },
    { label: 'Branch', value: 'Branch' },
    { label: 'Public Co.', value: 'Public Co.' },
    { label: 'Partnership', value: 'Partnership' },
    // { label: 'Branch', value: 'branch' },
    // { label: 'Free Zone Entity', value: 'free-zone' },
    // { label: 'Offshore', value: 'offshore' },
  ];

  ownershipTypes: Option[] = [
    { label: 'Private', value: 'private' },
    { label: 'Public', value: 'public' },
    { label: 'Government', value: 'government' },
    { label: 'Family-Owned', value: 'family' },
    { label: 'Joint Venture', value: 'joint-venture' },
    { label: 'Foreign-Owned', value: 'foreign' },
  ];

  currencies: Option[] = [
    { label: 'AED – UAE Dirham', value: 'AED' },
    { label: 'USD – US Dollar', value: 'USD' },
    { label: 'EUR – Euro', value: 'EUR' },
    { label: 'GBP – British Pound', value: 'GBP' },
    { label: 'SAR – Saudi Riyal', value: 'SAR' },
    { label: 'QAR – Qatari Riyal', value: 'QAR' },
    { label: 'INR – Indian Rupee', value: 'INR' },
  ];

  turnoverBrackets: Option[] = [
    { label: 'pre-set ranges', value: 'pre-set ranges' },
    { label: 'configurable', value: 'configurable' },
      ];

  riskRatings: Option[] = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' },
  ];

  riskOwners: Option[] = [
    { label: 'Audit Partner', value: 'audit-partner' },
    { label: 'Audit Manager', value: 'audit-manager' },
    { label: 'Risk Officer', value: 'risk-officer' },
    { label: 'Compliance Officer', value: 'compliance-officer' },
    { label: 'CFO', value: 'cfo' },
  ];

  auditCycles: Option[] = [
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Semi-Annual', value: 'semi-annual' },
    { label: 'Annual', value: 'annual' },
    { label: 'Bi-Annual', value: 'bi-annual' },
    { label: 'Ad-hoc', value: 'ad-hoc' },
  ];


  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  ngOnInit(): void {
    // Hydrate from existing company if the caller passed one
    if (this.drawerData?.existing) {
     var type= 'View';
      if (this.drawerData?.type)
      {
        type=this.drawerData?.type;
        console.log("type",this.drawerData?.type)
      }
      this.form.patchValue({
        basic: this.drawerData.existing,
        regulatory: this.drawerData.existing,
        financial: this.drawerData.existing,
        risk: this.drawerData.existing,
        viewType:type
      });
    
    this.typeOfAction=true;
    }
    // Conditional validation — license fields are only required when
    // the company is regulated.
    this.form.controls.regulatory.controls.isRegulated.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isRegulated => this.applyRegulatoryValidators(!!isRegulated));

    this.applyRegulatoryValidators(
      !!this.form.controls.regulatory.controls.isRegulated.value,
    );
  }

  private applyRegulatoryValidators(isRegulated: boolean): void {
    const reg = this.form.controls.regulatory;
    const licenseNum = reg.controls.regulatoryLicenseNumber;
    const expiryDate = reg.controls.licenseExpiryDate;

    if (isRegulated) {
      licenseNum.setValidators([Validators.required, Validators.maxLength(100)]);
      expiryDate.setValidators([Validators.required, futureDateValidator]);
    } else {
      licenseNum.setValidators([Validators.maxLength(100)]);
      expiryDate.setValidators([]);
    }

    licenseNum.updateValueAndValidity({ emitEvent: false });
    expiryDate.updateValueAndValidity({ emitEvent: false });
  }

  // ---------------------------------------------------------------------
  // Tab navigation
  // ---------------------------------------------------------------------
  private readonly TAB_GROUPS = ['basic', 'regulatory', 'financial', 'risk'] as const;
  private readonly TAB_COUNT = this.TAB_GROUPS.length;

  next(): void {
    const i = Number(this.activeTabIndex);
    if (i >= this.TAB_COUNT - 1) return;

    // Mark current tab's controls touched so errors show if the user
    // tries to advance with bad input.
    const current = this.form.get(this.TAB_GROUPS[i]) as FormGroup;
   console.log('next',i);
    if (current.invalid) {
       
      current.markAllAsTouched();
      return;
    }
    this.activeTabIndex = String(i + 1);
  }

  previous(): void {
    const i = Number(this.activeTabIndex);
    if (i > 0) this.activeTabIndex = String(i - 1);
  }

  /** Is the currently-shown tab valid? */
  get currentTabIsValid(): boolean {
    const groupName = this.TAB_GROUPS[Number(this.activeTabIndex)];
    return (this.form.get(groupName) as FormGroup).valid;
  }

  // ---------------------------------------------------------------------
  // Error helpers used by the template
  // ---------------------------------------------------------------------

  /** Returns the first validation error message for the control, or null. */
 getError(path: string,field : string  | undefined): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.touched) return null;
    return firstErrorMessage(ctrl.errors,field);
  }
  /** True when the control has been touched AND is currently invalid. */
  isInvalid(path: string): boolean {
    const ctrl = this.form.get(path);
   // console.log('valid',!!ctrl?.invalid);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  // ---------------------------------------------------------------------
  // Approval actions
  // ---------------------------------------------------------------------
  isInvalidApproverNotes(): boolean {
    if (!this.approvalNotesSubmitted) return false;
    return !(this.form.get('approverNotes')?.value?.trim());
  }

  async onApprove(): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Confirm Approval',
      message: 'Are you sure you want to approve this company?',
      action: 'approve',
      confirmLabel: 'Yes, Approve',
    });
    if (ok) {
      this.drawerRef.close({
        approval: { action: 'approve', notes: this.form.get('approverNotes')!.value ?? '' },
      });
       this.toast.success('Company details have been successfully approved.','Company Request Approved');
    //   this.messageService.add({
    //   severity: 'success',
    //   summary: 'Company Request Approved',
    //   detail:
    //    'Company details have been successfully approved.'
       
    // });
    //setTimeout(() => this.drawerRef.close(result), 1500);
    //  setTimeout(() => this.drawerRef.close({
    //     approval: { action: 'approve', notes: this.form.get('approverNotes')!.value ?? '' },
    //   }),1500);
    }
  }

  async onReject(): Promise<void> {
    this.approvalNotesSubmitted = true;
    const notes = (this.form.get('approverNotes')!.value ?? '').trim();
    if (!notes) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Confirm Rejection',
      message: 'Are you sure you want to reject this company?',
      action: 'reject',
      confirmLabel: 'Yes, Reject',
    });
    if (ok) {
      this.drawerRef.close({ approval: { action: 'reject', notes } })
       this.toast.error('Company details have been rejected.','Company Request Rejected');
    //    this.messageService.add({
    //   severity: 'error',
    //   summary: 'Company Request Rejected',
    //   detail:
    //    'Company details have been rejected.'
       
    // });
    //   setTimeout(() =>this.drawerRef.close({ approval: { action: 'reject', notes } }),1500);
    }
  }

  // ---------------------------------------------------------------------
  // Submit / cancel
  // ---------------------------------------------------------------------
  onCancel(): void {
    this.drawerRef.close(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Jump to the first tab that has an error.
      const firstBadIdx = this.TAB_GROUPS.findIndex(
        g => (this.form.get(g) as FormGroup).invalid,
      );
      if (firstBadIdx >= 0) this.activeTabIndex = String(firstBadIdx);
      return;
    }

    const v = this.form.getRawValue();
    const result: CompanyFormModel = {
      ...v.basic,
      ...v.regulatory,
      ...v.financial,
      ...v.risk,
    };

    const isEdit = !!this.form.get('viewType')?.value;
    this.typeOfAction=isEdit;
    this.drawerRef.close(result);
    //setTimeout(() => this.drawerRef.close(result), 1500);
    var msg="";
    msg=isEdit
            ? 'Company details have been successfully updated.'
            : 'New company has been successfully added.';
    this.toast.success(msg);

    // this.messageService.add({
    //   severity: 'success',
    //   summary: isEdit ? 'Company Updated' : 'Company Created',
    //   detail: isEdit
    //     ? 'Company details have been successfully updated.'
    //     : 'New company has been successfully added.',
    // });

  }
 
 get headerTitle(): string {
  if (this.approvalMode) return 'Review Company';
  return this.typeOfAction ? 'Edit Company' : 'Add Company';
}
}