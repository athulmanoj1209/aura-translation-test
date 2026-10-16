import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import {
  FormBuilder, FormGroup, FormArray,
  Validators, ReactiveFormsModule, AbstractControl, ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, finalize, of, forkJoin, tap } from 'rxjs';

import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { SharedModule } from 'primeng/api';
import { AuditorAssignmentService } from '@/app/features/audits/audit-execution/auditor-assignment/services/auditor-assignment.service';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';

// CLIENT_MODE-aware source swap ─────────────────────────────────────────────
// When CLIENT_MODE_VALUE is 'internal-audit', Company/Division/Subdivision/
// Scope come from division-static-indi-org.data.ts (single org, DAR
// Exchange, auditing itself) instead of the multi-company ORG_STATIC_DATA
// seed used in 'audit-firm' mode. Both files nest company → divisions →
// subDivisions → scopes in the SAME shape (see OrgCompanySource below), so
// the rest of the cascade logic is unchanged — only which array it reads
// from switches.
//
// The real field names are `divisions`/`divisionName`/`subDivisions`/
// `subDivisionName`, which this component's `division`/`subdivision` form
// controls and labels now mirror directly.
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';
import { DIVISION_INDI_ORG_COMPANIES } from '@/app/features/audits/organization/divisions/division-static-indi-org.data';
import { SCOPE_INDI_ORG_COMPANIES } from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-indi-org.data';


// Common Company -> Division -> Subdivision -> Scope static data — the same
// file the Companies/Members pages and the Add Evidence / Add Observation /
// Add Finding / Add Recommendation / Add Working Paper forms read from —
// instead of the previous id-based CompanyDataService lookup (for Company)
// plus a single division derived from the company's `city` field (for
// Division) and a static Internal Audit/... list (for Subdivision). Audit
// Scope now cascades from the selected Subdivision's own real scopes
// instead of the unrelated static "Financial Reporting"/"IT General
// Controls"/... list this used to have. Option *values* are the real
// company/division/subdivision/scope *names* (matching every other page
// wired this session), and each level cascades off whatever is currently
// selected upstream via the company/division/subdivision valueChanges
// subscriptions in ngOnInit below.



// ── Interfaces ────────────────────────────────────────────────────────────────
export interface AuditorUser {
  id: number; name: string; email: string; role: string;
}

export interface AuditorAssignment {
  id: number;
  scope: string;
  type: 'preparer' | 'reviewer';
  auditorId: number;
}

/** `value` is `string` for Company/Division/Subdivision/Scope (real names
 *  sourced from company-org-data.ts) and `number` for Job (still local
 *  mock data keyed by numeric id). */
export interface SelectOption  { label: string; value: number | string; }
export interface ScopeOption   { label: string; value: string; }
export interface AuditorOption {
  label: string; value: number; role: string; email: string; initials: string;
}

export interface RowMeta {
  dbId: number | null;   // null = unsaved
  saving: boolean;
  deleting: boolean;
}

/** Minimal shape the Company → Division → Subdivision → Scope cascade below
 *  needs. Both ORG_STATIC_DATA (audit-firm mode, from company-org-data.ts)
 *  and DIVISION_INDI_ORG_COMPANIES (internal-audit mode, from
 *  division-static-indi-org.data.ts) satisfy it, so the cascade code
 *  doesn't need to know or care which one is active.
 *
 *  This mirrors the real field names used by both seed files —
 *  `divisions` / `divisionName` / `subDivisions` / `subDivisionName` —
 *  which this component's `division`/`subdivision` form controls and
 *  labels now match directly. */
interface OrgCompanySource {
  companyName: string;
  divisions: {
    divisionName: string;
    hasSubDivision?: boolean;
    scopes?: {
      scopeName: string;
      parentScopeId?: string | null;
      auditFrequency?: 'quarterly' | 'annually' | 'monthly';
    }[];
    subDivisions: {
      subDivisionName: string;
      /** `parentScopeId` only exists on the rich StaticScope records from
       *  audit-scope-static-indi-org.data.ts; the plain company-org-data
       *  scope shape simply omits it (so it's always falsy there, i.e.
       *  every entry counts as top-level). `auditFrequency` is common to
       *  both shapes. */
      scopes: {
        scopeName: string;
        parentScopeId?: string | null;
        auditFrequency?: 'quarterly' | 'annually' | 'monthly';
      }[];
    }[];
  }[];
}

/** Cross-field validator: ensures estimatedEnd is strictly after estimatedStart. */
export function jobDateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('estimatedStart')?.value;
  const end   = group.get('estimatedEnd')?.value;
  if (!start || !end) return null;                 // required-check handles empties
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return e > s ? null : { dateRange: true };
}

@Component({
  selector: 'app-auditor-assignment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectModule, MultiSelectModule, DatePickerModule, ButtonModule, SharedModule],
  templateUrl: './auditor-assignment.component.html',
  styleUrls: ['./auditor-assignment.component.scss'],
})
export class AuditorAssignmentComponent implements OnInit, OnDestroy {
  form!: FormGroup;

  preparerMeta: RowMeta[] = [];
  reviewerMeta: RowMeta[]  = [];

  divisionOptions: SelectOption[]    = [];
  subdivisionOptions: SelectOption[] = [];
  isSubDivisionRequired = false;
  auditorOptions: AuditorOption[]    = [];
  jobOptions: SelectOption[]         = [];

  /** Minimum selectable end date, kept in sync with the chosen start. */
  minEndDate: Date | null = null;

  loadingAssignments = false;
  loadingAuditors    = false;
  submitting         = false;
  submitSuccess      = false;
   private readonly confirmSvc = inject(ConfirmDialogService);

  /**
   * Company → Division → Subdivision → Scope source data, picked once per
   * CLIENT_MODE_VALUE (see client-mode.ts):
   *  - 'internal-audit' → DIVISION_INDI_ORG_COMPANIES, the single-org
   *    (DAR Exchange) seed from division-static-indi-org.data.ts.
   *  - 'audit-firm'      → ORG_STATIC_DATA, the existing multi-company seed.
   */
  private readonly orgData: OrgCompanySource[] = (
    CLIENT_MODE_VALUE === 'internal-audit' ? DIVISION_INDI_ORG_COMPANIES : ORG_STATIC_DATA
  ) as unknown as OrgCompanySource[];

  /**
   * Audit Scope source, looked up by the same company/division/subdivision
   * names once a Subdivision is picked (see the `subdivision` valueChanges
   * subscription below):
   *  - 'internal-audit' → SCOPE_INDI_ORG_COMPANIES, the richer per-scope
   *    seed from audit-scope-static-indi-org.data.ts (real scope IDs,
   *    tasks, workflow status, etc.) — replaces the plain
   *    {scopeName, scopeType, auditFrequency, riskRating} entries that used
   *    to come from DIVISION_INDI_ORG_COMPANIES for this mode. NOTE: this
   *    file hasn't been checked against OrgCompanySource — if Scope/Job
   *    still comes up empty after this fix, verify its divisions/
   *    subDivisions field names the same way DIVISION_INDI_ORG_COMPANIES
   *    was verified above.
   *  - 'audit-firm' → the same this.orgData used for the cascade above,
   *    unchanged.
   */
  private readonly scopeData: OrgCompanySource[] = (
    CLIENT_MODE_VALUE === 'internal-audit' ? SCOPE_INDI_ORG_COMPANIES : this.orgData
  ) as unknown as OrgCompanySource[];

  /**
   * Sourced from this.orgData (company-org-data.ts in audit-firm mode,
   * division-static-indi-org.data.ts in internal-audit mode) — instead of the
   * hardcoded placeholder list this used to have ("Crowe UAE", "Crowe KSA",
   * "Crowe Bahrain").
   */
  readonly companyOptions = computed<SelectOption[]>(() =>
    this.orgData
      .map(c => ({ label: c.companyName, value: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /** Audit Scope options — populated once a Subdivision is chosen, from
   *  that subdivision's own real scopes (see the `subdivision` valueChanges
   *  subscription in ngOnInit). Replaces the old static, unrelated list
   *  ("Financial Reporting", "IT General Controls", ...). */
  scopeOptions: ScopeOption[] = [];

  /** `auditFrequency` for every scope currently offered in scopeOptions,
   *  keyed by scope name — repopulated alongside scopeOptions in the
   *  `subdivision` valueChanges subscription below. Drives the Job list
   *  build in buildJobsForScope(), since Job is no longer a static lookup
   *  table (see allScopeJobs' old TODO) but generated from how often each
   *  selected scope is actually audited. */
  private scopeFrequencyByName = new Map<string, 'quarterly' | 'annually' | 'monthly' | undefined>();

  private static readonly MONTH_LABELS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private assignmentSvc: AuditorAssignmentService,
  ) {}

  // ── FormArray accessors ───────────────────────────────────────────────────
  get preparers(): FormArray { return this.form.get('preparers') as FormArray; }
  get reviewers(): FormArray  { return this.form.get('reviewers')  as FormArray; }
private readonly toast = inject(ToastService);
  asFormGroup(ctrl: AbstractControl): FormGroup { return ctrl as FormGroup; }

  /** Returns display label(s) for the selected scope(s) */
  get selectedScopeLabels(): string[] {
    const vals: string[] = this.form.get('scope')?.value ?? [];
    return vals.map(v => this.scopeOptions.find(s => s.value === v)?.label ?? v);
  }

  get selectedScopesCount(): number {
    return (this.form.get('scope')?.value ?? []).length;
  }

  isNew(meta: RowMeta[], i: number): boolean {
    return meta[i]?.dbId === null;
  }

  /** True when the job's estimated end is before/equal to the start. */
  get dateRangeInvalid(): boolean {
    const end = this.form.get('estimatedEnd');
    return !!(this.form.errors?.['dateRange'] && end && (end.dirty || end.touched));
  }

  /** Human-readable duration between start and end, e.g. "1d 4h 18m". Null when incomplete/invalid. */
  get estimatedDurationLabel(): string | null {
    const start = this.form?.get('estimatedStart')?.value;
    const end   = this.form?.get('estimatedEnd')?.value;
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(ms) || ms <= 0) return null;
    const totalMin = Math.floor(ms / 60000);
    const days  = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins  = totalMin % 60;
    const parts: string[] = [];
    if (days)  parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (mins || parts.length === 0) parts.push(`${mins}m`);
    return parts.join(' ');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAuditors();

    this.form = this.fb.group({
      company:        [null, Validators.required],
      division:       [{ value: null, disabled: true }, Validators.required],
      subdivision:    [{ value: null, disabled: true }, Validators.required],
      scope:          [{ value: null, disabled: true }, Validators.required],
      job:            [{ value: null, disabled: true }, Validators.required],
      estimatedStart: [{ value: null, disabled: true }, Validators.required],
      estimatedEnd:   [{ value: null, disabled: true }, Validators.required],
      preparers:      this.fb.array([]),
      reviewers:      this.fb.array([]),
    }, { validators: jobDateRangeValidator });

    this.form.get('company')!.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((companyName: string | null) => {
        this.resetFrom('division');
        this.divisionOptions = this.subdivisionOptions = [];
        if (companyName) {
          // Division narrows to the selected company's real divisions from
          // this.orgData, sourced directly from the seed data's own
          // "divisions" field (see OrgCompanySource above).
          const company = this.orgData.find(c => c.companyName === companyName);
          this.divisionOptions = (company?.divisions ?? [])
            .map(d => ({ label: d.divisionName, value: d.divisionName }))
            .sort((a, b) => a.label.localeCompare(b.label));
          this.form.get('division')!.enable();
        }
      });

    this.form.get('division')!.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((divisionName: string | null) => {
        this.resetFrom('subdivision');
        this.subdivisionOptions = [];
        this.isSubDivisionRequired = false;
        if (divisionName) {
          // Subdivision narrows to the selected company + division's real
          // sub-divisions, sourced from the seed data's own "subDivisions"
          // field.
          const companyName = this.form.get('company')!.value;
          const company = this.orgData.find(c => c.companyName === companyName);
          const division = company?.divisions.find(d => d.divisionName === divisionName);
          this.isSubDivisionRequired = division?.hasSubDivision !== false;
          if (division?.hasSubDivision === false) {
            // This division owns its scopes directly; sub-division is not
            // applicable and must remain empty.
            this.form.get('subdivision')!.reset(null, { emitEvent: false });
            this.form.get('subdivision')!.disable({ emitEvent: false });
            this.populateScopeOptions(division.scopes ?? []);
          } else {
            this.subdivisionOptions = (division?.subDivisions ?? [])
              .map(sd => ({ label: sd.subDivisionName, value: sd.subDivisionName }))
              .sort((a, b) => a.label.localeCompare(b.label));
            this.form.get('subdivision')!.enable();
          }
        }
      });

    this.form.get('subdivision')!.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((subdivisionName: string | null) => {
        this.resetFrom('scope');
        this.scopeOptions = [];
        this.scopeFrequencyByName = new Map();
        if (subdivisionName) {
          // Audit Scope narrows to the selected subdivision's own real
          // scopes, sourced from this.scopeData. Sub-scopes — rich
          // StaticScope entries with a non-null parentScopeId, e.g. the 3
          // AML/CFT sub-scopes nested under "AML/CFT Compliance" — are
          // internal task groupings, not independently selectable audit
          // scopes, so they're filtered out; only top-level scopes are
          // offered.
          const companyName = this.form.get('company')!.value;
          const divisionName = this.form.get('division')!.value;
          const company = this.scopeData.find(c => c.companyName === companyName);
          const division = company?.divisions.find(d => d.divisionName === divisionName);
          const subdivision = division?.subDivisions.find(sd => sd.subDivisionName === subdivisionName);
          this.populateScopeOptions(subdivision?.scopes ?? []);
        } else {
          this.form.get('scope')!.disable();
        }
      });

    this.form.get('scope')!.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((scopes: string[] | null) => {
        this.clearAll();
        this.updateJobOptions(scopes);
        if (scopes?.length) this.loadAssignments(scopes);
      });

    // Enable the estimation pickers only once a job is chosen.
    this.form.get('job')!.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((jobId: number | string | null) => {
        if (jobId != null) {
          this.form.get('estimatedStart')!.enable();
          this.form.get('estimatedEnd')!.enable();
        } else {
          this.resetEstimation();
        }
      });

    // Keep the end picker's minimum in sync with the chosen start.
    this.form.get('estimatedStart')!.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((start: Date | null) => {
        this.minEndDate = start ? new Date(start) : null;
      });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── DB operations ─────────────────────────────────────────────────────────

  private loadAuditors(): void {
    const MOCK: AuditorUser[] = [
      { id: 1, name: 'Ahmed Al Mansoori', email: 'ahmed.m@crowe.ae', role: 'Senior Auditor' },
      { id: 2, name: 'Sara Al Hashimi',   email: 'sara.h@crowe.ae',  role: 'Audit Manager'  },
      { id: 3, name: 'Khalid Ibrahim',    email: 'khalid.i@crowe.ae', role: 'Senior Auditor' },
      { id: 4, name: 'Fatima Al Zaabi',   email: 'fatima.z@crowe.ae', role: 'Audit Partner'  },
      { id: 5, name: 'Omar Qassim',       email: 'omar.q@crowe.ae',  role: 'Audit Manager'  },
      { id: 6, name: 'Nour Al Rashed',    email: 'nour.r@crowe.ae',  role: 'Senior Auditor' },
    ];
    this.loadingAuditors = true;
    // TODO: swap → this.assignmentSvc.getAuditors()
    of(MOCK).pipe(finalize(() => (this.loadingAuditors = false))).subscribe({
      next: (users) => {
        this.auditorOptions = users.map(u => ({
          label: u.name, value: u.id, role: u.role, email: u.email,
          initials: u.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
        }));
      },
    });
  }

  /** Recomputes the Job dropdown options for the currently selected
   *  scope(s), generating them from each scope's own audit frequency
   *  (see buildJobsForScope) instead of matching against a static, mostly
   *  unrelated allScopeJobs list. */
  private updateJobOptions(scopes: string[] | null): void {
    this.form.get('job')!.reset(null);
    this.resetEstimation();
    if (scopes?.length) {
      // TODO: swap → this.assignmentSvc.getJobsByScope(scopes)
      this.jobOptions = scopes.flatMap(scopeName => this.buildJobsForScope(scopeName));
      this.form.get('job')!.enable();
    } else {
      this.jobOptions = [];
      this.form.get('job')!.disable();
    }
  }

  /**
   * One Job option per natural period implied by the scope's own
   * auditFrequency (from scopeFrequencyByName, stashed when the
   * Subdivision was chosen):
   *  - 'monthly'  → 12 jobs, one per calendar month (Jan–Dec)
   *  - 'quarterly' → 4 jobs, one per quarter (Q1–Q4)
   *  - 'annually'  → 1 job, the annual audit
   *  - unknown/missing frequency → 1 generic job, so Job stays usable
   *    even for a scope whose seed data doesn't set auditFrequency
   */
  private buildJobsForScope(scopeName: string): SelectOption[] {
    const frequency = this.scopeFrequencyByName.get(scopeName);

    if (frequency === 'monthly') {
      return AuditorAssignmentComponent.MONTH_LABELS.map((month, i) => ({
        label: `${scopeName} – ${month} Review`,
        value: `${scopeName}::M${i + 1}`,
      }));
    }
    if (frequency === 'quarterly') {
      return [1, 2, 3, 4].map(q => ({
        label: `${scopeName} – Q${q} Review`,
        value: `${scopeName}::Q${q}`,
      }));
    }
    if (frequency === 'annually') {
      return [{ label: `${scopeName} – Annual Audit`, value: `${scopeName}::ANNUAL` }];
    }
    return [{ label: scopeName, value: scopeName }];
  }

  private loadAssignments(scopes: string[]): void {
    this.loadingAssignments = true;

    // Mock: load assignments for all selected scopes, then deduplicate by type+auditorId
    // TODO: swap forkJoin calls → this.assignmentSvc.getByScope(scope) per scope
    const allCalls = scopes.map(scope =>
      of<AuditorAssignment[]>([
        { id: 101, scope, type: 'preparer', auditorId: 1 },
        { id: 102, scope, type: 'preparer', auditorId: 3 },
        { id: 103, scope, type: 'reviewer', auditorId: 2 },
        { id: 104, scope, type: 'reviewer', auditorId: 4 },
        { id: 105, scope, type: 'reviewer', auditorId: 5 },
      ])
    );

    forkJoin(allCalls)
      .pipe(finalize(() => (this.loadingAssignments = false)))
      .subscribe({
        next: (results) => {
          this.clearAll();
          const merged = results.flat();
          // Deduplicate: keep one entry per type+auditorId combination
          const seen = new Set<string>();
          const unique = merged.filter(r => {
            const key = `${r.type}:${r.auditorId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          unique.filter(r => r.type === 'preparer').forEach(r => this.pushRow('preparer', r.id, r.auditorId));
          unique.filter(r => r.type === 'reviewer').forEach(r => this.pushRow('reviewer', r.id, r.auditorId));
        },
        error: () => {},
      });
  }

  addRow(type: 'preparer' | 'reviewer'): void {
    this.submitSuccess = false;
    this.pushRow(type, null, null);
  }

  /** Batch-save all unsaved rows for every selected scope on Submit */
  async onSubmit():  Promise<void> {
    const scopes: string[] = this.form.get('scope')?.value ?? [];
    if (!scopes.length) return;

    // Job is mandatory once scope(s) are chosen.
    const jobCtrl = this.form.get('job')!;
    jobCtrl.markAsTouched();
    if (jobCtrl.enabled && jobCtrl.invalid) return;

    // Validate the job time-estimation before proceeding.
    const startCtrl = this.form.get('estimatedStart')!;
    const endCtrl   = this.form.get('estimatedEnd')!;
    startCtrl.markAsTouched();
    endCtrl.markAsTouched();
    if (startCtrl.enabled && (startCtrl.invalid || endCtrl.invalid || this.form.errors?.['dateRange'])) return;

const confirmed = await this.confirmSvc.confirm({
      title:        'Confirm Assignment',
      message:      'Are you sure you want to save these assignments? The submitter will be notified.',
      action:       'approve',
      confirmLabel: 'Yes, Proceed',
    });
    if (!confirmed) return;
     this.toast.success('Auditors assigned successfully.');
   this.onReset();

    type PendingItem = { type: 'preparer' | 'reviewer'; index: number; grp: FormGroup; meta: RowMeta };

    const pending: PendingItem[] = [
      ...this.preparers.controls.map((c, i) => ({
        type: 'preparer' as const, index: i,
        grp: this.asFormGroup(c), meta: this.preparerMeta[i],
      })),
      ...this.reviewers.controls.map((c, i) => ({
        type: 'reviewer' as const, index: i,
        grp: this.asFormGroup(c), meta: this.reviewerMeta[i],
      })),
    ].filter(item => item.meta.dbId === null);

    pending.forEach(item => item.grp.markAllAsTouched());
    if (pending.some(item => item.grp.invalid)) return;

    if (pending.length === 0) { this.submitSuccess = true; return; }

    this.submitting = true;


    const estimatedStart: Date | null = this.form.get('estimatedStart')!.value;
    const estimatedEnd:   Date | null = this.form.get('estimatedEnd')!.value;
    const jobId:          number | string | null = this.form.get('job')!.value;

    // Fan out: one create call per (scope × pending auditor)
    const calls = pending.flatMap((item, idx) =>
      scopes.map(scope => {
        const auditorId = item.grp.value.auditorId;
        const MOCK: AuditorAssignment = { id: Date.now() + idx, scope, type: item.type, auditorId };
        // TODO: swap → this.assignmentSvc.create({ scope, type: item.type, auditorId, jobId, estimatedStart, estimatedEnd })
        return of(MOCK).pipe(
          tap(created => {
            // Mark dbId only on last scope so the row flips to "saved" once all are done
            if (scope === scopes[scopes.length - 1]) { item.meta.dbId = created.id; }
          })
        );
      })
    );

    forkJoin(calls)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => { this.submitSuccess = true; },
        error: () => {},
      });


  }

  removeRow(type: 'preparer' | 'reviewer', index: number): void {
    const arr  = type === 'preparer' ? this.preparers : this.reviewers;
    const meta = type === 'preparer' ? this.preparerMeta : this.reviewerMeta;
    const m    = meta[index];

    if (m.dbId === null) { this.spliceRow(type, index); return; }

    m.deleting = true;
    // TODO: swap → this.assignmentSvc.delete(m.dbId)
    of(void 0).pipe(finalize(() => (m.deleting = false)))
      .subscribe({ next: () => this.spliceRow(type, index) });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private pushRow(type: 'preparer' | 'reviewer', dbId: number | null, auditorId: number | null): void {
    const arr  = type === 'preparer' ? this.preparers : this.reviewers;
    const meta = type === 'preparer' ? this.preparerMeta : this.reviewerMeta;
    arr.push(this.fb.group({ auditorId: [auditorId, Validators.required] }));
    meta.push({ dbId, saving: false, deleting: false });
  }

  private spliceRow(type: 'preparer' | 'reviewer', index: number): void {
    const arr  = type === 'preparer' ? this.preparers : this.reviewers;
    const meta = type === 'preparer' ? this.preparerMeta : this.reviewerMeta;
    arr.removeAt(index);
    meta.splice(index, 1);
  }

  private clearAll(): void {
    this.preparers.clear(); this.preparerMeta = [];
    this.reviewers.clear(); this.reviewerMeta  = [];
  }

  /** Resets and disables the job time-estimation fields. */
  private resetEstimation(): void {
    this.minEndDate = null;
    ['estimatedStart', 'estimatedEnd'].forEach(c => {
      this.form.get(c)!.reset(null);
      this.form.get(c)!.disable();
    });
  }

  private resetFrom(fromControl: string): void {
    const chain = ['division', 'subdivision', 'scope', 'job'];
    chain.slice(chain.indexOf(fromControl)).forEach(c => {
      this.form.get(c)!.reset(null);
      if (c !== fromControl) this.form.get(c)!.disable();
    });
    this.jobOptions = [];
    this.resetEstimation();
    this.clearAll();
  }

  private populateScopeOptions(scopes: {
    scopeName: string;
    parentScopeId?: string | null;
    auditFrequency?: 'quarterly' | 'annually' | 'monthly';
  }[]): void {
    const topLevelScopes = scopes.filter(s => !s.parentScopeId);
    this.scopeOptions = topLevelScopes
      .map(s => ({ label: s.scopeName, value: s.scopeName }))
      .sort((a, b) => a.label.localeCompare(b.label));
    this.scopeFrequencyByName = new Map(topLevelScopes.map(s => [s.scopeName, s.auditFrequency]));
    this.form.get('scope')!.enable();
  }

  getAuditorOption(id: number | null): AuditorOption | undefined {
    return id != null ? this.auditorOptions.find(a => a.value === id) : undefined;
  }

  isInvalid(controlName: string, group?: FormGroup): boolean {
    const ctrl = group ? group.get(controlName) : this.form.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  getError(controlName: string, label: string, group?: FormGroup): string | null {
    const ctrl = group ? group.get(controlName) : this.form.get(controlName);
    if (!ctrl || !ctrl.invalid || !(ctrl.dirty || ctrl.touched)) return null;
    if (ctrl.errors?.['required']) return `${label} is required`;
    return null;
  }

  get hasScopeSelected(): boolean {
    return (this.form.get('scope')?.value ?? []).length > 0;
  }

  onReset(): void {
    this.form.reset();
    this.clearAll();
    ['division', 'subdivision', 'scope', 'job', 'estimatedStart', 'estimatedEnd'].forEach(c => this.form.get(c)!.disable());
    this.divisionOptions = this.subdivisionOptions = this.jobOptions = [];
    this.minEndDate = null;
    this.submitSuccess = false;
  }
}
