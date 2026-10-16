import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { PanelModule } from 'primeng/panel';

import { QuestionareSection } from '@/app/features/audits/audit-execution/rfi-management/questionare-section/questionare-section.component';
import type { EnrichedRFI } from '@/app/features/audits/audit-execution/rfi-management/models/rfi.model';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { submitStaticRfiResponse } from '@/app/features/audits/audit-execution/rfi-management/rfi-static-data';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface ClientRfiDrawerData {
  rfi: EnrichedRFI;
  currentUser?: string;
  viewOnly?: boolean;
}

export interface UploadedFileEntry {
  file: File;
  description: string;
}

export interface StaticDoc {
  name: string;
  url: string;
  description: string;
}

@Component({
  selector: 'app-client-rfi-management',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,
    ButtonModule,
    CardModule,
    DividerModule,
    InputTextModule,
    MessageModule,
    PanelModule,
    TagModule,
    TextareaModule,
    FileUploadModule,
    ToastModule,
    TooltipModule,
    QuestionareSection,
    DrawIconComponent,
  ],
  providers: [MessageService],
  templateUrl: './client-rfi-management.component.html',
  styleUrl: './client-rfi-management.component.scss',
})
export class ClientRfiManagement implements OnInit, OnDestroy {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as ClientRfiDrawerData | null;

  rfi: EnrichedRFI = this.data!.rfi;
  currentUser: string = this.data?.currentUser ?? '';
  isViewOnly: boolean = this.data?.viewOnly ?? false;

  @ViewChild('questionareRef') questionareSection?: QuestionareSection;

  activeTabIndex: string | number | undefined = 0;
  responseMode: 'view' | 'edit' | 'new' | 'resubmit' = 'new';
  private readonly boundOnResize = (event: MouseEvent) => this.onResize(event);
  private readonly boundOnResizeEnd = () => this.onResizeEnd();
  private subs = new Subscription();

  responseForm!: FormGroup;
  responseSubmitted = false;
  responseFiles: UploadedFileEntry[] = [];

  staticDocs: StaticDoc[] = [
    {
      name: 'Audit_Theory_BRD.docx',
      url: 'http://localhost:5251/uploads/Audit_Theory_BRD.docx',
      description: 'Business Requirements Document detailing audit theory and engagement methodology',
    },
    {
      name: 'Cygnus_AURA_BRD 12 JAN 2026.docx',
      url: 'http://localhost:5251/uploads/Cygnus_AURA_BRD 12 JAN 2026.docx',
      description: 'Cygnus AURA platform Business Requirements Document — January 2026 release baseline',
    },
  ];

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

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.buildResponseForm();
    this.responseMode = this.rfi.response ? 'view' : 'new';
  }

  onResubmitResponse(): void {
    this.responseMode = 'resubmit';
    this.buildResponseForm();
  }

  onCancelResubmit(): void {
    this.responseMode = 'view';
    this.buildResponseForm();
  }

  private buildResponseForm(): void {
    this.responseForm = this.fb.group({
      responseText: ['', Validators.required],
      explanationNotes: [''],
    });
    this.responseSubmitted = false;
    this.responseFiles = [];
  }

  isResponseFieldInvalid(name: string): boolean {
    const ctrl = this.responseForm.get(name);
    return !!(ctrl && ctrl.invalid && (this.responseSubmitted || ctrl.touched));
  }

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'completed':    return 'success';
      case 'under-review': return 'secondary';
      case 'in-progress':  return 'info';
      case 'overdue':      return 'danger';
      case 'reopened':     return 'danger';
      default:             return 'warn';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'in-progress':  return 'In Progress';
      case 'completed':    return 'Completed';
      case 'under-review': return 'Under Review';
      case 'overdue':      return 'Overdue';
      case 'reopened':     return 'Reopened';
      default:             return 'Pending';
    }
  }

  responseSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      default:         return 'info';
    }
  }

  responseStatusLabel(status: string): string {
    switch (status) {
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      default:         return 'Pending Review';
    }
  }

  onResponseFileSelect(event: { files: File[] }): void {
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
      const alreadyAdded = this.responseFiles.some(
        e => e.file.name === file.name && e.file.size === file.size
      );
      if (!alreadyAdded) {
        this.responseFiles.push({ file, description: '' });
      }
    }
  }

  removeResponseFile(index: number): void {
    this.responseFiles.splice(index, 1);
  }

  onEditResponse(): void {
    this.responseMode = 'edit';
    if (this.rfi?.response) {
      this.responseForm.patchValue({
        responseText: this.rfi.response.responseText,
        explanationNotes: this.rfi.response.explanationNotes ?? '',
      });
    }
  }

  onClearAndNewResponse(): void {
    this.responseMode = 'new';
    this.buildResponseForm();
  }

  onCancelEdit(): void {
    this.responseMode = 'view';
    this.buildResponseForm();
  }

  onNextToQuestionnaire(): void {
    this.responseSubmitted = true;
    this.responseForm.markAllAsTouched();

    if (this.responseForm.invalid) {
      this.messageService.add({
        severity: 'error', summary: 'Validation Error',
        detail: 'Response text is required.',
      });
      return;
    }

    this.activeTabIndex = 2;
    this.responseSubmitted = false;
  }

  onSubmitResponse(): void {
    // Validate questionnaire: every question must have an answer
    const rows = this.questionareSection?.rows ?? [];
    const questionsWithText = rows.filter(r => r.questionText.trim());
    const unanswered = questionsWithText.filter(r => !r.answerText.trim());

    if (questionsWithText.length > 0 && unanswered.length > 0) {
      this.messageService.add({
        severity: 'error', summary: 'Answers Required',
        detail: `${unanswered.length} question(s) are missing answers. Please answer all questions before submitting.`,
      });
      return;
    }

    this.responseSubmitted = true;
    this.responseForm.markAllAsTouched();

    if (this.responseForm.invalid) {
      this.messageService.add({
        severity: 'error', summary: 'Validation Error',
        detail: 'Response text is required.',
      });
      return;
    }

    const isResend = this.responseMode === 'edit' || this.responseMode === 'resubmit';
    const questionnaireData = (this.questionareSection?.rows ?? []).map(r => ({
      question: r.questionText,
      answer: r.answerText,
      dueDate: r.dueDate,
    }));

    console.log(isResend ? 'Re-send Response Payload:' : 'New Response Payload:', {
      ...this.responseForm.value,
      responseFiles: this.responseFiles,
      rfiId: this.rfi?.id,
      questionnaire: questionnaireData,
    });

    // Persist into the shared RFI static data — moves the RFI to
    // 'under-review' and records the response + questionnaire answers, so
    // both rfi-management.html and rfi-management-client.html reflect it
    // immediately (they both read the same in-memory tree).
    submitStaticRfiResponse(
      this.rfi.id,
      {
        responseText: this.responseForm.value.responseText,
        explanationNotes: this.responseForm.value.explanationNotes || undefined,
        responseDocs: this.responseFiles.map(f => ({ name: f.file.name, url: '', description: f.description })),
        submittedAt: new Date().toISOString(),
      },
      questionnaireData,
    );

    this.messageService.add({
      severity: 'success',
      summary: isResend ? 'Response Re-sent' : 'Response Submitted',
      detail: isResend
        ? 'Your updated response has been re-sent to the auditor.'
        : 'Your response has been submitted successfully.',
    });

    this.onClose();
  }

  // These docs are served by the real backend (`http://localhost:5251/uploads/...`),
  // not through HttpClient, so the global error interceptor can't catch a failure
  // here — check reachability ourselves before opening/downloading.
  private async isDocReachable(url: string): Promise<boolean> {
    try {
      await fetch(url, { method: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  }

  async openDoc(url: string): Promise<void> {
    if (!(await this.isDocReachable(url))) {
      this.messageService.add({ severity: 'warn', summary: '', detail: 'This Feature is under development' });
      return;
    }
    window.open(url, '_blank');
  }

  async downloadDoc(doc: StaticDoc): Promise<void> {
    if (!(await this.isDocReachable(doc.url))) {
      this.messageService.add({ severity: 'warn', summary: '', detail: 'This Feature is under development' });
      return;
    }
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  resolveFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf')                                       return 'pi pi-file-pdf';
    if (['doc', 'docx'].includes(ext))                       return 'pi pi-file-word';
    if (['xls', 'xlsx', 'csv'].includes(ext))                return 'pi pi-file-excel';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'pi pi-image';
    return 'pi pi-file';
  }

  onClose(): void {
    this.subs.unsubscribe();
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
      const panel = document.querySelector('.client-rfi-drawer') as HTMLElement | null;
      if (panel) panel.style.width = `${newWidth}px`;
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
