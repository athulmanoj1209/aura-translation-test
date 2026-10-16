import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';

import { ActivatedRoute, Router } from '@angular/router';
import { AuditPlanStore } from '@/app/features/audits/audit-plan/audit-plan/audit-plan.store';
import { FREQ_LABELS, Frequency, InstanceStatus, MONTHS, PlanView, STATUS_META } from '@/app/features/audits/audit-plan/audit-plan/models/audit-plan.model';

import { MonthCalendarComponent } from '@/app/features/audits/audit-plan/audit-plan/month-calendar';
import { SubDivisionViewComponent } from '@/app/features/audits/audit-plan/audit-plan/department-view';
import { ScopeDetailComponent } from '@/app/features/audits/audit-plan/audit-plan/scope-detail';
import { ExecutionLogComponent } from '@/app/features/audits/audit-plan/audit-plan/execution-log';

import { AnnualOverviewComponent } from '@/app/features/audits/audit-plan/audit-plan/annual-overview';
import { InstanceDialogComponent } from '@/app/features/audits/audit-plan/audit-plan/audit-details-by-scope';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';


interface LevelTab { id: PlanView; num: number; label: string; }

/** Scope-management status values (matches AuditScopeManagementListComponent.statusOptions). */
type ScopeMgmtStatus = 'Not Started' | 'Planned' | 'In Progress' | 'Overdue' | 'Completed';

/** Scope-job status values (matches ScopeJobListComponent.statusOptions). */
type JobStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

@Component({
  selector: 'app-audit-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AuditPlanStore], // isolated state per page instance
  imports: [
    ReactiveFormsModule, ButtonModule, MultiSelectModule, InputTextModule,
    IconFieldModule, InputIconModule, SkeletonModule,
    AnnualOverviewComponent, MonthCalendarComponent, SubDivisionViewComponent,
    ScopeDetailComponent, ExecutionLogComponent, InstanceDialogComponent,
  
    DrawIconComponent,],
  templateUrl: './audit-plan.component.html',
  styleUrl: './audit-plan.component.scss',
})
export class AuditPlanComponent implements OnInit {
  readonly store = inject(AuditPlanStore);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);

  /** NOTE: adjust to the real route paths where these pages are registered. */
  private readonly scopeRoute = '/audits/audit-plan/audit-scope';
  private readonly jobRoute   = '/audits/audit-plan/scope-jobs';

  /** Dark theme toggle — scoped to this page only (see `host` binding above).
      Remembered per-browser so it stays on when the user comes back, but it
      never touches any app-wide theme state. Guards on `typeof localStorage`
      so this stays safe if the app is ever rendered with SSR. */
  private readonly darkThemeStorageKey = 'audit-plan.dark-theme';
  readonly darkMode = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem(this.darkThemeStorageKey) === '1'
  );

  toggleDarkMode(): void {
    this.darkMode.update(v => !v);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.darkThemeStorageKey, this.darkMode() ? '1' : '0');
    }
  }

  /** Company name passed in from the selector page's query params
      (?companyName=...). Drives the top-bar label in place of a hardcoded
      product/company name. Falls back to a generic label when the page is
      opened without one (e.g. direct nav, refresh losing query params). */
  readonly companyName = signal<string>('');

  /** Top-bar label: "<Company> · Audit Platform", or just "Audit Platform"
      when no company name is available. */
  readonly headerLabel = computed(() => {
    const name = this.companyName().trim();
    return name ? `${name} · Audit Platform` : 'Audit Platform';
  });

  /** Two-letter glyph shown next to the top-bar label, derived from the
      company name's initials (first letters of up to its first two words). */
  readonly companyInitials = computed(() => {
    const words = this.companyName().trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
    return initials || 'AP';
  });

  readonly tabs: LevelTab[] = [
    { id: 'annual',      num: 1, label: 'Annual Overview' },
    { id: 'calendar',    num: 2, label: 'Month Calendar' },
    { id: 'departments', num: 3, label: 'Sub-Division View' },
    { id: 'scope',       num: 4, label: 'Scope Detail' },
    { id: 'log',         num: 5, label: 'Execution Log' },
  ];
  readonly months = MONTHS;

  readonly freqOptions = (Object.entries(FREQ_LABELS) as [Frequency, string][])
    .map(([value, label]) => ({ value, label }));
  readonly statusOptions = (Object.entries(STATUS_META) as [InstanceStatus, { label: string }][])
    .map(([value, meta]) => ({ value, label: meta.label }));

  /** typed reactive filter form — multi-select filters hold arrays */
  readonly filterForm = this.fb.nonNullable.group({
    subDivision: [[] as string[]],
    freq: [[] as Frequency[]],
    status: [[] as InstanceStatus[]],
    search: '',
  });

  ngOnInit(): void {
    // ── Company pre-selection from selector page ─────────────────────────
    const companyId   = this.route.snapshot.queryParamMap.get('company') ?? undefined;
    const companyName = this.route.snapshot.queryParamMap.get('companyName');

    // Load data for the selected company (store forwards it to the API)
    this.store.loadYear(this.store.year(), companyId);

    // If arriving from the selector, jump straight to Sub-Division View
    if (companyName) {
      this.companyName.set(companyName);
    //  this.store.view.set('departments');
    }

    /* Multi-select filters are committed on PANEL CLOSE (commitFilters below),
       NOT per click — applying per click re-renders the page under the open
       overlay, which makes PrimeNG close it after every selection.
       Only the search box streams live (debounced). */
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.store.setFilter({ search: v }));
  }

  /** Apply the three multi-select filters in one shot (panel close / clear).
      PrimeNG's showClear writes NULL into the control (even on nonNullable
      groups) — normalise to [] or the filter code crashes on .length. */
  commitFilters(): void {
    const { subDivision, freq, status } = this.filterForm.getRawValue();
    this.store.setFilter({
      dept: subDivision ?? [],
      freq: freq ?? [],
      status: status ?? [],
    });
  }

  tabIndex(view: PlanView): number {
    return this.tabs.findIndex(t => t.id === view);
  }

  /** Scope-level KPI — delegates to the store's real computed. */
  readonly scopeKpis = this.store.scopeStats;

  /**
   * Navigate to Audit Scope Management, optionally pre-selecting a status.
   * Passing no status opens the list unfiltered (used by the "Total" card).
   */
  goToScopeManagement(status?: ScopeMgmtStatus): void {
    this.router.navigate([this.scopeRoute], {
      queryParams: status ? { status } : {},
    });
  }

  /**
   * Navigate to the Scope Job list, optionally pre-selecting a job status.
   * Passing no status opens the list unfiltered (used by the "Total Jobs" card).
   */
  goToScopeJobs(status?: JobStatus): void {
    this.router.navigate([this.jobRoute], {
      queryParams: status ? { status } : {},
    });
  }
}