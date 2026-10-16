import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { Subscription } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { SelectButtonModule } from 'primeng/selectbutton';
import { blockBodyScroll } from 'primeng/dom';
import { QuestionareSection } from '@/app/features/audits/audit-execution/rfi-management/questionare-section/questionare-section.component';
import { MOCK_RFI_LIBRARY } from '@/app/features/audits/libraries/rfi-management-library/rfi-library-static-data';
import { MOCK_SCOPE_LIBRARY } from '@/app/features/audits/libraries/audit-scope-library/audit-scope-library-static-data';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import {
  rfiDivisionOptionsForCompany,
  rfiSubDivisionOptionsForDivision,
  rfiTopLevelScopeOptionsForSubDivision,
  rfiSubScopesOf,
  upsertStaticRfi,
} from '@/app/features/audits/audit-execution/rfi-management/rfi-static-data';
import { divisionHasSubDivisions } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import type { AddRfiDrawerData } from '@/app/features/audits/audit-execution/rfi-management/models/rfi-drawer.model';
import type { UploadedFileEntry } from '@/app/features/audits/audit-execution/rfi-management/models/rfi-document.model';

@Component({
  selector: 'app-add-rfi',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,
    ButtonModule,
    CardModule,
    ChipModule,
    DividerModule,
    InputTextModule,
    MessageModule,
    PanelModule,
    SelectModule,
    TagModule,
    TextareaModule,
    DatePickerModule,
    FileUploadModule,
    ToastModule,
    TooltipModule,
    DialogModule,
    SelectButtonModule,
    QuestionareSection,
    DrawIconComponent
  ],
  providers: [MessageService],
  templateUrl: './add-rfi.component.html',
  styleUrl: './add-rfi.component.scss',
})
export class AddRfi implements OnInit, OnDestroy {
  private readonly drawerRef = inject(DrawerRef);
  private readonly confirmSvc = inject(ConfirmDialogService);
  private readonly companyDataService = inject(CompanyDataService);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as AddRfiDrawerData | null;

  @ViewChild('questionareRef') questionareSection?: QuestionareSection;
  private readonly toast = inject(ToastService);

  // ── Current user — drives auditor vs client rendering ─────────────────────
  currentUser: string = this.data?.currentUser ?? 'auditor';

  // Label for tab 0
  get tab1Label(): string {
    return 'New RFI';
  }

  rfiForm!: FormGroup;
  submitted = false;
  activeTabIndex: string | number | undefined = 0;
  drawerWidth: string = '680px';
  private readonly boundOnResize = (event: MouseEvent) => this.onResize(event);
  private readonly boundOnResizeEnd = () => this.onResizeEnd();
  private subs = new Subscription();

  // ── Uploaded Files ──────────────────────────────────────────────────────────
  uploadedFiles: UploadedFileEntry[] = [];

  // ── Missing-description dialog state ──────────────────────────────────────
  showDescWarningDialog = false;
  emptyDescFileNames: string[] = [];

  readonly MAX_FILE_SIZE_MB = 50;

  readonly ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpg',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  get companyOptions() {
    return this.companyDataService.all.map(c => ({ label: c.companyName, value: c.id }));
  }

  get filteredDivisionOptions() {
    const companyId = this.rfiForm?.get('company')?.value;
    return rfiDivisionOptionsForCompany(companyId);
  }

  get filteredSubDivisionOptions() {
    const companyId = this.rfiForm?.get('company')?.value;
    const divisionId = this.rfiForm?.get('division')?.value;
    return rfiSubDivisionOptionsForDivision(companyId, divisionId);
  }

  // ── Scope Options ("fresh" mode) — top-level scopes for the selected
  // company/division/sub-division, cascading from the RFI static data. With
  // no sub-division selected, the division's own division-level scopes. ─────────
  get scopes() {
    const companyId = this.rfiForm?.get('company')?.value;
    const divisionId = this.rfiForm?.get('division')?.value;
    if (!divisionId) return [];
    const subDivisionId = this.rfiForm?.get('subDivision')?.value;
    return rfiTopLevelScopeOptionsForSubDivision(companyId, divisionId, subDivisionId);
  }

  // ── Sub Scope Options ("fresh" mode) — sub-scopes of the selected scope ──
  get subScopes() {
    const scopeId = this.rfiForm?.get('auditScope')?.value;
    return rfiSubScopesOf(scopeId).map(s => ({ label: s.scopeName, value: s.id }));
  }

  // ── Owners ────────────────────────────────────────────────────────────────
  owners = [
    { label: 'John Mathew', value: 'john-mathew' },
    { label: 'Akhil Raj', value: 'akhil-raj' },
    { label: 'Sneha Nair', value: 'sneha-nair' },
    { label: 'Fathima Noor', value: 'fathima-noor' },
  ];

  // ── Library Mode ──────────────────────────────────────────────────────────
  rfiSource: 'fresh' | 'library' = 'fresh';
  selectedLibraryRfiId: string | null = null;
  isDescriptionFromLibrary = false;
  libraryQuestions: string[] = [];

  rfiSourceOptions = [
    { label: 'Create New RFI', value: 'fresh' },
    { label: 'From RFI Library', value: 'library' },
  ];

  get libraryRfiOptions() {
    const scopeId = this.rfiForm?.get('auditScope')?.value;
    const subScopeId = this.rfiForm?.get('subScope')?.value;
    return MOCK_RFI_LIBRARY
      .filter(r => {
        if (subScopeId) return r.subScopeId === subScopeId;
        if (scopeId) return r.scopeId === scopeId;
        return true;
      })
      .map(r => ({ label: r.title, value: r.id }));
  }

  get activeScopeOptions() {
    if (this.rfiSource === 'library') {
      const deptId = this.rfiForm?.get('subDivision')?.value;
      return MOCK_SCOPE_LIBRARY
        .filter(s => s.scopeLevel === 'scope' && (deptId ? s.subDivision === deptId : true))
        .map(s => ({ label: s.title, value: s.id }));
    }
    return this.scopes;
  }

  get activeSubScopeOptions() {
    if (this.rfiSource === 'library') {
      const scopeId = this.rfiForm?.get('auditScope')?.value;
      if (!scopeId) return [];
      return MOCK_SCOPE_LIBRARY
        .filter(s => s.scopeLevel === 'subscope' && s.parentScopeId === scopeId)
        .map(s => ({ label: s.title, value: s.id }));
    }
    return this.subScopes;
  }

  // ── Cascade: company → division → sub-division → scope → rfi ─────────────────

  onCompanyChange(): void {
    this.rfiForm.patchValue({ division: null, subDivision: null });
    this.syncSubDivisionRequirement();
    this._resetScopeCascade();
  }

  onDivisionChange(): void {
    this.rfiForm.patchValue({ subDivision: null });
    this.syncSubDivisionRequirement();
    this._resetScopeCascade();
  }

  // ── Sub-Division requirement ──────────────────────────────────────────────
  // Mirrors the Add Audit Scope drawer: scopes live only under the leaf node, so
  // a division with sub-divisions (live `hasSubDivision` + at least one
  // sub-division) needs a sub-division before its scopes can be picked; a
  // division without any offers its own division-level scopes directly.

  /** The selected division has sub-divisions to pick from. */
  get selectedDivisionHasSubDivisions(): boolean {
    const v = this.rfiForm?.getRawValue();
    return !!v?.division && divisionHasSubDivisions(v.company, v.division);
  }

  /** Add-only drawer — required whenever the division has sub-divisions. */
  get isSubDivisionRequired(): boolean {
    return this.selectedDivisionHasSubDivisions;
  }

  /** Division chosen, plus a sub-division when one is required — the scope's owner is known. */
  get isScopeOwnerResolved(): boolean {
    const v = this.rfiForm?.getRawValue();
    return !!v?.division && (!!v.subDivision || !this.isSubDivisionRequired);
  }

  private syncSubDivisionRequirement(): void {
    const ctrl = this.rfiForm.get('subDivision');
    if (!ctrl) return;
    if (this.isSubDivisionRequired) {
      ctrl.setValidators(Validators.required);
    } else {
      ctrl.clearValidators();
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  onSubDivisionChange(): void {
    this._resetScopeCascade();
  }

  private _resetScopeCascade(): void {
    // The scope list depends on division/sub-division in both modes, so a
    // previously-picked scope no longer belongs to the new selection.
    this.rfiForm.patchValue({ auditScope: null, subScope: null });
    if (this.rfiSource !== 'library') return;
    this.rfiForm.patchValue({ title: '', description: '', additionalDescription: '' });
    this.selectedLibraryRfiId = null;
    this.isDescriptionFromLibrary = false;
    this.libraryQuestions = [];
  }

  onRfiSourceChange(): void {
    this.selectedLibraryRfiId = null;
    this.isDescriptionFromLibrary = false;
    this.libraryQuestions = [];
    this.rfiForm.patchValue({ company: null, division: null, subDivision: null, auditScope: null, subScope: null, title: '', description: '' });
    if (this.rfiSource === 'fresh') {
      this.rfiForm.get('title')?.setValidators([
        Validators.required, Validators.minLength(10), Validators.maxLength(500),
      ]);
      this.rfiForm.get('subScope')?.setValidators([Validators.required]);
    } else {
      this.rfiForm.get('title')?.setValidators([Validators.required]);
      this.rfiForm.get('subScope')?.clearValidators();
    }
    this.rfiForm.get('title')?.updateValueAndValidity();
    this.rfiForm.get('subScope')?.updateValueAndValidity();
    this.syncSubDivisionRequirement();
  }

  onLibraryRfiSelect(rfiId: string | null): void {
    if (!rfiId) {
      this.isDescriptionFromLibrary = false;
      this.libraryQuestions = [];
      this.rfiForm.patchValue({ title: '', description: '', additionalDescription: '' });
      return;
    }
    const item = MOCK_RFI_LIBRARY.find(r => r.id === rfiId);
    if (!item) return;
    this.rfiForm.patchValue({
      title: item.title,
      description: item.description,
      additionalDescription: '',
    });
    this.isDescriptionFromLibrary = true;
    this.libraryQuestions = [...(item.questions ?? [])];
  }

  onLibraryAuditScopeChange(): void {
    if (this.rfiSource === 'library') {
      this.selectedLibraryRfiId = null;
      this.isDescriptionFromLibrary = false;
      this.libraryQuestions = [];
      this.rfiForm.patchValue({ subScope: null, title: '', description: '', additionalDescription: '' });
    }
  }

  onLibrarySubScopeChange(): void {
    if (this.rfiSource === 'library') {
      this.selectedLibraryRfiId = null;
      this.isDescriptionFromLibrary = false;
      this.libraryQuestions = [];
      this.rfiForm.patchValue({ title: '', description: '', additionalDescription: '' });
    }
  }

  // ── Error Messages ─────────────────────────────────────────────────────────
  rfiFormErrorMessages: Record<string, Record<string, string>> = {
    company: { required: 'Company / organization is required.' },
    division: { required: 'Division is required.' },
    subDivision: { required: 'Sub-division is required — this division has sub-divisions.' },
    auditScope: { required: 'Audit scope is required.' },
    subScope: { required: 'Sub scope is required.' },
    title: {
      required: 'Title is required.',
      minlength: 'Title must be at least 10 characters.',
      maxlength: 'Title cannot exceed 500 characters.',
    },
    description: {
      required: 'Description is required.',
      minlength: 'Description must be at least 10 characters.',
      maxlength: 'Description cannot exceed 500 characters.',
    },
    dueDate: {
      required: 'Due date is required.',
      dueDateInvalid: 'Due date cannot be earlier than today.',
    },
    owner: { required: 'Owner is required.' },
    documents: { required: 'Please upload at least one document.' },
  };

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.buildForm();
  }

  // ── Scope label for questionnaire tab ──────────────────────────────────────
  get selectedScopeLabel(): string {
    const match = this.scopes.find(s => s.value === this.rfiForm.get('auditScope')?.value);
    return match?.label ?? '';
  }

  // ── Sub-scope label for questionnaire tab ──────────────────────────────────
  get selectedSubScopeLabel(): string {
    const match = this.subScopes.find(s => s.value === this.rfiForm.get('subScope')?.value);
    return match?.label ?? '';
  }

  // ── Error Message ──────────────────────────────────────────────────────────
  getErrorMessage(controlName: string): string {
    const control = this.rfiForm.get(controlName);
    if (!control || !control.errors) return '';
    const firstErrorKey = Object.keys(control.errors)[0];
    return this.rfiFormErrorMessages[controlName]?.[firstErrorKey] || 'Invalid field.';
  }

  // ── Field Validation ───────────────────────────────────────────────────────
  isFieldInvalid(name: string): boolean {
    const ctrl = this.rfiForm.get(name);
    return !!(ctrl && ctrl.invalid && (this.submitted || ctrl.touched));
  }

  // ── Form Builder ───────────────────────────────────────────────────────────
  private buildForm(): void {
    this.rfiForm = this.fb.group({
      company: [null, Validators.required],
      division: [null, Validators.required],
      // Required when the division has sub-divisions (see syncSubDivisionRequirement());
      // no sub-division ⇒ the RFI goes on one of the division's own (division-level) scopes.
      subDivision: [null],
      auditScope: [null, Validators.required],
      subScope: [null],
      title: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      additionalDescription: [''],
      dueDate: [null, [Validators.required, this.dueDateValidator]],
      owner: [null, Validators.required],
      documents: [[], Validators.required],
    });
  }

  // ── Due Date Validator ─────────────────────────────────────────────────────
  dueDateValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    const selectedDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate < today ? { dueDateInvalid: true } : null;
  }

  // ── File Upload ────────────────────────────────────────────────────────────
  onFileSelect(event: { files: File[] }): void {
    for (const file of event.files) {
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        this.messageService.add({
          severity: 'warn', summary: 'Invalid File Type',
          detail: `${file.name} is not a supported file type.`,
        });
        continue;
      }
      if (file.size > this.MAX_FILE_SIZE_MB * 1024 * 1024) {
        this.messageService.add({
          severity: 'warn', summary: 'File Too Large',
          detail: `${file.name} exceeds the 50 MB limit.`,
        });
        continue;
      }
      const alreadyAdded = this.uploadedFiles.some(
        e => e.file.name === file.name && e.file.size === file.size
      );
      if (!alreadyAdded) {
        this.uploadedFiles.push({ file, description: '' });
      }
    }
    this.syncDocumentsControl();
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    this.syncDocumentsControl();
  }

  private syncDocumentsControl(): void {
    this.rfiForm.patchValue({ documents: this.uploadedFiles.map(e => e.file) });
    this.rfiForm.get('documents')?.updateValueAndValidity();
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  resolveFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'pi pi-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'pi pi-file-word';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'pi pi-file-excel';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'pi pi-image';
    return 'pi pi-file';
  }

  // ── Tab 0 → Next ───────────────────────────────────────────────────────────
  onNextTab(): void {
    this.submitted = true;

    if (this.rfiSource === 'library' && !this.selectedLibraryRfiId) {
      this.messageService.add({
        severity: 'error', summary: 'RFI Required',
        detail: 'Please select an RFI template from the library.',
      });
      return;
    }

    this.rfiForm.markAllAsTouched();

    if (this.rfiForm.invalid) {
      this.messageService.add({
        severity: 'error', summary: 'Validation Error',
        detail: 'Please fix all highlighted fields before proceeding.',
      });
      return;
    }

    // Check uploaded file descriptions
    this.emptyDescFileNames = this.uploadedFiles
      .filter(e => !e.description.trim())
      .map(e => e.file.name);

    if (this.emptyDescFileNames.length > 0) {
      this.showDescWarningDialog = true;
      return;
    }

    this.activeTabIndex = 1;
    this.submitted = false;
  }

  // ── Add RFI from questionnaire tab ─────────────────────────────────────────
  async onAddRfi(): Promise<void> {
    const rows = this.questionareSection?.rows ?? [];
    const nonEmptyRows = rows.filter(r => r.questionText.trim());

    // Validate: every question must have a due date
    const missingDueDates = nonEmptyRows.filter(r => !r.dueDate);
    if (missingDueDates.length > 0) {
      this.messageService.add({
        severity: 'error', summary: 'Missing Due Date',
        detail: `${missingDueDates.length} question(s) are missing a due date. Please add due dates before submitting.`,
      });
      return;
    }

    // Validate: no question due date should exceed the RFI due date
    const rfiDueDate = this.rfiForm.get('dueDate')?.value;
    if (rfiDueDate && nonEmptyRows.length > 0) {
      const rfiDate = new Date(rfiDueDate);
      rfiDate.setHours(0, 0, 0, 0);
      const laterRows = nonEmptyRows.filter(r => {
        if (!r.dueDate) return false;
        const qDate = new Date(r.dueDate);
        qDate.setHours(0, 0, 0, 0);
        return qDate > rfiDate;
      });
      if (laterRows.length > 0) {
        this.messageService.add({
          severity: 'error', summary: 'Due Date Conflict',
          detail: 'Question due dates cannot be later than the RFI due date.',
        });
        return;
      }
    }

    // If no questions filled — confirm proceed without questionnaire
    if (nonEmptyRows.length === 0) {
      const ok = await this.confirmSvc.confirm({
        title: 'No Questionnaire',
        message: 'No questions have been added to the questionnaire. Would you like to proceed and submit the RFI without a questionnaire?',
        action: 'warning',
        confirmLabel: 'Yes, Proceed',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
    }

    this.submitForm();
  }

  proceedAnyway(): void {
    this.showDescWarningDialog = false;
    this.activeTabIndex = 1;
    this.submitted = false;
  }

  // PrimeNG's p-dialog releases the shared body scroll-lock (`p-overflow-hidden`
  // + its scrollbar-width padding compensation) whenever it finishes closing,
  // with no awareness that the drawer hosting it (`p-drawer [blockScroll]`) is
  // still open and still needs scroll blocked. That drops the page's real
  // scrollbar back in — and its padding compensation out — mid-transition,
  // which is the actual cause of the visual shake (not the tab switch itself).
  // Re-apply the lock the instant the dialog reports it's hidden.
  onDescWarningDialogHide(): void {
    blockBodyScroll();
  }

  private submitForm(): void {
    const questionnaireData = (this.questionareSection?.rows ?? []).map(r => ({
      question: r.questionText,
      answer: r.answerText,
      dueDate: r.dueDate,
    }));

    const payload = { ...this.rfiForm.value, uploadedFiles: this.uploadedFiles, questionnaire: questionnaireData };

    console.log('Add RFI Payload:', payload);

    // Persist into the shared RFI static data so it shows up immediately in
    // both rfi-management.html and rfi-management-client.html — they both
    // read from the same in-memory tree.
    this.persistNewRfi(questionnaireData);

    this.onClose();
    this.toast.success('New RFI has been added successfully.');

    this.resetForm();
  }

  /**
   * Writes a freshly-submitted RFI into the shared static data
   * (rfi-static-data.ts). In fresh mode `auditScope`/`subScope` hold real
   * scope ids (resolved via findStaticScopeById); in library mode they hold
   * Scope Library ids (`sl-*`/`ssl-*`), so `fromLibrary` makes upsertStaticRfi
   * resolve them via findStaticScopeByLibraryId instead (match by name). If a
   * library scope has no real counterpart, `upsertStaticRfi` no-ops (returns
   * undefined) rather than throwing.
   */
  private persistNewRfi(questionnaire: { question: string; answer?: string; dueDate?: Date | string | null }[]): void {
    const v = this.rfiForm.value;
    const toIso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d as string | null | undefined) ?? undefined);
    const ownerLabel = this.owners.find(o => o.value === v.owner)?.label ?? v.owner;

    const company = this.companyDataService.getById(v.company);
    upsertStaticRfi(v.company, v.division, v.subDivision || null, v.auditScope, v.subScope || null, {
      title: v.title,
      description: v.description,
      dueDate: toIso(v.dueDate)!,
      ownerValue: v.owner,
      ownerLabel,
      questionnaire: questionnaire.map(q => ({ ...q, dueDate: toIso(q.dueDate) ?? null })),
    }, company ? {
      companyName: company.companyName,
      tag: company.tag,
      color: company.color,
    } : undefined, this.rfiSource === 'library');
  }

  private resetForm(): void {
    this.submitted = false;
    this.showDescWarningDialog = false;
    this.emptyDescFileNames = [];
    this.rfiSource = 'fresh';
    this.selectedLibraryRfiId = null;
    this.isDescriptionFromLibrary = false;
    this.libraryQuestions = [];

    this.subs.unsubscribe();
    this.subs = new Subscription();

    this.buildForm();
    this.uploadedFiles = [];
  }

  onClose(): void {
    this.buildForm();
    this.drawerRef.close(null);
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    document.addEventListener('mousemove', this.boundOnResize);
    document.addEventListener('mouseup', this.boundOnResizeEnd);
  }

  private onResize(event: MouseEvent): void {
    const newWidth = window.innerWidth - event.clientX;
    if (newWidth >= 300 && newWidth <= 1200) {
      this.drawerWidth = `${newWidth}px`;
      const panel = document.querySelector('.add-rfi-drawer') as HTMLElement | null;
      if (panel) panel.style.width = this.drawerWidth;
    }
  }

  private onResizeEnd(): void {
    document.removeEventListener('mousemove', this.boundOnResize);
    document.removeEventListener('mouseup', this.boundOnResizeEnd);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    document.removeEventListener('mousemove', this.boundOnResize);
    document.removeEventListener('mouseup', this.boundOnResizeEnd);
  }
}
