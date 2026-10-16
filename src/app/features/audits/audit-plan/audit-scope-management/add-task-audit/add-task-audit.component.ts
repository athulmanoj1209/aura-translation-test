import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { FileUploadModule } from 'primeng/fileupload';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-add-task-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    SelectModule,
    SelectButtonModule,
    MultiSelectModule,
    TabsModule,
    TextareaModule,
    DatePickerModule,
    FileUploadModule,
    ToastModule,
    InputNumberModule,
  ],
  providers: [MessageService],
  templateUrl: './add-task-audit.component.html',
  styleUrl: './add-task-audit.component.scss',
})
export class AddTaskAudit implements OnInit, OnDestroy {

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() taskSaved = new EventEmitter<Record<string, unknown>>();

  /** Existing tasks to seed the list with (e.g. when editing a scope that already has tasks). */
  @Input() initialTasks: Record<string, unknown>[] = [];

  taskForm!: FormGroup;
  submitted = false;
  tasks: Record<string, unknown>[] = [];
  editingTaskIndex: number | null = null;

  taskStatusOptions = [
    { label: 'Not Started', value: 'not-started' },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Overdue', value: 'overdue' },
  ];

  // ── SelectButton option sets ───────────────────────────────────────────────
  taskTypeOptions = [
    { label: 'Scope-related', value: 'scope', icon: 'pi-link' },
    { label: 'Independent', value: 'independent', icon: 'pi-flag' },
  ];

  rfiSourceOptions = [
    { label: 'New RFI', value: 'new', icon: 'pi-plus-circle' },
    { label: 'From RFI Library', value: 'library', icon: 'pi-book' },
  ];

  controlRatingOptions = [
    { label: 'Strong', value: 'strong', icon: 'pi-shield' },
    { label: 'Moderate', value: 'moderate', icon: 'pi-minus-circle' },
    { label: 'Weak', value: 'weak', icon: 'pi-exclamation-triangle' },
  ];

  riskPriorityOptions = [
    { label: 'Critical Risk', value: 'critical' },
    { label: 'High Risk', value: 'high' },
    { label: 'Medium Risk', value: 'medium' },
    { label: 'Low Risk', value: 'low' },
  ];

  // ── Dropdown / multiselect option sets ────────────────────────────────────
  checklistOptions = [
    { label: 'Verify authorization controls', value: 'auth_controls' },
    { label: 'Review access logs', value: 'access_logs' },
    { label: 'Test password policies', value: 'password_policy' },
    { label: 'Check segregation of duties', value: 'seg_duties' },
    { label: 'Validate data retention', value: 'data_retention' },
    { label: 'Confirm backup procedures', value: 'backup_procedures' },
    { label: 'Assess incident response', value: 'incident_response' },
  ];

  rfiLibraryOptions = [
    { label: 'RFI-001 — Financial Records Q1', value: 'rfi_001' },
    { label: 'RFI-002 — IT Access Review', value: 'rfi_002' },
    { label: 'RFI-003 — Vendor Contracts', value: 'rfi_003' },
    { label: 'RFI-004 — HR Policy Compliance', value: 'rfi_004' },
  ];

  auditorOptions = [
    { label: 'Alice Johnson', value: 'alice' },
    { label: 'Bob Smith', value: 'bob' },
    { label: 'Carol White', value: 'carol' },
    { label: 'David Lee', value: 'david' },
  ];

  taskFormErrorMessages: Record<string, Record<string, string>> = {
    taskType: {
      required: 'Task type is required.'
    },
    taskName: {
      required: 'Task name is required.',
      minlength: 'Task name must be at least 2 characters.',
      maxlength: 'Task name cannot exceed 200 characters.',
    },
    status: {
      required: 'Status is required.',
    },
    objective: {
      maxlength: 'Objective cannot exceed 500 characters.',
    },
    assignedAuditor: {
      required: 'Please assign an auditor.',
    },
    startDate: {
      required: 'Start date is required.',
      startDateInvalid: 'Start date must be in the future.',
    },
    endDate: {
      required: 'End date is required.',
      endBeforeStart: 'End date must be after start date.',
    },
    controlRating: {
      required: 'Control rating is required.',
    },
    riskPriority: {
      required: 'Risk priority is required.',
    },
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
  ) { }

  ngOnInit(): void {
    this.buildTaskForm();
    // 'add' mode: the caller passes no initialTasks, so this starts empty —
    // a freshly-created scope always begins with a clean task list.
    // 'edit' mode: seeded with that scope's existing tasks. Cloned so edits
    // to `this.tasks` never mutate the caller's array directly until submit.
    this.tasks = this.initialTasks.map(t => ({ ...t }));
  }

  get f() {
    return this.taskForm.controls;
  }

  ngOnDestroy(): void { }

  // ── Form builder ───────────────────────────────────────────────────────────
  private buildTaskForm(): void {
    this.taskForm = this.fb.group(
      {
        taskName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
        status: ['not-started', Validators.required],
        objective: ['', Validators.maxLength(500)],
        checklistItems: [[]],
        assignedAuditor: [null, Validators.required],
        startDate: [null, [Validators.required, this.startDateInvalid.bind(this)]],
        endDate: [null, Validators.required],
        controlRating: ['', Validators.required],
        riskPriority: ['', Validators.required],
        tags: [[]],
        description: [''],
      },
      { validators: this.taskDateRangeValidator },
    );
  }

  // ── Cross-field validator ──────────────────────────────────────────────────
  private taskDateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (start && end && new Date(end) <= new Date(start)) {
      return { endBeforeStart: true };
    }
    return null;
  }

  startDateInvalid(control: AbstractControl): ValidationErrors | null {
    // Skip the future-date check while editing an existing task — its start
    // date is real historical data, not a new task being scheduled.
    const isStartDateValid = this.editingTaskIndex === null && control.value
      ? control.value <= new Date() ? { invalidStartDate: true } : null
      : null;
    // Returns an error object if invalid, or null if valid
    return isStartDateValid ? { 'startDateInvalid': { value: control.value } } : null;
  }

  getErrorMessage(controlName: string): string {
    const control = this.taskForm.get(controlName);

    if (!control || !control.errors) return '';

    const errors = control.errors;
    const firstErrorKey = Object.keys(errors)[0];

    return this.taskFormErrorMessages[controlName]?.[firstErrorKey] || 'Invalid field.';
  }

  // ── Computed getters ───────────────────────────────────────────────────────
  get taskObjectiveLength(): number {
    return this.taskForm?.get('objective')?.value?.length ?? 0;
  }

  get isNewRfi(): boolean {
    return this.taskForm?.get('rfiSource')?.value === 'new';
  }

  get isLibraryRfi(): boolean {
    return this.taskForm?.get('rfiSource')?.value === 'library';
  }

  get controlRatingValue(): string {
    return this.taskForm?.get('controlRating')?.value ?? '';
  }

  get taskTypeValue(): string {
    return this.taskForm?.get('taskType')?.value ?? '';
  }

  getRiskPriority(task: any): string {
  return String(task.riskPriority);
}

  taskStatusLabel(task: any): string {
    return this.taskStatusOptions.find(o => o.value === task?.status)?.label ?? 'Not Started';
  }

  // ── Validation helper ──────────────────────────────────────────────────────
  isTaskInvalid(field: string): boolean {
    const ctrl = this.taskForm?.get(field);
    return !!(ctrl && ctrl.invalid && (this.submitted || ctrl.touched));
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  onAddTask(): void {
    this.submitted = true;
    this.taskForm.markAllAsTouched();

    if (this.taskForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fix all highlighted fields before adding.',
      });
      return;
    }

    // Store dates as 'YYYY-MM-DD' strings (matching the static-data
    // convention) rather than the datepicker's raw Date object, so a task's
    // date shape is the same whether it was just created or loaded from data.
    const value = {
      ...this.taskForm.value,
      startDate: this.formatDate(this.taskForm.value['startDate']),
      endDate: this.formatDate(this.taskForm.value['endDate']),
    };

    if (this.editingTaskIndex !== null) {
      // Preserve the existing id — the form doesn't manage it as a control.
      const id = this.tasks[this.editingTaskIndex]['id'];
      this.tasks[this.editingTaskIndex] = { id, ...value };
      this.messageService.add({
        severity: 'success',
        summary: 'Task Updated',
        detail: `"${this.taskForm.value['taskName']}" has been updated.`,
      });
      this.editingTaskIndex = null;
    } else {
      this.tasks.push({ id: this.generateTaskId(), ...value });
      this.messageService.add({
        severity: 'success',
        summary: 'Task Added',
        detail: `"${this.taskForm.value['taskName']}" added to the list.`,
      });
    }

    this.resetForm();
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  onEditTask(index: number): void {
    this.editingTaskIndex = index;
    const task = this.tasks[index];
    // The stored dates are 'YYYY-MM-DD' strings — the p-datepicker controls
    // need real Date objects to show the existing value when editing.
    this.taskForm.patchValue({
      ...task,
      startDate: task['startDate'] ? new Date(task['startDate'] as string) : null,
      endDate: task['endDate'] ? new Date(task['endDate'] as string) : null,
    });
    this.tagsList = [...((task['tags'] as string[]) || [])];
    this.submitted = false;
  }

  onClearTask(): void {
    this.editingTaskIndex = null;
    this.resetForm();
  }

  /** Client-side id for a brand-new task — unique enough at this scale, no server round-trip needed. */
  private generateTaskId(): string {
    return 'TSK-' + Date.now().toString(36).toUpperCase();
  }

  removeTask(index: number): void {
    if (this.editingTaskIndex === index) {
      this.editingTaskIndex = null;
      this.resetForm();
    } else if (this.editingTaskIndex !== null && this.editingTaskIndex > index) {
      this.editingTaskIndex--;
    }
    this.tasks.splice(index, 1);
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  tagsList: string[] = [];

  onAddTag(input: HTMLInputElement): void {
    const value = input.value.trim();
    if (value && !this.tagsList.includes(value)) {
      this.tagsList.push(value);
      this.taskForm.get('tags')?.setValue([...this.tagsList]);
    }
    input.value = '';
    input.focus();
  }

  removeTagChip(index: number): void {
    this.tagsList.splice(index, 1);
    this.taskForm.get('tags')?.setValue([...this.tagsList]);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  private resetForm(): void {
    this.submitted = false;
    this.tagsList = [];
    this.buildTaskForm();
  }
}