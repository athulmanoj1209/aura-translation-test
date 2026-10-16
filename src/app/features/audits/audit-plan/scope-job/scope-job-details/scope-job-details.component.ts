import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import {
  ScopeJob, AuditFrequency, JobStatus,
  AuditorProfile, ReviewerProfile,
  AUDITOR_REGISTRY, REVIEWER_REGISTRY,
  MOCK_SCOPE_JOBS,
} from '../scope-job-list/scope-job-list.component';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { DRAWER_DATA, DrawerRef } from '../../../../../shared/components/drawer-ref';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

export interface ScopeJobProfileDrawerData {
  job: ScopeJob;
}

// ── Task types ───────────────────────────────────────────────────────────────
export type TaskStatus   = 'open' | 'in_progress' | 'completed' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ScopeTask {
  id:          string;
  title:       string;
  description: string;
  assignedTo:  string;
  dueDate:     Date;
  status:      TaskStatus;
  priority:    TaskPriority;
}

/* ── Re-export types so the template can reference them ── */
export type { AuditorProfile, ReviewerProfile };

// ── Sub-scope display types ───────────────────────────────────────────────────
export type SubScopeRisk = 'high' | 'medium' | 'low';

export interface SubScopeItem {
  name:     string;
  category: string;
  risk:     SubScopeRisk;
}

// ── Task template definitions ─────────────────────────────────────────────────
const TASK_TEMPLATES: { title: string; description: string; priority: TaskPriority }[] = [
  { title: 'Planning & Scoping',         description: 'Define audit scope, objectives, and risk areas for the period.',           priority: 'high'     },
  { title: 'Risk Assessment',            description: 'Identify and evaluate inherent and control risks.',                        priority: 'high'     },
  { title: 'Control Walkthrough',        description: 'Walk through key internal controls with process owners.',                  priority: 'medium'   },
  { title: 'Fieldwork Execution',        description: 'Perform substantive testing and evidence collection.',                     priority: 'high'     },
  { title: 'Evidence Documentation',     description: 'Document all working papers and audit evidence in the repository.',       priority: 'medium'   },
  { title: 'Control Testing',            description: 'Test design and operating effectiveness of selected controls.',            priority: 'medium'   },
  { title: 'Draft Report Preparation',   description: 'Prepare draft findings, recommendations, and management responses.',      priority: 'medium'   },
  { title: 'Management Review',          description: 'Obtain management sign-off on draft findings and action plans.',          priority: 'low'      },
  { title: 'Final Report Issuance',      description: 'Issue the final audit report to relevant stakeholders.',                  priority: 'low'      },
  { title: 'Follow-up & Closure',        description: 'Track implementation of management action plans and close findings.',     priority: 'low'      },
];

/** Generate deterministic mock tasks for a given job */
export function generateTasksForJob(job: ScopeJob): ScopeTask[] {
  const seed  = job.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const count = 4 + (seed % 3);  // 4, 5, or 6
  const templates = TASK_TEMPLATES.slice(0, count);

  const start  = job.periodStart.getTime();
  const end    = job.periodEnd.getTime();
  const span   = (end - start) / (count + 1);
  const now    = Date.now();

  return templates.map((t, i) => {
    const dueDate     = new Date(start + span * (i + 1));
    const isPast      = dueDate.getTime() < now;
    const auditors    = job.assignedAuditors;
    const assignedTo  = auditors[i % auditors.length];

    let status: TaskStatus;
    if (job.status === 'pending') {
      status = 'open';
    } else if (job.status === 'completed') {
      status = 'completed';
    } else if (isPast) {
      status = i < count - 2 ? 'completed' : (job.status === 'overdue' ? 'overdue' : 'completed');
    } else {
      status = i === count - (count > 4 ? 2 : 1) ? 'in_progress' : 'open';
    }

    return {
      id:          `${job.id}-T${String(i + 1).padStart(2, '0')}`,
      title:       t.title,
      description: t.description,
      assignedTo,
      dueDate,
      status,
      priority:    t.priority,
    };
  });
}

/**
 * Count of generated tasks (across every scope job) assigned to the given
 * auditor in the given bucket — a specific TaskStatus, or 'due-today'.
 * Used by both the auditor overview KPI cards and the Task Status chart,
 * so both always report the exact same numbers for the same status.
 */
export function countTasksForAuditor(auditorId: string, bucket: TaskStatus | 'due-today'): number {
  const tasks = MOCK_SCOPE_JOBS.flatMap(generateTasksForJob).filter(t => t.assignedTo === auditorId);

  if (bucket === 'due-today') {
    const today = new Date();
    return tasks.filter(t =>
      t.status !== 'completed' &&
      t.dueDate.getFullYear() === today.getFullYear() &&
      t.dueDate.getMonth() === today.getMonth() &&
      t.dueDate.getDate() === today.getDate(),
    ).length;
  }

  return tasks.filter(t => t.status === bucket).length;
}

export interface AuditorTaskRow {
  task: string;
  scope: string;
  priority: string;
  status: string;
  dueDate: string;
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

function formatTaskDueDate(d: Date): string {
  const startOfDay = (x: Date) => { const c = new Date(x); c.setHours(0, 0, 0, 0); return c.getTime(); };
  const today = startOfDay(new Date());
  const tomorrow = today + 24 * 60 * 60 * 1000;
  const due = startOfDay(d);
  if (due === today) return 'Today';
  if (due === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Every generated task assigned to the given auditor, shaped for the
 * auditor-my-audits-scopes tab's "My Tasks" table.
 */
export function getTaskRowsForAuditor(auditorId: string): AuditorTaskRow[] {
  return MOCK_SCOPE_JOBS.flatMap(job =>
    generateTasksForJob(job)
      .filter(t => t.assignedTo === auditorId)
      .map(t => ({
        task: t.title,
        scope: job.scopeName,
        priority: t.priority === 'low' ? 'Low' : t.priority === 'medium' ? 'Medium' : 'High',
        status: TASK_STATUS_LABELS[t.status],
        dueDate: formatTaskDueDate(t.dueDate),
      })),
  );
}

@Component({
  selector: 'app-scope-job-profile',
  standalone: true,
  imports: [CommonModule, DatePipe, TagModule, TooltipModule, ButtonModule, DrawIconComponent],
  templateUrl: './scope-job-details.component.html',
  styleUrl:    './scope-job-details.component.scss',
})
export class ScopeJobProfileComponent implements OnInit {
  private readonly drawerRef = inject(DrawerRef);
  protected readonly data    = inject(DRAWER_DATA, { optional: true }) as ScopeJobProfileDrawerData | null;

  job!:   ScopeJob;
  tasks:  ScopeTask[] = [];

  // ── Hero helpers ───────────────────────────────────────────────────────────
  /** big initials block in the gradient header (from the scope name) */
  get scopeInitials(): string {
    return this.job.scopeName
      .split(/\s+/)
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /** total team members for the stat card / Team section count */
  get teamSize(): number {
    return (this.job.assignedAuditors?.length ?? 0) + (this.job.assignedReviewers?.length ?? 0);
  }

  // ── Task pagination ────────────────────────────────────────────────────────
  readonly taskPageSize = 5;
  taskPage = 0;

  get pagedTasks(): ScopeTask[] {
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

  /** Page numbers to show; -1 = ellipsis placeholder */
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

  // ── Personnel expand / collapse ────────────────────────────────────────────
  auditorsExpanded  = false;
  reviewersExpanded = false;

  toggleAuditors(): void  { this.auditorsExpanded  = !this.auditorsExpanded; }
  toggleReviewers(): void { this.reviewersExpanded = !this.reviewersExpanded; }

  // ── Personnel pagination ───────────────────────────────────────────────────
  readonly personPageSize = 3;
  auditorPage  = 0;
  reviewerPage = 0;

  get pagedAuditors(): string[] {
    const start = this.auditorPage * this.personPageSize;
    return this.job.assignedAuditors.slice(start, start + this.personPageSize);
  }

  get auditorPageCount(): number {
    return Math.max(1, Math.ceil(this.job.assignedAuditors.length / this.personPageSize));
  }

  get auditorPages(): number[] {
    return Array.from({ length: this.auditorPageCount }, (_, i) => i);
  }

  get auditorPageRange(): string {
    const start = this.auditorPage * this.personPageSize + 1;
    const end   = Math.min((this.auditorPage + 1) * this.personPageSize, this.job.assignedAuditors.length);
    return `${start}–${end}`;
  }

  prevAuditorPage(): void { if (this.auditorPage > 0) this.auditorPage--; }
  nextAuditorPage(): void { if (this.auditorPage < this.auditorPageCount - 1) this.auditorPage++; }
  goToAuditorPage(n: number): void { this.auditorPage = n; }

  get pagedReviewers(): string[] {
    const start = this.reviewerPage * this.personPageSize;
    return this.job.assignedReviewers.slice(start, start + this.personPageSize);
  }

  get reviewerPageCount(): number {
    return Math.max(1, Math.ceil(this.job.assignedReviewers.length / this.personPageSize));
  }

  get reviewerPages(): number[] {
    return Array.from({ length: this.reviewerPageCount }, (_, i) => i);
  }

  get reviewerPageRange(): string {
    const start = this.reviewerPage * this.personPageSize + 1;
    const end   = Math.min((this.reviewerPage + 1) * this.personPageSize, this.job.assignedReviewers.length);
    return `${start}–${end}`;
  }

  prevReviewerPage(): void { if (this.reviewerPage > 0) this.reviewerPage--; }
  nextReviewerPage(): void { if (this.reviewerPage < this.reviewerPageCount - 1) this.reviewerPage++; }
  goToReviewerPage(n: number): void { this.reviewerPage = n; }

  // ── Sub-scopes ─────────────────────────────────────────────────────────────
  subscopeQuery = '';

  onSubscopeSearch(e: Event): void {
    this.subscopeQuery = (e.target as HTMLInputElement).value;
  }

  /** Deterministic mock risk level derived from the sub-scope name */
  private subscopeRisk(name: string): SubScopeRisk {
    const seed = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return (['high', 'medium', 'low'] as const)[seed % 3];
  }

  get subscopeItems(): SubScopeItem[] {
    return (this.job.subscopes ?? []).map(name => ({
      name,
      category: 'Departmental',
      risk: this.subscopeRisk(name),
    }));
  }

  get filteredSubscopes(): SubScopeItem[] {
    const q = this.subscopeQuery.trim().toLowerCase();
    if (!q) return this.subscopeItems;
    return this.subscopeItems.filter(s => s.name.toLowerCase().includes(q));
  }

  riskLabel(r: SubScopeRisk): string {
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  ngOnInit(): void {
    this.job   = this.data?.job ?? MOCK_JOB;
    this.tasks = generateTasksForJob(this.job);
  }

  // ── Job display helpers ──────────────────────────────────────────────────

  get statusLabel(): string {
    const map: Record<JobStatus, string> = {
      pending:     'Pending',
      in_progress: 'In Progress',
      completed:   'Completed',
      overdue:     'Overdue',
    };
    return map[this.job.status];
  }

  get frequencyLabel(): string {
    const map: Record<AuditFrequency, string> = {
      monthly:   'Monthly',
      quarterly: 'Quarterly',
      annually:  'Annually',
    };
    return map[this.job.auditFrequency];
  }

  get modeLabel(): string {
    const map: Record<string, string> = {
      full:        'Full',
      limited:     'Limited',
      thematic:    'Thematic',
      'follow-up': 'Follow-up',
      continuous:  'Continuous',
    };
    return map[this.job.modeOfAudit] ?? this.job.modeOfAudit;
  }

  get durationDays(): number {
    const ms = this.job.periodEnd.getTime() - this.job.periodStart.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
  }

  get progressPct(): number {
    const now   = Date.now();
    const start = this.job.periodStart.getTime();
    const end   = this.job.periodEnd.getTime();
    if (now <= start) return 0;
    if (now >= end)   return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  // ── Task helpers ─────────────────────────────────────────────────────────

  taskStatusLabel(s: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      open:        'Open',
      in_progress: 'In Progress',
      completed:   'Completed',
      overdue:     'Overdue',
    };
    return map[s];
  }

  taskStatusIcon(s: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      open:        'pi-circle',
      in_progress: 'pi-spin pi-spinner',
      completed:   'pi-check-circle',
      overdue:     'pi-exclamation-circle',
    };
    return map[s];
  }

  taskPriorityLabel(p: TaskPriority): string {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  get taskCounts(): { completed: number; inProgress: number; open: number; overdue: number } {
    return this.tasks.reduce(
      (acc, t) => {
        if (t.status === 'completed')   acc.completed++;
        else if (t.status === 'in_progress') acc.inProgress++;
        else if (t.status === 'overdue')     acc.overdue++;
        else                                 acc.open++;
        return acc;
      },
      { completed: 0, inProgress: 0, open: 0, overdue: 0 },
    );
  }

  get taskCompletionPct(): number {
    if (!this.tasks.length) return 0;
    return Math.round((this.taskCounts.completed / this.tasks.length) * 100);
  }

  // ── Shared helpers ───────────────────────────────────────────────────────

  auditorProfile(id: string): AuditorProfile | undefined {
    return AUDITOR_REGISTRY[id];
  }

  reviewerProfile(id: string): ReviewerProfile | undefined {
    return REVIEWER_REGISTRY[id];
  }

  auditorName(id: string): string {
    return AUDITOR_REGISTRY[id]?.name ?? REVIEWER_REGISTRY[id]?.name ?? id;
  }

  auditorInitials(id: string): string {
    return AUDITOR_REGISTRY[id]?.initials
      ?? REVIEWER_REGISTRY[id]?.initials
      ?? id.replace(/\./g, '').slice(0, 2).toUpperCase();
  }

  onClose(): void {
    this.drawerRef.close(null);
  }
}

/* ── Fallback mock ── */
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
  objective:         'Assess the design and operating effectiveness of key financial controls across revenue, expenditure, and payroll cycles to ensure accuracy and completeness of financial reporting.',
  subscopes:         ['Revenue Cycle Controls', 'Expenditure & AP Controls', 'Payroll Verification', 'Journal Entry Review'],
};