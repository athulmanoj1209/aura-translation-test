import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { environment } from '@/app/environments/environment';
import { REPORT_TEMPLATE_STATIC_COMPANIES, REPORT_COMPANY_LOOKUP } from '@/app/features/audits/audit-report/report-templates/report-templates-static-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { DIVISION_STATIC_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-data';

// Kept local to this dialog rather than pulled from the Industry Type master
// list (which is admin-managed CRUD data for a different screen) - the
// backend just wants a plain string, so a fixed, self-contained option list
// is enough here.
const INDUSTRY_TYPE_OPTIONS = [
  'Banking',
  'Financial Services',
  'Professional Services',
  'Insurance',
  'Healthcare',
  'Manufacturing',
  'Retail & E-Commerce',
  'Information Technology',
  'Real Estate',
  'Energy & Utilities',
  'Telecommunications',
  'Construction',
  'Trade',
  'Hospitality',
  'Education',
  'Government',
  'Other',
];

// report-templates.ts's mock REPORT_TEMPLATES store industryType as a lowercase
// snake_case code (e.g. 'professional_services'), not one of the labels above -
// without this lookup, editing an existing template leaves the Industry Type
// select blank because the raw code never matches an option string.
const INDUSTRY_TYPE_CODE_TO_LABEL: Record<string, string> = {
  banking: 'Banking',
  professional_services: 'Professional Services',
  insurance: 'Insurance',
  healthcare: 'Healthcare',
  manufacturing: 'Manufacturing',
  retail: 'Retail & E-Commerce',
  technology: 'Information Technology',
  real_estate: 'Real Estate',
  energy: 'Energy & Utilities',
  telecommunications: 'Telecommunications',
  construction: 'Construction',
  trade: 'Trade',
  hospitality: 'Hospitality',
  education: 'Education',
  government: 'Government',
};

function normalizeIndustryType(value: string | null | undefined): string {
  if (!value) return '';
  return INDUSTRY_TYPE_CODE_TO_LABEL[value] ?? value;
}

export interface CompanyOption {
  label: string;
  value: string;
}

export interface DivisionOption {
  label: string;
  value: string;
  industryType: string;
}

// Structurally compatible with report-templates.ts's ReportTemplate - kept
// as its own type here so this shared dialog doesn't import from an apps/
// feature module. isUsed gates whether the template file can be replaced
// in edit mode (see attemptUnlockFile()/saveChanges() below).
export interface EditReportTemplateData {
  id: string;
  /** Backend-issued numeric id from POST /Audit/upload-template - null for a
   *  template that was never actually uploaded (kept as-is through edit mode),
   *  set from the SSE "Completed" notification's templateId in
   *  emitCreatedTemplate() below for a freshly created one. */
  templateId: number | null;
  companyId: string;
  divisionName: string;
  divisionCode: string;
  templateName: string;
  templateDescription: string;
  industryType: string;
  templateFileName: string;
  status: 'active' | 'inactive';
  isUsed: boolean;
}

// Real company/division roster from report-templates-static-data.ts (itself an
// independently-authored copy of divisions/division-static-data.ts) - drives
// both the Company/Division selects and the Industry Type auto-selection.
// Companies/divisions that don't have this yet (e.g. newly created via the
// Organization module) are unioned in from the canonical sources at render
// time in the component below (see companyOptions/divisionOptions getters) so
// they're selectable too, just without an Industry Type to auto-fill.
const LOCAL_COMPANY_OPTIONS: CompanyOption[] = REPORT_COMPANY_LOOKUP.map(c => ({ label: c.label, value: c.id }));

const LOCAL_DIVISION_OPTIONS_BY_COMPANY: Record<string, DivisionOption[]> = Object.fromEntries(
  REPORT_TEMPLATE_STATIC_COMPANIES.map(co => [
    co.id,
    co.divisions.map(b => ({
      label: b.divisionName,
      value: b.divisionCode,
      industryType: normalizeIndustryType(b.industryType),
    })),
  ]),
);

// Shape of the 202 body returned by POST /Audit/upload-template
// (AURA.ViewModels.UploadTemplateAcceptedViewModel). The backend currently
// serializes as camelCase, but both casings are tolerated defensively.
export interface UploadTemplateAcceptedViewModel {
  templateId: number;
  uploadTemplateEventsPath: string;
  message: string;
}

// Mirrors the backend enum AURA.Program.ParsingStatus - sent as a plain
// number since no JsonStringEnumConverter is registered.
export enum ParsingStatus {
  InProgress = 1,
  Completed = 2,
  Failed = 3,
}

// Shape of each SSE "notifications" event payload (AURA.Program.TemplateParseNotification).
export interface TemplateParseNotification {
  templateId: number;
  message: string;
  parsingStatus: number;
  createdAt: string;
}

@Component({
  selector: 'app-add-audit-report',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    FileUploadModule,
    MessageModule,
    DrawIconComponent
  ],
  templateUrl: './add-audit-report.component.html',
  styleUrl: './add-audit-report.component.scss',
})
export class AddAuditReport implements OnInit, OnDestroy {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() editTemplate: EditReportTemplateData | null = null;
  @Output() saved = new EventEmitter<EditReportTemplateData>();
  @Output() created = new EventEmitter<EditReportTemplateData>();
  @Output() processingStarted = new EventEmitter<boolean>();

  private readonly companyDataService = inject(CompanyDataService);

  readonly ParsingStatus = ParsingStatus;
  readonly industryTypeOptions = INDUSTRY_TYPE_OPTIONS;

  get companyOptions(): CompanyOption[] {
    const seen = new Set<string>();
    const options: CompanyOption[] = [...LOCAL_COMPANY_OPTIONS];
    options.forEach(o => seen.add(o.value));
    for (const c of this.companyDataService.all) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        options.push({ label: c.companyName, value: c.id });
      }
    }
    // Deactivated companies are excluded, except the one already selected on
    // the form (so editing a template under a since-blocked company doesn't
    // blank the field).
    const currentId = this.uploadForm?.get('company')?.value;
    return options.filter(o => !this.companyDataService.isCompanyBlocked(o.value) || o.value === currentId);
  }

  private readonly uploadUrl = `${environment.apiBaseUrl}/Audit/upload-template`;

  private eventSource: EventSource | null = null;

  uploadForm!: FormGroup;

  // Edit mode only - the file starts locked (see the __file-locked block in
  // add-audit-report.html); attemptUnlockFile() flips this once the usage
  // check clears.
  fileUnlocked = signal(false);
  checkingUsage = signal(false);

  phase = signal<'form' | 'processing'>('form');
  submitted = false;

  selectedFile = signal<File | null>(null);
  fileError = signal<string | null>(null);

  uploading = signal(false);
  errorMessage = signal<string | null>(null);

  accepted = signal<UploadTemplateAcceptedViewModel | null>(null);
  notifications = signal<TemplateParseNotification[]>([]);
  sseConnectionError = signal(false);

  // The most recently received notification decides the overall outcome -
  // every earlier one is just a step along the way (see add-audit-report.html).
  readonly firstFailedNotification = computed<TemplateParseNotification | null>(() => {
    const list = this.notifications();
    // return list.length ? list[list.length - 1] : null;
    return list.find(notification => notification.parsingStatus === ParsingStatus.Failed) || null;
  });

  readonly parsingFinished = computed(() => {
    const status = this.firstFailedNotification()?.parsingStatus;
    return status === ParsingStatus.Completed || status === ParsingStatus.Failed;
  });

  readonly parsingFailed = computed(() => this.firstFailedNotification()?.parsingStatus === ParsingStatus.Failed);

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const template = this.mode === 'edit' ? this.editTemplate : null;

    console.log("to be edited template", template);
    this.uploadForm = this.fb.group({
      company: [template?.companyId ?? '', Validators.required],
      division: [template?.divisionCode ?? '', Validators.required],
      templateName: [template?.templateName ?? '', Validators.required],
      templateDescription: [template?.templateDescription ?? ''],
      industryType: [normalizeIndustryType(template?.industryType), Validators.required],
      isActive: [template ? template.status === 'active' : true],
    });
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  isFieldInvalid(name: string): boolean {
    const control = this.uploadForm.get(name);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  get divisionOptions(): DivisionOption[] {
    const companyId = this.uploadForm.get('company')?.value;
    if (!companyId) return [];

    const seen = new Set<string>();
    const options: DivisionOption[] = (LOCAL_DIVISION_OPTIONS_BY_COMPANY[companyId] ?? []).slice();
    options.forEach(o => seen.add(o.value));

    // Divisions that have no report templates yet (e.g. newly created via the
    // Divisions module) are still selectable here - just with no Industry Type
    // to auto-fill, since that taxonomy only exists on the report-templates side.
    const canonicalCompany = DIVISION_STATIC_COMPANIES.find(co => co.id === companyId);
    if (canonicalCompany) {
      for (const b of canonicalCompany.divisions) {
        if (!seen.has(b.divisionCode)) {
          seen.add(b.divisionCode);
          options.push({ label: b.divisionName, value: b.divisionCode, industryType: '' });
        }
      }
    }

    // Deactivated divisions (or any division under a deactivated company) are
    // excluded, except the division already selected on the form.
    const companyBlocked = this.companyDataService.isCompanyBlocked(companyId);
    const currentDivisionCode = this.uploadForm?.get('division')?.value;
    return options.filter(o => {
      if (o.value === currentDivisionCode) return true;
      const division = canonicalCompany?.divisions.find(b => b.divisionCode === o.value);
      return division ? division.status === 'active' && !companyBlocked : true;
    });
  }

  onCompanyChange(): void {
    this.uploadForm.patchValue({ division: '', industryType: '' });
  }

  onDivisionChange(): void {
    const divisionCode = this.uploadForm.get('division')?.value;
    const match = this.divisionOptions.find(b => b.value === divisionCode);
    if (match) {
      this.uploadForm.patchValue({ industryType: match.industryType });
    }
  }

  toggleStatus(): void {
    this.uploadForm.patchValue({ isActive: !this.uploadForm.value.isActive });
  }

  // Re-checks right before unlocking rather than trusting whatever isUsed
  // value the list happened to load with - a report could start using this
  // template at any point after that list was fetched.
  // TODO: replace this local check with a real backend call once one
  // exists, e.g. GET /Audit/report-templates/{id}/usage -> { isUsed }.
  attemptUnlockFile(): void {
    if (!this.editTemplate) {
      return;
    }

    this.checkingUsage.set(true);
    this.fileError.set(null);

    setTimeout(() => {
      this.checkingUsage.set(false);

      if (this.editTemplate?.isUsed) {
        this.fileError.set('This template is currently in use and its file cannot be replaced.');
        return;
      }

      this.fileUnlocked.set(true);
    }, 400);
  }

  onFileSelected(event: FileSelectEvent): void {
    const file = (event.files as FileList | File[])[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      this.fileError.set('Only .docx files are supported.');
      this.selectedFile.set(null);
      return;
    }

    this.fileError.set(null);
    this.selectedFile.set(file);
  }

  uploadTemplate(): void {
    this.submitted = true;

    if (!this.selectedFile()) {
      this.fileError.set('Please select a .docx file to upload.');
    }

    if (this.uploadForm.invalid || !this.selectedFile() || this.uploading()) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set(null);

    const formData = new FormData();
    formData.append('File', this.selectedFile()!, this.selectedFile()!.name);
    formData.append('CompanyId', this.uploadForm.value.company);
    formData.append('DivisionCode', this.uploadForm.value.division);
    formData.append('TemplateName', this.uploadForm.value.templateName);
    if (this.uploadForm.value.templateDescription) {
      formData.append('TemplateDescription', this.uploadForm.value.templateDescription);
    }
    formData.append('IndustryType', this.uploadForm.value.industryType);
    formData.append('IsActive', String(this.uploadForm.value.isActive));

    this.http.post(this.uploadUrl, formData, { observe: 'response' }).subscribe({
      next: (response) => {
        this.uploading.set(false);

        if (response.status === 202 && response.body) {
          const accepted = this.normalizeAccepted(response.body);
          this.accepted.set(accepted);
          this.phase.set('processing');
          this.processingStarted.emit(true);
          this.connectToEvents(accepted.uploadTemplateEventsPath);
        } else {
          this.errorMessage.set('Unexpected response from server.');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.errorMessage.set(
          err?.error?.errorMessage ?? err?.error?.message ?? err?.error ?? 'Failed to upload template. Please try again.',
        );
      },
    });
  }

  onSubmit(): void {
    if (this.mode === 'edit') {
      this.saveChanges();
    } else {
      this.uploadTemplate();
    }
  }

  saveChanges(): void {
    this.submitted = true;

    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    if (!this.editTemplate) {
      return;
    }

    const v = this.uploadForm.value;
    this.saved.emit({
      ...this.editTemplate,
      companyId: v.company,
      divisionCode: v.division,
      divisionName: this.divisionOptions.find(b => b.value === v.division)?.label ?? this.editTemplate.divisionName,
      templateName: v.templateName,
      templateDescription: v.templateDescription,
      industryType: v.industryType,
      status: v.isActive ? 'active' : 'inactive',
      templateFileName: this.selectedFile()?.name ?? this.editTemplate.templateFileName,
    });
  }

  onNotificationClick(notification: TemplateParseNotification): void {
    if (notification.parsingStatus === ParsingStatus.Completed) {
      this.router.navigate(['/apps/add-report'], { queryParams: { id: notification.templateId } });
    }
  }

  private connectToEvents(path: string): void {
    const origin = new URL(environment.apiBaseUrl).origin;
    const cleanPath = path.replace(/^\/+/, '');
    const eventsUrl = `${origin}/${cleanPath}`;

    // This opens a live connection to the backend SSE endpoint.
    // It allows the backend to keep sending messages to the frontend without the frontend repeatedly calling the API.
    this.eventSource = new EventSource(eventsUrl);

    //This tells the frontend to listen for SSE events named notifications.
    // Whenever the backend sends a notifications event, this code will run.
    this.eventSource.addEventListener('notifications', (event: MessageEvent) => {
      this.sseConnectionError.set(false);

      try {
        const raw = JSON.parse(event.data);
        const notification = this.normalizeNotification(raw);
        this.notifications.update((list) =>
          [...list, notification].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          ),
        );

        // The backend closes its side of the stream right after the final
        // Completed notification (its per-job channel is single-use and gone
        // by then) - close our end too, deliberately, so the browser's
        // EventSource does not treat that server-initiated close as a
        // dropped connection and auto-reconnect to a channel that will never
        // exist again. Failed notifications are per-placeholder progress
        // reports, not terminal - parsing keeps going and still ends in a
        // Completed notification, so the stream must stay open for those.
        if (notification.parsingStatus === ParsingStatus.Completed) {
          this.eventSource?.close();
          console.log("template created:", notification.templateId);  
          this.emitCreatedTemplate(notification.templateId);
        }
      } catch {
        // Malformed SSE payload - drop it silently rather than crashing the dialog.
      }
    });

    this.eventSource.onerror = () => {
      this.sseConnectionError.set(true);
    };
  }

  // The SSE "Completed" notification only carries `templateId` - the richer
  // create-time data still sits in `uploadForm`/`selectedFile()` (never reset
  // during the upload -> processing -> completion flow), so it's assembled
  // here rather than trusting the notification payload to have it.
  private emitCreatedTemplate(templateId: number): void {
    const v = this.uploadForm.value;
    this.created.emit({
      id: `RPT-${templateId}`,
      templateId,
      companyId: v.company,
      divisionCode: v.division,
      divisionName: this.divisionOptions.find(b => b.value === v.division)?.label ?? '',
      templateName: v.templateName,
      templateDescription: v.templateDescription,
      industryType: v.industryType,
      status: v.isActive ? 'active' : 'inactive',
      templateFileName: this.selectedFile()?.name ?? '',
      isUsed: false,
    });
  }

  private normalizeAccepted(raw: any): UploadTemplateAcceptedViewModel {
    return {
      templateId: raw.templateId ?? raw.TemplateId,
      uploadTemplateEventsPath: raw.uploadTemplateEventsPath ?? raw.UploadTemplateEventsPath,
      message: raw.message ?? raw.Message,
    };
  }

  private normalizeNotification(raw: any): TemplateParseNotification {
    return {
      templateId: raw.templateId ?? raw.TemplateId,
      message: raw.message ?? raw.Message,
      parsingStatus: raw.parsingStatus ?? raw.ParsingStatus,
      createdAt: raw.createdAt ?? raw.CreatedAt,
    };
  }
}
