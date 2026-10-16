import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';
import { firstErrorMessage } from '@/app/shared/components/services/form-validators.service';
import { ToastModule } from 'primeng/toast';

import {
  RiskType, ControlEffectiveness, RiskStatus,
  calcInherent, calcResidualScore, calcResidualLevel,
} from '../models/risk.model';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import { MessageService } from 'primeng/api';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import { ORG_STATIC_DATA } from '../../../organization/company/company-org-data';
import { ORG_STATIC_DATA_INTERNAL_AUDIT } from '../../../Org-data-internal-audit';
import { CLIENT_MODE } from '../../../../../core/config/client-mode';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// Company / Division / Sub-Division options below come from the shared
// company-org-data.ts file (the same common Company -> Division -> Sub-Division
// static data used by the Add Member modal, Members list, Companies list
// and the Risk Register filters) instead of a hardcoded CompanyDataService
// lookup + static sub-division list. Risk.company / Risk.division /
// Risk.subDivision are plain display-name strings (not ids/codes), so the
// option *values* here are the company/division/sub-division *names*
// themselves — that keeps everything a user creates here consistent with
// the Risk Register's filters, which also match on name. Adjust the
// '@/app/data/company-org-data' path if that file lives elsewhere.


export interface AddRiskDrawerData {
  mode?: 'create' | 'edit' | 'approve';
  existing?: Partial<RiskFormModel> & { id?: string };
}

export interface RiskFormModel {
  riskType:             RiskType;
  title:                string;
  description:          string;
  subDivision:          string;
  impact:               number;
  likelihood:           number;
  keyControls?:         string;
  controlEffectiveness: ControlEffectiveness;
  owner:                string;
  dateIdentified:       Date | null;
  status:               RiskStatus;
  documents?:           File[];
  company:              string;
  division:             string;
  approverNotes?:       string;
}

export interface AddRiskResult {
  mode:            'create' | 'edit' | 'approve';
  riskId?:         string;
  form:            RiskFormModel;
  approvalAction?: 'approve' | 'reject';
}

export interface Option { label: string; value: string | number; }

@Component({
  selector: 'app-add-risk',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    ButtonModule, InputTextModule, SelectModule,
    MultiSelectModule, DatePickerModule, TextareaModule, FileUploadModule,ToastModule,DrawIconComponent
  ],
  providers: [MessageService],
  templateUrl: './add-risk.component.html',
  styleUrl: './add-risk.component.scss',
})
export class AddRiskComponent implements OnInit {
  private readonly fb         = inject(FormBuilder);
  private readonly drawerRef  = inject(DrawerRef) as DrawerRef<AddRiskResult, AddRiskDrawerData>;
  private readonly drawerData = inject(DRAWER_DATA, { optional: true }) as AddRiskDrawerData | null;
  private readonly confirmSvc = inject(ConfirmDialogService);
   private readonly messageService = inject(MessageService);
   private readonly toast = inject(ToastService);
  private readonly clientMode = inject(CLIENT_MODE);

  /**
   * Active Company -> Division -> Sub-division directory — the internal-audit
   * org's own static seed when CLIENT_MODE is 'internal-audit', otherwise
   * the multi-company ORG_STATIC_DATA roster.
   */
  private readonly orgData =
    this.clientMode === 'internal-audit' ? ORG_STATIC_DATA_INTERNAL_AUDIT : ORG_STATIC_DATA;

  readonly mode      = this.drawerData?.mode ?? 'create';
  readonly isEdit    = this.mode === 'edit';
  readonly isApprove = this.mode === 'approve';

  readonly form = this.fb.group({
    riskType:             ['' as RiskType,            [Validators.required]],
    title:                ['',                         [Validators.required, Validators.maxLength(200)]],
    description:          ['',                         [Validators.required, Validators.maxLength(1000)]],
    subDivision:          ['' as string | null,        [Validators.required]],
    impact:               [null as number | null,      [Validators.required]],
    likelihood:           [null as number | null,      [Validators.required]],
    keyControls:          ['',                         [Validators.maxLength(1000)]],
    controlEffectiveness: ['' as ControlEffectiveness, [Validators.required]],
    owner:                ['',                         [Validators.required]],
    dateIdentified:       [null as Date | null,        [Validators.required]],
    status:               ['open' as RiskStatus,       [Validators.required]],
    company:              ['', [Validators.required]],
    division:             ['', [Validators.required]],
    approverNotes:        [''],   // only used in approve mode
  });

  uploadedFiles: File[] = [];

  /* Live-computed score previews */
  readonly inherentScore = signal<number | null>(null);
  readonly residualScore = signal<number | null>(null);
  readonly residualLevel = signal<'low' | 'medium' | 'high' | null>(null);

  readonly riskTypeOptions: Option[] = [
    { label: 'Strategic',    value: 'strategic'    },
    { label: 'Operational',  value: 'operational'  },
    { label: 'Financial',    value: 'financial'    },
    { label: 'Compliance',   value: 'compliance'   },
    { label: 'IT',           value: 'it'           },
    { label: 'AML / CFT',   value: 'aml_cft'       },
    { label: 'Reputational', value: 'reputational' },
    { label: 'Other',        value: 'other'        },
  ];

  readonly scaleOptions: Option[] = [1,2,3,4,5].map(n => ({ label: String(n), value: n }));

  readonly ceOptions: Option[] = [
    { label: 'Strong',   value: 'strong'   },
    { label: 'Moderate', value: 'moderate' },
    { label: 'Weak',     value: 'weak'     },
  ];

  readonly ownerOptions: Option[] = [
    { label: 'Finance Manager',    value: 'Finance Manager'    },
    { label: 'IT Manager',         value: 'IT Manager'         },
    { label: 'HR Director',        value: 'HR Director'        },
    { label: 'Compliance Officer', value: 'Compliance Officer' },
    { label: 'IT Security Lead',   value: 'IT Security Lead'   },
    { label: 'COO',                value: 'COO'                },
    { label: 'CISO',               value: 'CISO'               },
  ];

  readonly statusOptions: Option[] = [
    { label: 'Open',      value: 'open'      },
    { label: 'Monitored', value: 'monitored' },
    { label: 'Closed',    value: 'closed'    },
  ];

  /**
   * Every company in the shared org-data store, sourced from the common
   * company-org-data.ts file instead of the hardcoded placeholder list
   * this used to have ("ABC Electronics", "XYZ", ...). The option value
   * is the company *name* (Risk.company is a plain display string, not an
   * id) so it matches what the Risk Register's Company filter expects.
   */
  readonly companyOptions = computed<Option[]>(() =>
    this.orgData
      .map(c => ({ label: c.companyName, value: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /**
   * Selected Company / Division, as signals — plumbed through valueChanges
   * so divisionOptions/subDivisionOptions recompute live as the user picks a
   * company/division, instead of being static hardcoded lists.
   */
  private readonly selectedCompanyName = toSignal(
    this.form.controls.company.valueChanges.pipe(startWith(this.form.controls.company.value)),
    { initialValue: this.form.controls.company.value },
  );

  private readonly selectedDivisionName = toSignal(
    this.form.controls.division.valueChanges.pipe(startWith(this.form.controls.division.value)),
    { initialValue: this.form.controls.division.value },
  );

  /** Divisions for the selected company, sourced from the common org data file. */
  readonly divisionOptions = computed<Option[]>(() => {
    const companyName = this.selectedCompanyName();
    const company = this.orgData.find(c => c.companyName === companyName);
    if (!company) return [];
    return company.divisions
      .map(b => ({ label: b.divisionName, value: b.divisionName }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  /** Division record for the given company + division names, or undefined. */
  private findDivision(companyName: string | null, divisionName: string | null) {
    const company = this.orgData.find(c => c.companyName === companyName);
    return company?.divisions.find(d => d.divisionName === divisionName);
  }

  /**
   * False when the selected division is flagged `hasSubDivision: false` —
   * Sub-Division is then left empty (null) and not validated.
   */
  readonly divisionHasSubDivision = computed(() =>
    this.findDivision(this.selectedCompanyName(), this.selectedDivisionName())?.hasSubDivision !== false,
  );

  /** Sub-divisions for the selected company + division, sourced from the common org data file. */
  readonly subDivisionOptions = computed<Option[]>(() => {
    const division = this.findDivision(this.selectedCompanyName(), this.selectedDivisionName());
    if (!division || division.hasSubDivision === false) return [];
    return division.subDivisions
      .map(d => ({ label: d.subDivisionName, value: d.subDivisionName }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  /** Sub-Division is only required when the selected division actually has sub-divisions to pick from. */
  private readonly subDivisionValidatorEffect = effect(() => {
    const ctrl = this.form.get('subDivision');
    if (!ctrl) return;
    const required = this.divisionHasSubDivision();
    if (required !== ctrl.hasValidator(Validators.required)) {
      ctrl.setValidators(required ? [Validators.required] : []);
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  });

  ngOnInit(): void {
    const recalc = () => {
      const impact     = this.form.get('impact')!.value as number | null;
      const likelihood = this.form.get('likelihood')!.value as number | null;
      const ce         = this.form.get('controlEffectiveness')!.value as ControlEffectiveness | null;

      if (impact && likelihood) {
        const inherent = calcInherent(impact, likelihood);
        this.inherentScore.set(inherent);
        if (ce) {
          const residual = calcResidualScore(inherent, ce);
          this.residualScore.set(residual);
          this.residualLevel.set(calcResidualLevel(residual));
        } else {
          this.residualScore.set(null);
          this.residualLevel.set(null);
        }
      } else {
        this.inherentScore.set(null);
        this.residualScore.set(null);
        this.residualLevel.set(null);
      }
    };

    this.form.get('impact')!.valueChanges.subscribe(recalc);
    this.form.get('likelihood')!.valueChanges.subscribe(recalc);
    this.form.get('controlEffectiveness')!.valueChanges.subscribe(recalc);

    if (this.drawerData?.existing) {
      this.form.patchValue(this.drawerData.existing as any);
      recalc();
    }

    // Changing the company invalidates the previously selected division and
    // sub-division; changing the division (within the same company)
    // invalidates just the sub-division. Registered *after* the seed
    // hydration above so pre-filling company/division/sub-division together
    // (edit/approve mode) doesn't get wiped out by these resets.
    this.form.get('company')!.valueChanges.subscribe(() => {
      this.form.patchValue({ division: '', subDivision: '' }, { emitEvent: false });
    });
    this.form.get('division')!.valueChanges.subscribe(divisionName => {
      // Divisions flagged hasSubDivision: false have no Sub-Division — store null.
      const hasSubDivision = this.findDivision(this.form.controls.company.value, divisionName)?.hasSubDivision !== false;
      this.form.patchValue({ subDivision: hasSubDivision ? '' : null }, { emitEvent: false });
    });
  }

  /* ── Approve / Reject ─────────────────────────────────────────── */
  async onApprove(): Promise<void> {
    const confirmed = await this.confirmSvc.confirm({
      title:        'Confirm Approval',
      message:      'Are you sure you want to approve this risk? This action cannot be undone.',
      action:       'approve',
      confirmLabel: 'Yes, Approve',
    });
    if (!confirmed) return;
    this.drawerRef.close({
      mode:           'approve',
      riskId:         this.drawerData?.existing?.id,
      form:           this.form.getRawValue() as unknown as RiskFormModel,
      approvalAction: 'approve',
    })
    this.toast.success('Risk has been successfully approved.','Risk Approved');
    //  this.messageService.add({
    //   severity: 'success',
    //   summary: 'Risk Approved',
    //   detail: 'Risk has been successfully approved.',
    // });
    // setTimeout(() =>this.drawerRef.close({
    //   mode:           'approve',
    //   riskId:         this.drawerData?.existing?.id,
    //   form:           this.form.getRawValue() as unknown as RiskFormModel,
    //   approvalAction: 'approve',
    // }),1500);
  }

  async onReject(): Promise<void> {
    const notes = this.form.get('approverNotes')!;
    notes.setValidators([Validators.required, Validators.minLength(1)]);
    notes.updateValueAndValidity();
    notes.markAsTouched();
    if (!notes.value?.trim()) return;   // show inline error, stop

    const confirmed = await this.confirmSvc.confirm({
      title:        'Confirm Rejection',
      message:      'Are you sure you want to reject this risk? The submitter will be notified.',
      action:       'reject',
      confirmLabel: 'Yes, Reject',
    });
    if (!confirmed) return;
    this.drawerRef.close({
      mode:           'approve',
      riskId:         this.drawerData?.existing?.id,
      form:           this.form.getRawValue() as unknown as RiskFormModel,
      approvalAction: 'reject',
    });
    this.toast.error('Risk has been  rejected.','Risk Rejected');
    // this.messageService.add({
    //   severity: 'error',
    //   summary: 'Risk Rejected',
    //   detail: 'Risk has been  rejected.',
    // });
    // setTimeout(() =>
    // this.drawerRef.close({
    //   mode:           'approve',
    //   riskId:         this.drawerData?.existing?.id,
    //   form:           this.form.getRawValue() as unknown as RiskFormModel,
    //   approvalAction: 'reject',
    // }),1500);
  }

  /* ── File upload ──────────────────────────────────────────────── */
  onFilesSelected(event: FileSelectEvent): void {
    const incoming = Array.from(event.files as FileList | File[]);
    const existing = new Set(this.uploadedFiles.map(f => `${f.name}_${f.size}`));
    this.uploadedFiles = [...this.uploadedFiles, ...incoming.filter(f => !existing.has(`${f.name}_${f.size}`))];
  }
  removeFile(i: number): void { this.uploadedFiles.splice(i, 1); }
  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
  }
  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pi-file-pdf';
    if (['doc','docx'].includes(ext!)) return 'pi-file-word';
    if (['xls','xlsx'].includes(ext!)) return 'pi-file-excel';
    return 'pi-file';
  }

  /* ── Create / Edit ────────────────────────────────────────────── */
  isInvalid(p: string): boolean { const c = this.form.get(p); return !!c && c.touched && c.invalid; }
  getError(p: string, f?: string): string | null {
    const c = this.form.get(p);
    if (!c || !c.touched) return null;
    return firstErrorMessage(c.errors, f);
  }

  onCancel(): void { this.drawerRef.close(null); }
  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const result: AddRiskResult = {
      mode:   this.mode as 'create' | 'edit',
      riskId: this.drawerData?.existing?.id,
      form:   { ...(this.form.value as RiskFormModel), documents: this.uploadedFiles },
    };
    this.drawerRef.close(result)
    var msg= this.isEdit
        ? 'Risk details have been successfully updated.'
        : 'New risk has been successfully added.';
    this.toast.success(msg);
    // this.messageService.add({
    //   severity: 'success',
    //   summary: this.isEdit ? 'Risk Updated' : 'Risk Created',
    //   detail: this.isEdit
    //     ? 'Risk details have been successfully updated.'
    //     : 'New risk has been successfully added to the register.',
    // });

   // setTimeout(() => this.drawerRef.close(result), 1200);

  }

  /* ── Labels ───────────────────────────────────────────────────── */
  get headerTitle() {
    if (this.isApprove) return 'Review Risk';
    return this.isEdit ? 'Edit Risk' : 'Add Risk';
  }
  get headerSubtitle() {
    if (this.isApprove) return 'Edit risk details, add your notes and approve or reject';
    return this.isEdit ? 'Update risk details and recalculate scores' : 'Create a new risk record in the register';
  }
  get submitLabel() { return this.isEdit ? 'Save Changes' : 'ADD RISK'; }
}

export type { RiskStatus };