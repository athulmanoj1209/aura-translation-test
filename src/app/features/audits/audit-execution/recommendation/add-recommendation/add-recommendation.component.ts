import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { DRAWER_DATA, DrawerRef } from '@/app/shared/components/drawer-ref';
import { firstErrorMessage } from '@/app/shared/components/services/form-validators.service';
import { RecommendationPriority, RecommendationStatus } from '../recommendation-list/recommendation-list.component';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';
import { ORG_STATIC_DATA_INTERNAL_AUDIT } from '@/app/features/audits/Org-data-internal-audit';
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// Common Company -> Division -> Sub-Division static data — the same file the
// Companies/Members pages and the Add Evidence / Add Observation / Add
// Finding drawers read from — instead of the previous id-based
// CompanyDataService lookup (for Company) plus static Dubai/Abu Dhabi/...
// division and Internal Audit/... sub-division placeholder lists (for
// Division/Sub-Division). Option *values* are the real company/division/sub-division
// *names* (matching Recommendation.company/division/subDivision, which are
// plain display-name strings, not ids/codes), and Division/Sub-Division
// cascade off whatever Company/Division is currently selected — see
// RecommendationListComponent for the matching filter-panel wiring.
//
// When CLIENT_MODE_VALUE is 'internal-audit', `orgData` below switches to
// ORG_STATIC_DATA_INTERNAL_AUDIT (the internal-audit org's own seed) so
// companyOptions/divisionOptions/subDivisionOptions follow the active mode.

export interface AddRecommendationDrawerData {
  mode?: 'create' | 'edit' | 'approve';
  existing?: Partial<RecommendationFormModel> & { id?: string };
}
export interface RecommendationFormModel {
  title:          string;
  description:    string;
  priority:       RecommendationPriority;
  status:         RecommendationStatus;
  /** The form's "Linked Finding" control is named `findingId`, not
   *  `observationId` — there is no Observation selector in this form at all.
   *  (Previously declared as `observationId`, which no control ever
   *  populated — always undefined at runtime.) */
  findingId:      string;
  assignedTo:     string;
  dueDate:        Date | null;
  approverNotes?: string;
  /** Collected by the form but not modelled above previously — added so
   *  callers can read them off `AddRecommendationResult.form` without a cast. */
  company?:       string;
  division?:      string;
  subDivision?:   string | null;
}
export interface AddRecommendationResult {
  mode:             'create' | 'edit' | 'approve';
  recommendationId?: string;
  form:             RecommendationFormModel;
  approvalAction?:  'approve' | 'reject';
}
export interface Option { label: string; value: string; }

@Component({
  selector: 'app-add-recommendation',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    ButtonModule, InputTextModule, SelectModule, DatePickerModule, TextareaModule,DrawIconComponent,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './add-recommendation.component.html',
  styleUrl: './add-recommendation.component.scss',
})
export class AddRecommendationComponent implements OnInit {
  private readonly fb         = inject(FormBuilder);
  private readonly drawerRef  = inject(DrawerRef) as DrawerRef<AddRecommendationResult, AddRecommendationDrawerData>;
  private readonly drawerData = inject(DRAWER_DATA, { optional: true }) as AddRecommendationDrawerData | null;
  private readonly confirmSvc = inject(ConfirmDialogService);
  private readonly messageService = inject(MessageService);
  private readonly toast = inject(ToastService);

  readonly mode      = this.drawerData?.mode ?? 'create';
  readonly isEdit    = this.mode === 'edit';
  readonly isApprove = this.mode === 'approve';

  /** True when this build is running for a single internal-audit
   *  organisation — the Company/Divisions/Sub-Divisions cascade below reads
   *  from the "indi-org" seed files instead of ORG_STATIC_DATA when this
   *  is true. */
  readonly isInternalAudit = CLIENT_MODE_VALUE === 'internal-audit';

  readonly form = this.fb.group({
    title:         ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description:   ['', [Validators.required, Validators.maxLength(2000)]],
    priority:      ['' as RecommendationPriority, [Validators.required]],
    status:        ['open' as RecommendationStatus, [Validators.required]],
    findingId:     ['', [Validators.required]],
    assignedTo:    ['', [Validators.required]],
    dueDate:       [null as Date | null, [Validators.required]],
    approverNotes: [''],
     company:       [''], division: [''], subDivision: [''],
  });

  readonly priorityOptions: Option[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'High',     value: 'high'     },
    { label: 'Medium',   value: 'medium'   },
    { label: 'Low',      value: 'low'      },
  ];
  readonly statusOptions: Option[] = [
    { label: 'Open',        value: 'open'        },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Implemented', value: 'implemented' },
    { label: 'Verified',    value: 'verified'    },
    { label: 'Closed',      value: 'closed'      },
  ];
  readonly findingOptions: Option[] = [
    { label: 'F-005 — Missing access controls',   value: 'F-005' },
    { label: 'F-008 — Segregation of duties gap', value: 'F-008' },
    { label: 'F-012 — Unreconciled bank entries', value: 'F-012' },
    { label: 'F-021 — Outdated HR policies',      value: 'F-021' },
    { label: 'F-034 — Outdated patch management', value: 'F-034' },
  ];
  readonly assigneeOptions: Option[] = [
    { label: 'Finance Manager',    value: 'Finance Manager'    },
    { label: 'IT Manager',         value: 'IT Manager'         },
    { label: 'IT Security Lead',   value: 'IT Security Lead'   },
    { label: 'HR Director',        value: 'HR Director'        },
    { label: 'Legal Counsel',      value: 'Legal Counsel'      },
    { label: 'Operations Lead',    value: 'Operations Lead'    },
    { label: 'Compliance Officer', value: 'Compliance Officer' },
  ];

  /** Selected Company/Division names, tracked as signals (rather than reading
   *  `form.get(...)?.value` directly) so divisionOptions/subDivisionOptions
   *  below recompute live as the user picks a Company/Division — the same
   *  toSignal pattern used in AddObservationComponent/AddFindingComponent. */
  private readonly selectedCompanyName = toSignal(
    this.form.get('company')!.valueChanges.pipe(startWith(this.form.get('company')!.value)),
    { initialValue: this.form.get('company')!.value },
  );
  private readonly selectedDivisionName = toSignal(
    this.form.get('division')!.valueChanges.pipe(startWith(this.form.get('division')!.value)),
    { initialValue: this.form.get('division')!.value },
  );

  /**
   * ORG_STATIC_DATA_INTERNAL_AUDIT (the active internal-audit org's own
   * static seed, built from sub-division-static-indi-org.data.ts) when
   * CLIENT_MODE_VALUE is 'internal-audit', otherwise the multi-company
   * ORG_STATIC_DATA roster — same CLIENT_MODE ? … : … switch
   * add-finding.component.ts's `orgData` computed already uses, so this
   * drawer's Company/Division/Sub-division options always match the active
   * client mode instead of unconditionally showing the audit-firm roster.
   */
  readonly orgData = computed(() =>
    CLIENT_MODE_VALUE === 'internal-audit' ? ORG_STATIC_DATA_INTERNAL_AUDIT : ORG_STATIC_DATA,
  );

  /**
   * Internal-audit builds: company names come from COMPANIES_SEED
   * (company-static-indi-org.data.ts) — the same seed the Companies page
   * uses for CLIENT_MODE_VALUE === 'internal-audit'.
   *
   * Audit-firm builds (the previous, unchanged behaviour): sourced from
   * company-org-data.ts — the same file the Companies page, Members list
   * Company filter, and Add Member / Add Risk / Add Evidence / Add
   * Observation / Add Finding forms read from — instead of the hardcoded
   * placeholder list this used to have ("Crowe UAE", "Crowe Oman", "Crowe
   * Saudi Arabia", "Crowe Qatar").
   */
  readonly companyOptions = computed<Option[]>(() =>
    this.orgData()
      .map(c => ({ label: c.companyName, value: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /** Narrows to the selected Company's divisions — empty until a Company is
   *  chosen, replacing the old static Dubai/Abu Dhabi/Sharjah/Al Ain list. */
  readonly divisionOptions = computed<Option[]>(() => {
    const companyName = this.selectedCompanyName();
    const company = this.orgData().find(c => c.companyName === companyName);
    return (company?.divisions ?? [])
      .map(b => ({ label: b.divisionName, value: b.divisionName }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  /** Narrows to the selected Company + Division's sub-divisions — empty
   *  until a Division is chosen, replacing the old static Internal Audit/
   *  External Audit/Regulatory/Risk Management/IT list. */
  readonly subDivisionOptions = computed<Option[]>(() => {
    const division = this.findDivision(this.selectedCompanyName(), this.selectedDivisionName());
    if (!division || division.hasSubDivision === false) return [];
    return division.subDivisions
      .map(d => ({ label: d.subDivisionName, value: d.subDivisionName }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  /** Division record for the given company + division names, or undefined. */
  private findDivision(companyName: string | null, divisionName: string | null) {
    const company = this.orgData().find(c => c.companyName === companyName);
    return company?.divisions.find(b => b.divisionName === divisionName);
  }

  /**
   * False when the selected division is flagged `hasSubDivision: false` —
   * Sub-Division is then left empty (null) and not validated.
   */
  readonly divisionHasSubDivision = computed(() =>
    this.findDivision(this.selectedCompanyName(), this.selectedDivisionName())?.hasSubDivision !== false,
  );

  /** Sub-Division is only required when the selected division actually has sub-divisions to pick from. */
  private readonly subDivisionValidatorEffect = effect(() => {
    const ctrl = this.form.get('subDivision');
    if (!ctrl) return;
    const required = this.subDivisionOptions().length > 0;
    if (required !== ctrl.hasValidator(Validators.required)) {
      ctrl.setValidators(required ? [Validators.required] : []);
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  });

  ngOnInit(): void {
    // Cascade resets: changing Company invalidates any previously selected
    // Division/Sub-Division (they belonged to the old company's org tree);
    // changing Division invalidates any previously selected Sub-Division.
    this.form.get('company')!.valueChanges.subscribe(() => {
      this.form.patchValue({ division: '', subDivision: '' }, { emitEvent: false });
    });
    this.form.get('division')!.valueChanges.subscribe(divisionName => {
      // Divisions flagged hasSubDivision: false have no Sub-Division — store null.
      const hasSubDivision = this.findDivision(this.form.get('company')!.value, divisionName)?.hasSubDivision !== false;
      this.form.get('subDivision')!.setValue(hasSubDivision ? '' : null, { emitEvent: false });
    });

    if (this.drawerData?.existing) this.form.patchValue(this.drawerData.existing as any);
  }

  /* ── Approve / Reject ─────────────────────────────────────────── */
  async onApprove(): Promise<void> {
    const confirmed = await this.confirmSvc.confirm({
      title:        'Confirm Approval',
      message:      'Are you sure you want to approve this recommendation? This action cannot be undone.',
      action:       'approve',
      confirmLabel: 'Yes, Approve',
    });
    if (!confirmed) return;
    // this.messageService.add({
    //   severity: 'success',
    //   summary: 'Recommendation Approved',
    //   detail: 'The recommendation has been approved successfully.',
    // });
    const result: AddRecommendationResult = {
      mode:             'approve',
      recommendationId: this.drawerData?.existing?.id,
      form:             this.form.getRawValue() as unknown as RecommendationFormModel,
      approvalAction:   'approve',
    };
    this.drawerRef.close(result);
    //setTimeout(() => this.drawerRef.close(result), 1200);
    this.toast.success('The recommendation has been approved successfully.','Recommendation Approved');
  }

  async onReject(): Promise<void> {
    const notes = this.form.get('approverNotes')!;
    notes.setValidators([Validators.required, Validators.minLength(1)]);
    notes.updateValueAndValidity();
    notes.markAsTouched();
    if (!notes.value?.trim()) return;

    const confirmed = await this.confirmSvc.confirm({
      title:        'Confirm Rejection',
      message:      'Are you sure you want to reject this recommendation? The submitter will be notified.',
      action:       'reject',
      confirmLabel: 'Yes, Reject',
    });
    if (!confirmed) return;
    // this.messageService.add({
    //   severity: 'success',
    //   summary: 'Recommendation Rejected',
    //   detail: 'The recommendation has been rejected and the submitter notified.',
    // });
    const result: AddRecommendationResult = {
      mode:             'approve',
      recommendationId: this.drawerData?.existing?.id,
      form:             this.form.getRawValue() as unknown as RecommendationFormModel,
      approvalAction:   'reject',
    };
    this.drawerRef.close(result);
   // setTimeout(() => this.drawerRef.close(result), 1200);
    this.toast.error('The recommendation has been rejected and the submitter notified.','Recommendation Rejected');
  }

  /* ── Create / Edit ────────────────────────────────────────────── */
  isInvalid(path: string): boolean {
    const c = this.form.get(path); return !!c && c.touched && c.invalid;
  }
  getError(path: string, field?: string): string | null {
    const c = this.form.get(path); if (!c || !c.touched) return null;
    return firstErrorMessage(c.errors, field);
  }

  onCancel(): void { this.drawerRef.close(null); }
  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.messageService.add({
      severity: 'success',
      summary: this.isEdit ? 'Recommendation Updated' : 'Recommendation Created',
      detail: this.isEdit
        ? 'Recommendation details have been successfully updated.'
        : 'New recommendation has been successfully added.',
    });
    const result: AddRecommendationResult = {
      mode: this.mode as 'create' | 'edit',
      recommendationId: this.drawerData?.existing?.id,
      form: this.form.value as unknown as RecommendationFormModel,
    };
    this.drawerRef.close(result);
    var msg=this.isEdit
        ? 'Recommendation details have been successfully updated.'
        : 'New recommendation has been successfully added.';
    //setTimeout(() => this.drawerRef.close(result), 1200);
     this.toast.success(msg);
  }

  /* ── Labels ───────────────────────────────────────────────────── */
  get headerTitle()    { return this.isApprove ? 'Review Recommendation' : this.isEdit ? 'Edit Recommendation'    : 'Add Recommendation'; }
  get headerSubtitle() { return this.isApprove ? 'Edit recommendation details, add your notes and approve or reject' : this.isEdit ? 'Update recommendation details' : 'Define a remediation action for an audit observation'; }
  get submitLabel()    { return this.isEdit ? 'Save Changes' : 'ADD RECOMMENDATION'; }

}