import {
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import type {
  ScopeLibraryItem,
  RiskCategory,
  Framework,
  ScopeLevel,
  ScopeLibraryStatus,
} from '@/app/features/audits/libraries/audit-scope-library/models/scope-library.model';
import type { AddScopeLibraryDrawerData, AddScopeLibraryDrawerResult } from '@/app/features/audits/libraries/audit-scope-library/models/scope-library-drawer.model';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import {
  scopeLibraryDivisionOptionsForCompany,
  scopeLibrarySubDivisionOptionsForDivision,
} from '@/app/features/audits/libraries/audit-scope-library/audit-scope-library-static-data';
import { divisionHasSubDivisions } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-add-scope-library',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    DividerModule,
    ToastModule,
    DrawIconComponent,
  ],
  providers: [MessageService],
  templateUrl: './add-scope-library.component.html',
  styleUrl: './add-scope-library.component.scss',
})
export class AddScopeLibraryComponent implements OnInit {
  private readonly drawerRef = inject(DrawerRef) as DrawerRef<AddScopeLibraryDrawerResult, AddScopeLibraryDrawerData>;
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as AddScopeLibraryDrawerData | null;
  private readonly confirmSvc = inject(ConfirmDialogService);
  private readonly companyDataService = inject(CompanyDataService);
  private readonly messageService = inject(MessageService);
  private readonly toast = inject(ToastService);

  readonly mode: 'add' | 'edit' = this.data?.mode ?? 'add';
  readonly approvalMode: boolean = this.data?.approvalMode ?? false;
  readonly requestStatus: string = this.data?.requestStatus ?? 'pending_review';
  readonly canDecide: boolean = this.approvalMode && this.requestStatus === 'pending_review';
  scopeItem: ScopeLibraryItem | null = this.data?.scopeItem ?? null;
  allScopes: ScopeLibraryItem[] = this.data?.allScopes ?? [];

  /* ── Reactive form ─── */
  form = new FormGroup({
    company: new FormControl<string | null>(null, [Validators.required]),
    division: new FormControl<string | null>(null, [Validators.required]),
    // Required (add mode) when the division has sub-divisions; empty means the
    // item sits directly under the division. See syncSubDivisionRequirement().
    subDivision: new FormControl<string | null>(null),
    title: new FormControl('', [Validators.required]),
    objective: new FormControl('', [Validators.required]),
    scopeLevel: new FormControl<ScopeLevel>('scope', [Validators.required]),
    parentScopeId: new FormControl(''),
    selectedSubScopeIds: new FormControl<string[]>([]),
    riskCategory: new FormControl<RiskCategory | null>(null, [Validators.required]),
    applicableFrameworks: new FormControl<Framework[]>([], [Validators.required]),
    approverNotes: new FormControl(''),
  });

  submitted = false;
  approvalNotesSubmitted = false;

  /* ── Company / Division / Sub-Division options — sourced from
   * audit-scope-library-static-data.ts so this drawer's cascade matches the
   * real companies/divisions/sub-divisions used across the app. ─── */
  get companyOptions() {
    const currentId = this.form.get('company')?.value;
    return this.companyDataService.all
      .filter(c => !c.blocked || c.id === currentId)
      .map(c => ({ label: c.companyName, value: c.id }));
  }

  get filteredDivisionOptions() {
    const companyId = this.form.get('company')?.value;
    return scopeLibraryDivisionOptionsForCompany(companyId, {
      companyBlocked: companyId ? this.companyDataService.isCompanyBlocked(companyId) : false,
      includeDivisionCode: this.form.get('division')?.value,
    });
  }

  get filteredSubDivisionOptions() {
    return scopeLibrarySubDivisionOptionsForDivision(this.form.get('company')?.value, this.form.get('division')?.value, {
      includeSubDivisionName: this.form.get('subDivision')?.value,
    });
  }

  onCompanyChange(): void {
    this.form.patchValue({ division: null, subDivision: null, parentScopeId: '', selectedSubScopeIds: [] });
    this.syncSubDivisionRequirement();
  }

  onDivisionChange(): void {
    this.form.patchValue({ subDivision: null, parentScopeId: '', selectedSubScopeIds: [] });
    this.syncSubDivisionRequirement();
  }

  onSubDivisionChange(): void {
    // Parent / sub-scope links belong to the old owner — clear them.
    this.form.patchValue({ parentScopeId: '', selectedSubScopeIds: [] });
  }

  /* ── Sub-Division requirement ───────────────────────────────────────────
   * Mirrors the Add Audit Scope drawer: items live only under the leaf node —
   * a division with sub-divisions (live `hasSubDivision` + at least one
   * sub-division) takes them under a sub-division; a division without any
   * takes them directly. Enforced in add mode only — existing items keep
   * their placement on edit. ─── */

  /** The selected division has sub-divisions to pick from. */
  get selectedDivisionHasSubDivisions(): boolean {
    const v = this.form.getRawValue();
    return !!v.division && divisionHasSubDivisions(v.company, v.division);
  }

  get isSubDivisionRequired(): boolean {
    return this.mode === 'add' && this.selectedDivisionHasSubDivisions;
  }

  /** Division chosen, plus a sub-division when one is required — the item's owner is known. */
  get isScopeOwnerResolved(): boolean {
    const v = this.form.getRawValue();
    return !!v.division && (!!v.subDivision || !this.isSubDivisionRequired);
  }

  private syncSubDivisionRequirement(): void {
    const ctrl = this.form.get('subDivision')!;
    if (this.isSubDivisionRequired) {
      ctrl.setValidators(Validators.required);
    } else {
      ctrl.clearValidators();
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /** Library item belongs to the same company / division / sub-division (or division level) as this form. */
  private isSameOwner(s: ScopeLibraryItem): boolean {
    const v = this.form.getRawValue();
    return s.company === v.company && s.division === v.division && (s.subDivision || '') === (v.subDivision || '');
  }

  /* ── Options ─── */
  readonly riskCategoryOptions: { label: string; value: RiskCategory }[] = [
    { label: 'Access Management', value: 'Access Management' },
    { label: 'Change Management', value: 'Change Management' },
    { label: 'Vendor Risk', value: 'Vendor Risk' },
    { label: 'Financial Risk', value: 'Financial Risk' },
    { label: 'Operational Risk', value: 'Operational Risk' },
    { label: 'Compliance Risk', value: 'Compliance Risk' },
    { label: 'IT General Controls', value: 'IT General Controls' },
    { label: 'Data Privacy', value: 'Data Privacy' },
    { label: 'Business Continuity', value: 'Business Continuity' },
    { label: 'Fraud Risk', value: 'Fraud Risk' },
  ];

  readonly frameworkOptions: { label: string; value: Framework }[] = [
    { label: 'COBIT', value: 'COBIT' },
    { label: 'ISO 27001', value: 'ISO 27001' },
    { label: 'NIST', value: 'NIST' },
    { label: 'COSO', value: 'COSO' },
    { label: 'SOX', value: 'SOX' },
    { label: 'PCI DSS', value: 'PCI DSS' },
  ];

  readonly scopeLevelOptions: { label: string; value: ScopeLevel }[] = [
    { label: 'Scope', value: 'scope' },
    { label: 'Sub Scope', value: 'subscope' },
  ];

  /* ── Dynamic option getters ─── */
  // Both pickers are limited to library items under the same owner (division or
  // sub-division) as this item; already-linked ids stay listed so an edit
  // doesn't silently drop them.
  get parentScopeOptions(): { label: string; value: string }[] {
    const editId = this.scopeItem?.id;
    const currentId = this.form.get('parentScopeId')?.value;
    return this.allScopes
      .filter(s => s.scopeLevel === 'scope' && s.id !== editId && (this.isSameOwner(s) || s.id === currentId))
      .map(s => ({ label: s.title, value: s.id }));
  }

  get subScopeOptions(): { label: string; value: string }[] {
    const editId = this.scopeItem?.id;
    const linkedIds = this.form.get('selectedSubScopeIds')?.value ?? [];
    return this.allScopes
      .filter(s => s.scopeLevel === 'subscope' && s.id !== editId && (this.isSameOwner(s) || linkedIds.includes(s.id)))
      .map(s => ({ label: s.title, value: s.id }));
  }

  get drawerTitle(): string {
    return this.mode === 'edit' ? 'Edit Scope Library' : 'Add Scope Library';
  }

  get scopeLevel(): ScopeLevel {
    return this.form.get('scopeLevel')!.value as ScopeLevel;
  }

  /* ── Validation helpers ─── */
  isInvalid(field: string): boolean {
    if (!this.submitted) return false;
    const ctrl = this.form.get(field);
    if (!ctrl) return false;
    if (field === 'parentScopeId') {
      return this.scopeLevel === 'subscope' && !ctrl.value;
    }
    if (field === 'applicableFrameworks') {
      return !(ctrl.value as Framework[])?.length;
    }
    return ctrl.invalid;
  }

  isInvalidApproverNotes(): boolean {
    if (!this.approvalNotesSubmitted) return false;
    return !this.form.get('approverNotes')?.value?.trim();
  }

  /* ── Lifecycle ─── */
  ngOnInit(): void {
    if (this.mode === 'edit' && this.scopeItem) {
      this.populateForm();
    } else {
      this.resetForm();
    }
  }

  /* ── Field handlers ─── */
  onScopeLevelChange(): void {
    this.form.patchValue({ parentScopeId: '', selectedSubScopeIds: [] });
  }

  /* ── Approval actions ─── */
  async onApprove(): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Confirm Approval',
      message: 'Are you sure you want to approve this library item?',
      action: 'approve',
      confirmLabel: 'Yes, Approve',
    });
    if (ok) {
      this.messageService.add({
        severity: 'success',
        summary: 'Scope Item Approved',
        detail: 'The scope library item has been approved successfully.',
      });
      const result: AddScopeLibraryDrawerResult = {
        approval: { action: 'approve', notes: this.form.get('approverNotes')!.value ?? '' },
      };
      setTimeout(() => this.drawerRef.close(result), 1200);
    }
  }

  async onReject(): Promise<void> {
    this.approvalNotesSubmitted = true;
    const notes = this.form.get('approverNotes')!.value?.trim() ?? '';
    if (!notes) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Confirm Rejection',
      message: 'Are you sure you want to reject this library item?',
      action: 'reject',
      confirmLabel: 'Yes, Reject',
    });
    if (ok) {
      this.messageService.add({
        severity: 'success',
        summary: 'Scope Item Rejected',
        detail: 'The scope library item has been rejected and the submitter notified.',
      });
      const result: AddScopeLibraryDrawerResult = {
        approval: { action: 'reject', notes },
      };
      setTimeout(() => this.drawerRef.close(result), 1200);
    }
  }

  /* ── Submit / cancel ─── */
  onSubmit(): void {
    this.submitted = true;
    const v = this.form.value;

    if (!v.company || !v.division || (this.isSubDivisionRequired && !v.subDivision) || !v.title?.trim() || !v.objective?.trim() || !v.riskCategory || !v.applicableFrameworks?.length) return;
    if (this.scopeLevel === 'subscope' && !v.parentScopeId) return;

    const parent = this.allScopes.find(s => s.id === v.parentScopeId);
    const subScopeRefs = (v.selectedSubScopeIds ?? [])
      .map(id => this.allScopes.find(s => s.id === id))
      .filter((s): s is ScopeLibraryItem => s != null)
      .map(s => ({ id: s.id, title: s.title }));

    // Status is not user-editable from this form: new items start pending_review,
    // and edits (including edits opened from the approval/review flow) preserve
    // whatever status the item already had — status transitions happen via the
    // separate approve/reject review flow, not here.
    const status: ScopeLibraryStatus = this.mode === 'edit'
      ? (this.scopeItem?.status ?? 'pending_review')
      : 'pending_review';

    const item: ScopeLibraryItem = {
      id: this.scopeItem?.id ?? `sl-new-${v.title!.trim().replace(/\s+/g, '-').toLowerCase()}`,
      company: v.company!,
      division: v.division!,
      // '' = division-level item (the division has no sub-divisions).
      subDivision: v.subDivision || '',
      title: v.title!.trim(),
      objective: v.objective!.trim(),
      scopeLevel: this.scopeLevel,
      riskCategory: v.riskCategory as RiskCategory,
      applicableFrameworks: [...(v.applicableFrameworks as Framework[])],
      status,
      createdAt: this.scopeItem?.createdAt ?? new Date().toISOString(),
      ...(this.scopeLevel === 'subscope' && v.parentScopeId
        ? { parentScopeId: v.parentScopeId, parentScopeTitle: parent?.title }
        : {}),
      ...(this.scopeLevel === 'scope' && subScopeRefs.length
        ? { subScopes: subScopeRefs }
        : {}),
    };

    // this.messageService.add({
    //   severity: 'success',
    //   summary: this.mode === 'edit' ? 'Scope Item Updated' : 'Scope Item Added',
    //   detail: this.mode === 'edit'
    //     ? 'Scope library item has been successfully updated.'
    //     : 'New scope library item has been successfully added.',
    // });
     this.drawerRef.close({ saved: item });
     var msg=this.mode === 'edit'
        ? 'Scope library item has been successfully updated.'
        : 'New scope library item has been successfully added.';

    this.toast.success(msg);
    
  }

  onCancel(): void {
    this.close();
  }

  private close(): void {
    this.submitted = false;
    this.drawerRef.close(null);
  }

  private populateForm(): void {
    const s = this.scopeItem!;
    this.form.patchValue({
      company: s.company,
      division: s.division,
      subDivision: s.subDivision,
      title: s.title,
      objective: s.objective,
      scopeLevel: s.scopeLevel,
      parentScopeId: s.parentScopeId ?? '',
      selectedSubScopeIds: s.subScopes?.map(sub => sub.id) ?? [],
      riskCategory: s.riskCategory,
      applicableFrameworks: [...s.applicableFrameworks],
    });
  }

  private resetForm(): void {
    this.form.reset({
      company: null,
      division: null,
      subDivision: null,
      title: '',
      objective: '',
      scopeLevel: 'scope',
      parentScopeId: '',
      selectedSubScopeIds: [],
      riskCategory: null,
      applicableFrameworks: [],
    });
    this.submitted = false;
  }
}