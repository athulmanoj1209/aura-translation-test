import {
  Component,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule }      from 'primeng/button';
import { InputTextModule }   from 'primeng/inputtext';
import { SelectModule }      from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TabsModule }        from 'primeng/tabs';
import { TextareaModule }    from 'primeng/textarea';
import { DatePickerModule }  from 'primeng/datepicker';
import { ToastModule }       from 'primeng/toast';
import { TooltipModule }     from 'primeng/tooltip';
import { TagModule }         from 'primeng/tag';
import { MessageService }    from 'primeng/api';

import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import {
  ScopeJob,
  JobStatus,
  AuditFrequency,
  ModeOfAudit,
} from '../scope-job-list/scope-job-list.component';
import {
  ScopeTask,
  TaskStatus,
  TaskPriority,
} from '../scope-job-details/scope-job-details.component';

import { StatusUpdateDrawerComponent, StatusUpdateDrawerData, StatusUpdateResult } from '../scope-job-status-update/scope-job-status-update.component';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';


// ── Drawer data ───────────────────────────────────────────────────────────────
export interface EditScopeJobDrawerData {
  job:    ScopeJob;
  tasks?: EditableTask[];
}

// ── Extended task model ───────────────────────────────────────────────────────
export type ControlRating = 'strong' | 'moderate' | 'weak';

export interface EditableTask extends ScopeTask {
  objective?:      string;
  checklistItems?: string[];
  startDate?:      Date;
  endDate?:        Date;
  controlRating?:  ControlRating;
  observations?:   string;
  isNew?:          boolean;   // true only for tasks added in this edit session
}

// ── Static lookup tables ──────────────────────────────────────────────────────
const AUDITOR_OPTIONS = [
  { label: 'Alice Johnson', value: 'alice' },
  { label: 'Bob Smith',     value: 'bob'   },
  { label: 'Carol White',   value: 'carol' },
  { label: 'David Lee',     value: 'david' },
  { label: 'Emma Davis',    value: 'emma'  },
  { label: 'Frank Miller',  value: 'frank' },
  { label: 'Grace Wilson',  value: 'grace' },
  { label: 'Henry Brown',   value: 'henry' },
];

const AUDITOR_NAMES: Record<string, string> = Object.fromEntries(
  AUDITOR_OPTIONS.map(o => [o.value, o.label]),
);

// Auto-generate tasks from a ScopeJob (same logic as profile component)
const TASK_TEMPLATES: { title: string; description: string; priority: TaskPriority }[] = [
  { title: 'Planning & Scoping',       description: 'Define audit scope, objectives, and risk areas for the period.',     priority: 'high'   },
  { title: 'Risk Assessment',          description: 'Identify and evaluate inherent and control risks.',                  priority: 'high'   },
  { title: 'Control Walkthrough',      description: 'Walk through key internal controls with process owners.',           priority: 'medium' },
  { title: 'Fieldwork Execution',      description: 'Perform substantive testing and evidence collection.',              priority: 'high'   },
  { title: 'Evidence Documentation',   description: 'Document all working papers and audit evidence.',                   priority: 'medium' },
  { title: 'Control Testing',          description: 'Test design and operating effectiveness of selected controls.',     priority: 'medium' },
  { title: 'Draft Report Preparation', description: 'Prepare draft findings, recommendations, and management responses.',priority: 'medium' },
  { title: 'Management Review',        description: 'Obtain management sign-off on findings and action plans.',         priority: 'low'    },
  { title: 'Final Report Issuance',    description: 'Issue the final audit report to relevant stakeholders.',           priority: 'low'    },
  { title: 'Follow-up & Closure',      description: 'Track implementation of management action plans and close findings.',priority: 'low'   },
];

function generateTasksForJob(job: ScopeJob): ScopeTask[] {
  const seed  = job.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const count = 4 + (seed % 3);
  const start = job.periodStart.getTime();
  const end   = job.periodEnd.getTime();
  const span  = (end - start) / (count + 1);
  const now   = Date.now();

  return TASK_TEMPLATES.slice(0, count).map((t, i) => {
    const dueDate    = new Date(start + span * (i + 1));
    const isPast     = dueDate.getTime() < now;
    const assignedTo = job.assignedAuditors[i % job.assignedAuditors.length];

    let status: TaskStatus;
    if (job.status === 'pending')          { status = 'open'; }
    else if (job.status === 'completed')   { status = 'completed'; }
    else if (isPast) {
      status = i < count - 2 ? 'completed' : (job.status === 'overdue' ? 'overdue' : 'completed');
    } else {
      status = i === count - (count > 4 ? 2 : 1) ? 'in_progress' : 'open';
    }

    return {
      id: `${job.id}-T${String(i + 1).padStart(2, '0')}`,
      title:      t.title,
      description: t.description,
      assignedTo,
      dueDate,
      status,
      priority:   t.priority,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector:    'app-edit-scope-job',
  standalone:  true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    ButtonModule, InputTextModule, SelectModule, MultiSelectModule,
    TabsModule, TextareaModule, DatePickerModule, ToastModule,
    TooltipModule, TagModule,
  
    DrawIconComponent,],
  providers:   [MessageService],
  templateUrl: './manage-scope-job.component.html',
  styleUrl:    './manage-scope-job.component.scss',
})
export class EditScopeJobComponent implements OnInit, OnDestroy {
  private readonly drawerRef = inject(DrawerRef);
  private readonly data      = inject(DRAWER_DATA, { optional: true }) as EditScopeJobDrawerData | null;
  private readonly drawer    = inject(RightDrawerService);
  private subs = new Subscription();

  job!:  ScopeJob;
  tasks: EditableTask[] = [];

  activeTabIndex = 0;
  submitted      = false;

  // ── Task panel state ──────────────────────────────────────────────────────
  showAddTaskForm  = false;
  addTaskSubmitted = false;
  editingTaskId:  string | null = null;
  addTaskForm!:   FormGroup;

  // ── Task pagination ────────────────────────────────────────────────────────
  readonly taskPageSize = 5;
  taskPage = 0;

  get pagedTasks(): EditableTask[] {
    const start = this.taskPage * this.taskPageSize;
    return this.tasks.slice(start, start + this.taskPageSize);
  }

  get taskPageCount(): number {
    return Math.max(1, Math.ceil(this.tasks.length / this.taskPageSize));
  }

  get taskPageRange(): string {
    const start = this.taskPage * this.taskPageSize + 1;
    const end   = Math.min((this.taskPage + 1) * this.taskPageSize, this.tasks.length);
    return `${start}–${end}`;
  }

  /** Page numbers to display, with -1 as an ellipsis placeholder */
  get visiblePages(): number[] {
    const total = this.taskPageCount;
    const cur   = this.taskPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const set = new Set<number>();
    set.add(0); set.add(total - 1);
    for (let i = Math.max(0, cur - 1); i <= Math.min(total - 1, cur + 1); i++) set.add(i);
    const sorted = Array.from(set).sort((a, b) => a - b);
    const result: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push(-1);
      result.push(sorted[i]);
    }
    return result;
  }

  prevTaskPage(): void { if (this.taskPage > 0) this.taskPage--; }
  nextTaskPage(): void { if (this.taskPage < this.taskPageCount - 1) this.taskPage++; }
  goToTaskPage(n: number): void { this.taskPage = n; }

  // ── Form ──────────────────────────────────────────────────────────────────
  jobForm!: FormGroup;

  // ── Static options ────────────────────────────────────────────────────────
  readonly statusOptions = [
    { label: 'Pending',     value: 'pending'     },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed',   value: 'completed'   },
    { label: 'Overdue',     value: 'overdue'     },
  ];

  readonly modeOfAuditOptions = [
    { label: 'Full',       value: 'full'        },
    { label: 'Limited',    value: 'limited'     },
    { label: 'Thematic',   value: 'thematic'    },
    { label: 'Follow-up',  value: 'follow-up'   },
    { label: 'Continuous', value: 'continuous'  },
  ];

  readonly auditorOptions  = AUDITOR_OPTIONS;
  readonly reviewerOptions = AUDITOR_OPTIONS;

  readonly taskStatusOptions: { label: string; value: TaskStatus }[] = [
    { label: 'Open',        value: 'open'        },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed',   value: 'completed'   },
    { label: 'Overdue',     value: 'overdue'     },
  ];

  readonly taskPriorityOptions = [
    { label: 'Low',      value: 'low'      },
    { label: 'Medium',   value: 'medium'   },
    { label: 'High',     value: 'high'     },
    { label: 'Critical', value: 'critical' },
  ];

  readonly controlRatingOptions: { label: string; value: ControlRating; icon: string }[] = [
    { label: 'Strong',   value: 'strong',   icon: 'pi-shield'               },
    { label: 'Moderate', value: 'moderate', icon: 'pi-minus-circle'         },
    { label: 'Weak',     value: 'weak',     icon: 'pi-exclamation-triangle' },
  ];

  readonly checklistItemOptions = [
    { label: 'Verify authorization controls',  value: 'auth_controls'      },
    { label: 'Review access logs',             value: 'access_logs'        },
    { label: 'Test password policies',         value: 'password_policies'  },
    { label: 'Check segregation of duties',    value: 'segregation_duties' },
    { label: 'Validate data retention',        value: 'data_retention'     },
    { label: 'Confirm backup procedures',      value: 'backup_procedures'  },
    { label: 'Review audit trail',             value: 'audit_trail'        },
    { label: 'Verify user access rights',      value: 'user_access'        },
    { label: 'Test change management',         value: 'change_mgmt'        },
    { label: 'Review incident reports',        value: 'incident_reports'   },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  constructor(private fb: FormBuilder, private messageService: MessageService) {}

  ngOnInit(): void {
    this.job   = this.data?.job   ?? MOCK_JOB;
    this.tasks = this.data?.tasks ?? generateTasksForJob(this.job);
    this.buildJobForm();
    this.buildAddTaskForm();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ── Getters ───────────────────────────────────────────────────────────────
  get f()  { return this.jobForm.controls; }
  get tf() { return this.addTaskForm.controls; }

  // ── Display helpers ───────────────────────────────────────────────────────
  auditorName(id: string): string     { return AUDITOR_NAMES[id] ?? id; }
  auditorInitials(id: string): string {
    return this.auditorName(id).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  statusLabel(s: JobStatus): string {
    return { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue' }[s] ?? s;
  }

  frequencyLabel(f: AuditFrequency): string {
    return { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' }[f] ?? f;
  }

  modeLabel(m: string): string {
    return { full: 'Full', limited: 'Limited', thematic: 'Thematic', 'follow-up': 'Follow-up', continuous: 'Continuous' }[m] ?? m;
  }

  taskStatusLabel(s: TaskStatus): string {
    return { open: 'Open', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue' }[s] ?? s;
  }

  taskStatusIcon(s: TaskStatus): string {
    return { open: 'pi-circle', in_progress: 'pi-spin pi-spinner', completed: 'pi-check-circle', overdue: 'pi-exclamation-circle' }[s] ?? '';
  }

  taskPriorityLabel(p: TaskPriority): string {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  isFieldInvalid(name: string): boolean {
    const ctrl = this.jobForm.get(name);
    return !!ctrl && ctrl.invalid && (this.submitted || ctrl.touched);
  }

  isTaskFieldInvalid(name: string): boolean {
    const ctrl = this.addTaskForm.get(name);
    return !!ctrl && ctrl.invalid && (this.addTaskSubmitted || ctrl.touched);
  }

  get durationDays(): number {
    const ms = this.job.periodEnd.getTime() - this.job.periodStart.getTime();
    return Math.round(ms / 86_400_000) + 1;
  }

  // ── Task duration (Start ↔ End Date & Time) ───────────────────────
  /** Raw ms between the task's start and end date-time, or null if either is unset */
  private get taskDurationMs(): number | null {
    const s = this.addTaskForm?.get('startDate')?.value;
    const e = this.addTaskForm?.get('endDate')?.value;
    if (!s || !e) return null;
    return new Date(e).getTime() - new Date(s).getTime();
  }

  /** True when both dates are set and end is after start */
  get taskDurationValid(): boolean {
    const ms = this.taskDurationMs;
    return ms !== null && ms > 0;
  }

  /** True when both dates are set but end is not after start */
  get taskDurationInvalid(): boolean {
    const ms = this.taskDurationMs;
    return ms !== null && ms <= 0;
  }

  get taskDurationDays(): number {
    const ms = this.taskDurationMs;
    return ms && ms > 0 ? Math.floor(ms / 86_400_000) : 0;
  }

  get taskDurationHours(): number {
    const ms = this.taskDurationMs;
    return ms && ms > 0 ? Math.floor((ms % 86_400_000) / 3_600_000) : 0;
  }

  get taskDurationMinutes(): number {
    const ms = this.taskDurationMs;
    return ms && ms > 0 ? Math.floor((ms % 3_600_000) / 60_000) : 0;
  }

  /** Compact chip label, e.g. "1d 22h" or "3h 30m" */
  get taskDurationShort(): string {
    const d = this.taskDurationDays, h = this.taskDurationHours, m = this.taskDurationMinutes;
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m && !d) parts.push(`${m}m`);   // only show minutes for sub-day spans
    return parts.length ? parts.join(' ') : '0h';
  }

  get objectiveLength(): number { return this.addTaskForm.get('objective')?.value?.length ?? 0; }
  get completionNoteLength(): number { return this.jobForm.get('completionNote')?.value?.length ?? 0; }

  get isEditingTask(): boolean { return this.editingTaskId !== null; }
  get taskFormTitle(): string  { return this.isEditingTask ? 'Edit Task' : 'New Task'; }

  controlRatingLabel(r: ControlRating): string {
    return { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' }[r] ?? r;
  }

  controlRatingIcon(r: ControlRating): string {
    return { strong: 'pi-shield', moderate: 'pi-minus-circle', weak: 'pi-exclamation-triangle' }[r] ?? '';
  }

  get taskCounts() {
    return this.tasks.reduce(
      (a, t) => {
        if      (t.status === 'completed')   a.completed++;
        else if (t.status === 'in_progress') a.inProgress++;
        else if (t.status === 'overdue')     a.overdue++;
        else                                 a.open++;
        return a;
      },
      { completed: 0, inProgress: 0, open: 0, overdue: 0 },
    );
  }

  get taskCompletionPct(): number {
    return this.tasks.length
      ? Math.round((this.taskCounts.completed / this.tasks.length) * 100)
      : 0;
  }

  // ── Form builders ─────────────────────────────────────────────────────────
  private buildJobForm(): void {
    this.jobForm = this.fb.group(
      {
        status:            [this.job.status,            Validators.required],
        modeOfAudit:       [this.job.modeOfAudit,       Validators.required],
        assignedAuditors:  [this.job.assignedAuditors,  Validators.required],
        assignedReviewers: [this.job.assignedReviewers, Validators.required],
        periodStart:       [this.job.periodStart,       Validators.required],
        periodEnd:         [this.job.periodEnd,         Validators.required],
        completionNote:    ['', Validators.maxLength(500)],
      },
      { validators: this.dateRangeValidator },
    );
  }

  private buildAddTaskForm(): void {
    this.addTaskForm = this.fb.group({
      title:          ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
      objective:      ['', Validators.maxLength(500)],
      checklistItems: [[]],
      assignedTo:     [null, Validators.required],
      startDate:      [null, Validators.required],
      endDate:        [null, Validators.required],
      controlRating:  ['',   Validators.required],
      observations:   [''],
      priority:       ['medium', Validators.required],
      status:         ['open',   Validators.required],
    });
  }

  private dateRangeValidator(g: AbstractControl): ValidationErrors | null {
    const s = g.get('periodStart')?.value;
    const e = g.get('periodEnd')?.value;
    if (s && e && new Date(e) <= new Date(s)) return { dateRangeInvalid: true };
    return null;
  }

  // ── Job form actions ──────────────────────────────────────────────────────
  onSave(): void {
    this.submitted = true;
    this.jobForm.markAllAsTouched();

    if (this.jobForm.invalid) {
      this.activeTabIndex = 0;
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fix highlighted fields.' });
      return;
    }

    const payload: Partial<ScopeJob> = { ...this.job, ...this.jobForm.value };
    console.log('[EditScopeJob] Save payload:', payload);
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Scope job updated successfully.' });
    this.drawerRef.close(payload);
  }

  onCancel(): void { this.drawerRef.close(null); }

  // ── Task actions ──────────────────────────────────────────────────────────
  private readonly TASK_FORM_DEFAULTS = { priority: 'medium', status: 'open', checklistItems: [], controlRating: '' };

  toggleAddTaskForm(): void {
    this.showAddTaskForm = !this.showAddTaskForm;
    if (this.showAddTaskForm) {
      this.editingTaskId    = null;
      this.addTaskSubmitted = false;
      this.addTaskForm.reset(this.TASK_FORM_DEFAULTS);
    } else {
      this.editingTaskId = null;
    }
  }

  editTask(task: EditableTask): void {
    this.editingTaskId    = task.id;
    this.showAddTaskForm  = true;
    this.addTaskSubmitted = false;
    this.addTaskForm.reset(this.TASK_FORM_DEFAULTS);
    this.addTaskForm.patchValue({
      title:          task.title,
      objective:      task.objective      ?? task.description ?? '',
      checklistItems: task.checklistItems ?? [],
      assignedTo:     task.assignedTo,
      startDate:      task.startDate      ?? task.dueDate,
      endDate:        task.endDate        ?? task.dueDate,
      controlRating:  task.controlRating  ?? '',
      observations:   task.observations   ?? '',
      priority:       task.priority,
      status:         task.status,
    });
  }

  setControlRating(rating: ControlRating): void {
    this.addTaskForm.patchValue({ controlRating: rating });
    this.addTaskForm.get('controlRating')?.markAsTouched();
  }

  onSaveTask(): void {
    this.addTaskSubmitted = true;
    this.addTaskForm.markAllAsTouched();
    if (this.addTaskForm.invalid) return;

    const v = this.addTaskForm.value;

    if (this.editingTaskId) {
      this.tasks = this.tasks.map(t =>
        t.id === this.editingTaskId
          ? { ...t,
              title:          v.title,
              objective:      v.objective,
              description:    v.objective ?? '',
              checklistItems: v.checklistItems,
              assignedTo:     v.assignedTo,
              startDate:      v.startDate ? new Date(v.startDate) : undefined,
              endDate:        v.endDate   ? new Date(v.endDate)   : undefined,
              dueDate:        v.endDate   ? new Date(v.endDate)   : t.dueDate,
              controlRating:  v.controlRating,
              observations:   v.observations,
              priority:       v.priority,
              status:         v.status,
            } as EditableTask
          : t,
      );
      this.messageService.add({ severity: 'success', summary: 'Task Updated', detail: `"${v.title}" has been updated.` });
    } else {
      const newTask: EditableTask = {
        id:             `${this.job.id}-T${String(this.tasks.length + 1).padStart(2, '0')}`,
        title:          v.title,
        description:    v.objective ?? '',
        objective:      v.objective,
        checklistItems: v.checklistItems ?? [],
        assignedTo:     v.assignedTo,
        startDate:      v.startDate ? new Date(v.startDate) : undefined,
        endDate:        v.endDate   ? new Date(v.endDate)   : undefined,
        dueDate:        v.endDate   ? new Date(v.endDate)   : new Date(),
        controlRating:  v.controlRating,
        observations:   v.observations,
        priority:       v.priority,
        status:         v.status,
        isNew:          true,
      };
      this.tasks = [newTask, ...this.tasks];
      this.taskPage = 0;   // new task goes to front — jump to first page
      this.messageService.add({ severity: 'success', summary: 'Task Added', detail: `"${newTask.title}" has been added.` });
    }

    this.showAddTaskForm  = false;
    this.editingTaskId    = null;
    this.addTaskSubmitted = false;
    this.addTaskForm.reset(this.TASK_FORM_DEFAULTS);
  }

  // Opens the dedicated StatusUpdateDrawer for a single task (with required note)
  async openTaskStatusUpdate(task: EditableTask): Promise<void> {
    const ref = this.drawer.open<StatusUpdateDrawerComponent, StatusUpdateDrawerData>(
      StatusUpdateDrawerComponent, {
        width:      '600px',
        styleClass: 'status-update-drawer',
        data: {
          target: 'task',
          job:    this.job,
          task:   task as StatusUpdateDrawerData['task'],
        },
      },
    );

    const result = await ref.afterClosed as StatusUpdateResult | null;
    if (result?.type === 'status-update' && result.taskId && result.status) {
      this.tasks = this.tasks.map(t =>
        t.id === result.taskId ? { ...t, status: result.status as TaskStatus } : t,
      );
      this.messageService.add({
        severity: 'success',
        summary:  'Task Updated',
        detail:   `Task status updated to "${result.status.replace('_', ' ')}".`,
      });
    }
  }

  updateTaskStatus(task: EditableTask, status: TaskStatus): void {
    task.status = status;
    this.tasks  = [...this.tasks];
  }

  removeTask(taskId: string): void {
    if (this.editingTaskId === taskId) { this.showAddTaskForm = false; this.editingTaskId = null; }
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    // Clamp page if it's now beyond the last page
    const maxPage = Math.max(0, this.taskPageCount - 1);
    if (this.taskPage > maxPage) this.taskPage = maxPage;
    this.messageService.add({ severity: 'info', summary: 'Task Removed', detail: 'Task has been removed.' });
  }
}

// ── Fallback mock ─────────────────────────────────────────────────────────────
const MOCK_JOB: ScopeJob = {
  id:                'SJ-004',
  title:             'Financial Controls Review — Apr 2025',
  scopeId:           'SC-001',
  scopeName:         'Financial Controls Review',
  company:           'Crowe UAE',
  division:          'Dubai',
  subDivision:       'Internal Audit',
  auditFrequency:    'monthly',
  modeOfAudit:       'full',
  periodLabel:       'Apr 2025',
  periodStart:       new Date('2025-04-01'),
  periodEnd:         new Date('2025-04-30'),
  assignedAuditors:  ['alice', 'bob'],
  assignedReviewers: ['emma'],
  status:            'in_progress',
  createdDate:       new Date('2025-01-01'),
  isActive:          true,
};