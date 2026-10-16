import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ButtonModule }    from 'primeng/button';
import { TextareaModule }  from 'primeng/textarea';
import { ToastModule }     from 'primeng/toast';
import { TooltipModule }   from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService }  from 'primeng/api';

import {
  ScopeJob,
  JobStatus,
  AuditFrequency,
} from '../scope-job-list/scope-job-list.component';
import {
  ScopeTask,
  TaskStatus,
  TaskPriority,
} from '../scope-job-details/scope-job-details.component';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// ── Types ─────────────────────────────────────────────────────────────────────
export type SuTarget        = 'job' | 'task';
export type SuControlRating = 'strong' | 'moderate' | 'weak';
export type OverallRating   = 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

export interface StatusUpdateTask extends ScopeTask {
  objective?:      string;
  controlRating?:  SuControlRating;
  checklistItems?: string[];
  startDate?:      Date;
  endDate?:        Date;
  observations?:   string;
}

export interface StatusUpdateDrawerData {
  target:  SuTarget;
  job:     ScopeJob;
  task?:   StatusUpdateTask;   // required when target === 'task'
  tasks?:  StatusUpdateTask[]; // for job target — task progress section
}

// Shared option shape — keeps statusOptions getter from returning a union type
export interface StatusOption {
  value: string;
  label: string;
  desc:  string;
  icon:  string;
}

export interface StatusUpdateResult {
  type:             'status-update';
  target:           SuTarget;
  status:           string;
  note:             string;
  auditOverview?:   string;
  timeSpentHours?:  number;
  overallRating?:   OverallRating;
  jobId?:           string;
  taskId?:          string;
}

// ── Auditor name map ──────────────────────────────────────────────────────────
const AUDITOR_NAMES: Record<string, string> = {
  alice: 'Alice Johnson', bob:   'Bob Smith',    carol: 'Carol White',
  david: 'David Lee',     emma:  'Emma Davis',   frank: 'Frank Miller',
  grace: 'Grace Wilson',  henry: 'Henry Brown',
};

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector:    'app-status-update-drawer',
  standalone:  true,
  imports: [
    CommonModule, ReactiveFormsModule,
    ButtonModule, TextareaModule, ToastModule, TooltipModule, InputTextModule,
  
    DrawIconComponent,],
  providers:   [MessageService],
  templateUrl: './scope-job-status-update.component.html',
  styleUrl:    './scope-job-status-update.component.scss',
})
export class StatusUpdateDrawerComponent implements OnInit {
  private readonly drawerRef = inject(DrawerRef);
  readonly         data      = inject(DRAWER_DATA, { optional: true }) as StatusUpdateDrawerData;
  private readonly fb        = inject(FormBuilder);
  private readonly msgSvc    = inject(MessageService);

  form!: FormGroup;
  submitted = false;

  // ── Status option tables ──────────────────────────────────────────────────
  readonly jobStatusOptions: StatusOption[] = [
    { value: 'pending',     label: 'Pending',     desc: 'Not yet started',            icon: 'pi-clock'              },
    { value: 'in_progress', label: 'In Progress', desc: 'Currently being worked on',  icon: 'pi-spin pi-spinner'    },
    { value: 'completed',   label: 'Completed',   desc: 'All tasks finished',          icon: 'pi-check-circle'       },
    { value: 'overdue',     label: 'Overdue',     desc: 'Past deadline, needs action', icon: 'pi-exclamation-circle' },
  ];

  readonly taskStatusOptions: StatusOption[] = [
    { value: 'open',        label: 'Open',        desc: 'Task is queued',             icon: 'pi-circle'             },
    { value: 'in_progress', label: 'In Progress', desc: 'Being worked on',            icon: 'pi-spin pi-spinner'    },
    { value: 'completed',   label: 'Completed',   desc: 'Task is finished',           icon: 'pi-check-circle'       },
    { value: 'overdue',     label: 'Overdue',     desc: 'Past due date',              icon: 'pi-exclamation-circle' },
  ];

  get statusOptions(): StatusOption[] {
    return this.data?.target === 'job' ? this.jobStatusOptions : this.taskStatusOptions;
  }

  readonly overallRatingOptions: { value: OverallRating; label: string; desc: string; icon: string }[] = [
    { value: 'satisfactory',      label: 'Satisfactory',      desc: 'Audit met all expectations',          icon: 'pi-check-circle'       },
    { value: 'needs_improvement', label: 'Needs Improvement', desc: 'Some areas require further attention', icon: 'pi-exclamation-circle' },
    { value: 'unsatisfactory',    label: 'Unsatisfactory',    desc: 'Did not meet required standards',      icon: 'pi-times-circle'       },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const initial = this.data?.target === 'job'
      ? this.data.job.status
      : (this.data?.task?.status ?? 'open');

    this.form = this.fb.group({
      status:          [initial, Validators.required],
      note:            ['', [Validators.required, Validators.maxLength(1000)]],
      auditOverview:   ['', Validators.maxLength(2000)],
      timeSpentHours:  [null as number | null],
      overallRating:   ['' as string],
    });

    // Set initial validator state, then keep in sync with status changes
    this._syncCompletionValidators(initial);
    this.form.get('status')!.valueChanges.subscribe(v => this._syncCompletionValidators(v));
  }

  private _syncCompletionValidators(status: string): void {
    const isCompleted = status === 'completed';

    const overviewCtrl = this.form.get('auditOverview')!;
    overviewCtrl.setValidators(
      isCompleted ? [Validators.required, Validators.maxLength(2000)] : [Validators.maxLength(2000)],
    );
    overviewCtrl.updateValueAndValidity({ emitEvent: false });

    const timeCtrl = this.form.get('timeSpentHours')!;
    timeCtrl.setValidators(
      isCompleted ? [Validators.required, Validators.min(0.1), Validators.max(99999)] : null,
    );
    timeCtrl.updateValueAndValidity({ emitEvent: false });

    const ratingCtrl = this.form.get('overallRating')!;
    ratingCtrl.setValidators(isCompleted ? [Validators.required] : null);
    ratingCtrl.updateValueAndValidity({ emitEvent: false });
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  get noteLength(): number          { return this.form.get('note')?.value?.length ?? 0; }
  get auditOverviewLength(): number { return this.form.get('auditOverview')?.value?.length ?? 0; }
  get currentAuditorId(): string    { return this.data?.job?.assignedAuditors?.[0] ?? 'alice'; }
  get isCompletedStatus(): boolean  { return this.form.get('status')?.value === 'completed'; }

  isStatusSelected(val: string): boolean { return this.form.get('status')?.value === val; }
  isRatingSelected(val: string): boolean { return this.form.get('overallRating')?.value === val; }

  setStatus(val: string): void {
    this.form.patchValue({ status: val });
    this.form.get('status')?.markAsTouched();
  }

  setRating(val: string): void {
    this.form.patchValue({ overallRating: val });
    this.form.get('overallRating')?.markAsTouched();
  }

  isFieldInvalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (this.submitted || ctrl.touched);
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  auditorName(id: string): string { return AUDITOR_NAMES[id] ?? id; }

  auditorInitials(id: string): string {
    return this.auditorName(id).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  statusLabel(s: JobStatus): string {
    return { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue' }[s] ?? s;
  }

  taskStatusLabel(s: TaskStatus): string {
    return { open: 'Open', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue' }[s] ?? s;
  }

  frequencyLabel(f: AuditFrequency): string {
    return { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' }[f] ?? f;
  }

  modeLabel(m: string): string {
    return { full: 'Full', limited: 'Limited', thematic: 'Thematic', 'follow-up': 'Follow-up', continuous: 'Continuous' }[m] ?? m;
  }

  priorityLabel(p: TaskPriority): string { return p.charAt(0).toUpperCase() + p.slice(1); }

  crLabel(r: SuControlRating): string {
    return { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' }[r] ?? r;
  }

  crIcon(r: SuControlRating): string {
    return { strong: 'pi-shield', moderate: 'pi-minus-circle', weak: 'pi-exclamation-triangle' }[r] ?? '';
  }

  get durationDays(): number {
    const ms = this.data.job.periodEnd.getTime() - this.data.job.periodStart.getTime();
    return Math.round(ms / 86_400_000) + 1;
  }

  get taskCounts() {
    const tasks = this.data?.tasks ?? [];
    return tasks.reduce(
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

  get completionPct(): number {
    const tasks = this.data?.tasks ?? [];
    return tasks.length ? Math.round((this.taskCounts.completed / tasks.length) * 100) : 0;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  onUpdate(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { status, note, auditOverview, timeSpentHours, overallRating } = this.form.value;
    const isJob = this.data.target === 'job';

    const result: StatusUpdateResult = {
      type:            'status-update',
      target:          this.data.target,
      status,
      note,
      auditOverview:   auditOverview   || undefined,
      timeSpentHours:  timeSpentHours  ?? undefined,
      overallRating:   (overallRating  || undefined) as OverallRating | undefined,
      jobId:           isJob ? this.data.job.id : undefined,
      taskId:          isJob ? undefined : this.data.task?.id,
    };

    this.msgSvc.add({
      severity: 'success',
      summary:  'Status Updated',
      detail:   `${isJob ? 'Job' : 'Task'} status set to "${isJob ? this.statusLabel(status) : this.taskStatusLabel(status)}".`,
    });

    this.drawerRef.close(result);
  }

  onCancel(): void { this.drawerRef.close(null); }
}