import {
  Component, computed, inject, OnInit, signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { Popover, PopoverModule } from 'primeng/popover';
import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import { AddRiskComponent, AddRiskDrawerData, RiskFormModel } from '../add-risk/add-risk.component';
import { RiskDetailComponent, RiskDetailDrawerData } from '../risk-detail/risk-detail.component';
import { RiskHeatmapComponent } from '../risk-heatmap/risk-heatmap.component';
import { ImportRiskComponent } from '../import-risk/import-risk.component';
import { FileDownloadService } from '@/app/core/services/file-download.service';
import {
  Risk, RiskType, RiskFile, ControlEffectiveness, RiskStatus, ResidualLevel,
  calcInherent, calcResidualScore, calcResidualLevel,
} from '../models/risk.model';
import { DialogModule } from 'primeng/dialog';
import { PaginationBarComponent } from '@/app/shared/components/pagination-bar/pagination-bar.component';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';
// Shared master risk list — the Risk Register is the source of truth for
// every risk in the system. Risk Approvals (risk-approval-pending-list.
// component.ts) reads this same signal and derives its queue from whatever
// is currently marked "open" here, so the two pages can never drift apart.
import { risksStore } from '@/app/features/audits/audit-plan/risk/risk-shared-data';

// ─────────────────────────────────────────────────────────────────────────
// Company / Division / Sub-Division filter options come from the shared
// static org directory (same source as the sibling list pages) instead of
// being scraped off the risk records, so the filters always offer the full
// canonical list. ORG_STATIC_DATA_INTERNAL_AUDIT (built from the
// *-static-indi-org seed files) is used in 'internal-audit' client mode,
// otherwise the multi-company ORG_STATIC_DATA roster — see `orgData` below.
import { CLIENT_MODE_VALUE } from '@/app/core/config/client-mode';
import { ORG_STATIC_DATA } from '@/app/features/audits/organization/company/company-org-data';
import { ORG_STATIC_DATA_INTERNAL_AUDIT } from '@/app/features/audits/Org-data-internal-audit';

/* re-export so existing imports from this file keep working */
export type { Risk, RiskType, RiskFile, ControlEffectiveness, RiskStatus, ResidualLevel };
export { calcInherent, calcResidualScore, calcResidualLevel };

type SortCol = 'id' | 'title' | 'riskType' | 'inherentScore' | 'residualLevel' | 'status' | 'dateIdentified';
type SortDir = 'asc' | 'desc';

/* ── Component ───────────────────────────────────────────────────── */
@Component({
  selector: 'app-risk-register-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, SelectModule, MultiSelectModule,
    TooltipModule, PopoverModule,
    RiskHeatmapComponent, ImportRiskComponent, DialogModule,
    PaginationBarComponent,

    DrawIconComponent,],
  templateUrl: './risk-register-list.component.html',
  styleUrl: './risk-register-list.component.scss',
})
export class RiskRegisterListComponent implements OnInit {
  @ViewChild(ImportRiskComponent) importDialog!: ImportRiskComponent;
  @ViewChild('filterPanel') filterPanel!: Popover;

  private readonly drawer     = inject(RightDrawerService);
  private readonly downloader = inject(FileDownloadService);

  // Shared with Risk Approvals — see risk-shared-data.ts.
  readonly risks    = risksStore;
  readonly viewMode = signal<'list' | 'grid' | 'heatmap'>('grid');

  /** True when this build is running in single-company "internal audit" mode. */
  readonly isInternalAuditMode = CLIENT_MODE_VALUE === 'internal-audit';

  /* ── Filters ── */
  readonly searchQuery       = signal('');
  readonly selectedCompanies = signal<string[]>([]);
  readonly selectedBranches  = signal<string[]>([]);
  readonly selectedTypes     = signal<RiskType[]>([]);
  readonly selectedDepts     = signal<string[]>([]);
  readonly selectedLevels    = signal<ResidualLevel[]>([]);
  readonly selectedStatuses  = signal<RiskStatus[]>([]);
  readonly selectedOwners    = signal<string[]>([]);

  /* ── Sort ── */
  readonly sortCol = signal<SortCol | null>('inherentScore');
  readonly sortDir = signal<SortDir>('desc');

  /* ── Pagination ── */
  readonly pageSize    = signal(8);
  readonly currentPage = signal(1);

  /** Options for the "items per page" dropdown in the pagination footer. */
  readonly pageSizeOptions: number[] = [8, 25, 50, 100];

  /* ── Filter options ── */
  readonly riskTypeOptions: { label: string; value: RiskType }[] = [
    { label: 'Strategic',    value: 'strategic'    },
    { label: 'Operational',  value: 'operational'  },
    { label: 'Financial',    value: 'financial'    },
    { label: 'Compliance',   value: 'compliance'   },
    { label: 'IT',           value: 'it'           },
    { label: 'AML / CFT',    value: 'aml_cft'      },
    { label: 'Reputational', value: 'reputational' },
    { label: 'Other',        value: 'other'        },
  ];

  readonly residualLevelOptions: { label: string; value: ResidualLevel }[] = [
    { label: 'High',   value: 'high'   },
    { label: 'Medium', value: 'medium' },
    { label: 'Low',    value: 'low'    },
  ];

  readonly statusOptions: { label: string; value: RiskStatus }[] = [
    { label: 'Open',        value: 'open'        },
    { label: 'Monitored',   value: 'monitored'   },
    { label: 'Closed',      value: 'closed'      },
    { label: 'Deactivated', value: 'deactivated' },
  ];

  /** Org directory for the current client mode — source of the org filters below. */
  readonly orgData = this.isInternalAuditMode ? ORG_STATIC_DATA_INTERNAL_AUDIT : ORG_STATIC_DATA;

  /** The selected companies, or every company when none is selected. */
  private scopedCompanies(names: string[]) {
    return names.length ? this.orgData.filter(c => names.includes(c.companyName)) : this.orgData;
  }

  /** Every company in the org directory. Values are company names (matching `r.company`). */
  readonly companyOptions = computed(() =>
    this.orgData
      .map(c => ({ label: c.companyName, value: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /** Divisions of the selected companies (or all). Values are division names (matching `r.division`). */
  readonly branchOptions = computed(() => {
    const set = new Set(
      this.scopedCompanies(this.selectedCompanies()).flatMap(c => c.divisions.map(d => d.divisionName)),
    );
    return Array.from(set).sort().map(b => ({ label: b, value: b }));
  });

  /**
   * Sub-Divisions of the selected companies + divisions (or all). Divisions
   * flagged `hasSubDivision: false` contribute none. Values are sub-division
   * names (matching `r.subDivision`).
   */
  readonly deptOptions = computed(() => {
    const branches = this.selectedBranches();
    const set = new Set(
      this.scopedCompanies(this.selectedCompanies())
        .flatMap(c => c.divisions)
        .filter(d => d.hasSubDivision !== false)
        .filter(d => !branches.length || branches.includes(d.divisionName))
        .flatMap(d => d.subDivisions.map(sd => sd.subDivisionName)),
    );
    return Array.from(set).sort().map(d => ({ label: d, value: d }));
  });

  /**
   * False only when at least one Division is selected and every selected
   * Division is flagged `hasSubDivision: false` — the Sub-Division field is
   * then hidden (and its selection ignored). Unknown divisions count as
   * having sub-divisions.
   */
  readonly subDivisionFilterVisible = computed(() => {
    const branches = this.selectedBranches();
    if (!branches.length) return true;
    const divisions = this.scopedCompanies(this.selectedCompanies()).flatMap(c => c.divisions);
    return branches.some(name => {
      const matches = divisions.filter(d => d.divisionName === name);
      return !matches.length || matches.some(d => d.hasSubDivision !== false);
    });
  });

  readonly ownerOptions = computed(() => {
    const set = new Set(this.risks().map(r => r.owner).filter(Boolean));
    return Array.from(set).sort().map(o => ({ label: o, value: o }));
  });

  /* ── Active filter count + chips ── */
  readonly activeFilterCount = computed(() => {
    let n = 0;
    if (this.selectedCompanies().length)  n++;
    if (this.selectedBranches().length)   n++;
    if (this.selectedDepts().length)      n++;
    if (this.selectedTypes().length)      n++;
    if (this.selectedLevels().length)     n++;
    if (this.selectedStatuses().length)   n++;
    if (this.selectedOwners().length)     n++;
    return n;
  });

  readonly activeFilterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.selectedCompanies().length)  chips.push({ key: 'companies', label: `Company: ${this.selectedCompanies().length}` });
    if (this.selectedBranches().length)   chips.push({ key: 'branches',  label: `Division: ${this.selectedBranches().length}`  });
    if (this.selectedDepts().length)      chips.push({ key: 'depts',     label: `Dept: ${this.selectedDepts().length}`       });
    if (this.selectedTypes().length)      chips.push({ key: 'types',     label: `Type: ${this.selectedTypes().length}`       });
    if (this.selectedLevels().length)     chips.push({ key: 'levels',    label: `Level: ${this.selectedLevels().length}`     });
    if (this.selectedStatuses().length)   chips.push({ key: 'statuses',  label: `Status: ${this.selectedStatuses().length}`  });
    if (this.selectedOwners().length)     chips.push({ key: 'owners',    label: `Owner: ${this.selectedOwners().length}`     });
    return chips;
  });

  removeFilter(key: string): void {
    switch (key) {
      case 'companies': this.selectedCompanies.set([]); this.selectedBranches.set([]); this.selectedDepts.set([]); break;
      case 'branches':  this.selectedBranches.set([]);  this.selectedDepts.set([]); break;
      case 'depts':     this.selectedDepts.set([]);     break;
      case 'types':     this.selectedTypes.set([]);     break;
      case 'levels':    this.selectedLevels.set([]);    break;
      case 'statuses':  this.selectedStatuses.set([]);  break;
      case 'owners':    this.selectedOwners.set([]);    break;
    }
    this.currentPage.set(1);
  }

  /* ── Derived ── */
  readonly filtered = computed(() => {
    let list = this.risks().filter(r => r.status !== 'deactivated' ||
      this.selectedStatuses().includes('deactivated'));

    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.owner.toLowerCase().includes(q),
    );

    const co = this.selectedCompanies();
    if (co.length) list = list.filter(r => co.includes(r.company));

    const br = this.selectedBranches();
    if (br.length) list = list.filter(r => br.includes(r.division));

    const t = this.selectedTypes();
    if (t.length) list = list.filter(r => t.includes(r.riskType));

    const d = this.selectedDepts();
    // Ignored while the Sub-Division field is hidden, so it can't stay applied.
    if (d.length && this.subDivisionFilterVisible()) list = list.filter(r => d.includes(r.subDivision));

    const l = this.selectedLevels();
    if (l.length) list = list.filter(r => l.includes(r.residualLevel));

    const s = this.selectedStatuses();
    if (s.length) list = list.filter(r => s.includes(r.status));

    const ow = this.selectedOwners();
    if (ow.length) list = list.filter(r => ow.includes(r.owner));

    const col = this.sortCol();
    if (col) {
      const dir = this.sortDir() === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = this.sv(a, col), bv = this.sv(b, col);
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    return list;
  });

  readonly paginated = computed(() => {
    const all  = this.filtered();
    const size = this.pageSize();
    const max  = Math.max(1, Math.ceil(all.length / size));
    const p    = Math.min(this.currentPage(), max);
    return all.slice((p - 1) * size, p * size);
  });

  readonly hasFilters = computed(() =>
    !!this.searchQuery().trim() ||
    !!this.selectedCompanies().length ||
    !!this.selectedBranches().length ||
    !!this.selectedTypes().length ||
    !!this.selectedDepts().length ||
    !!this.selectedLevels().length ||
    !!this.selectedStatuses().length ||
    !!this.selectedOwners().length,
  );

  /**
   * Severity-wise KPI strip: Total + one count per residual level
   * (High/Medium/Low). Derived from `filtered()` so the cards mirror
   * whatever search/filters are currently applied to the table/grid below.
   */
  readonly kpis = computed(() => {
    const all = this.filtered();
    return {
      total:  all.length,
      high:   all.filter(r => r.residualLevel === 'high').length,
      medium: all.filter(r => r.residualLevel === 'medium').length,
      low:    all.filter(r => r.residualLevel === 'low').length,
    };
  });

  ngOnInit(): void { /* load from service */ }

  /* ── Filter handlers ── */
  onSearch(q: string)          { this.searchQuery.set(q);              this.currentPage.set(1); }
  onCompanies(v: string[])     { this.selectedCompanies.set(v ?? []);  this.selectedBranches.set([]); this.selectedDepts.set([]); this.currentPage.set(1); }
  onBranches(v: string[])      { this.selectedBranches.set(v ?? []);   this.selectedDepts.set([]);    this.currentPage.set(1); }
  onTypes(v: RiskType[])       { this.selectedTypes.set(v ?? []);      this.currentPage.set(1); }
  onDepts(v: string[])         { this.selectedDepts.set(v ?? []);      this.currentPage.set(1); }
  onLevels(v: ResidualLevel[]) { this.selectedLevels.set(v ?? []);     this.currentPage.set(1); }
  onStatuses(v: RiskStatus[])  { this.selectedStatuses.set(v ?? []);   this.currentPage.set(1); }
  onOwners(v: string[])        { this.selectedOwners.set(v ?? []);     this.currentPage.set(1); }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedCompanies.set([]); this.selectedBranches.set([]);
    this.selectedTypes.set([]);     this.selectedDepts.set([]);
    this.selectedLevels.set([]);    this.selectedStatuses.set([]);
    this.selectedOwners.set([]);
    this.currentPage.set(1);
  }

  /* ── Sort ── */
  onSort(col: SortCol) {
    this.sortCol() === col
      ? this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc')
      : (this.sortCol.set(col), this.sortDir.set('asc'));
  }
  sortIcon(col: SortCol) {
    return this.sortCol() !== col ? '' : this.sortDir() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down';
  }
  private sv(r: Risk, col: SortCol): string | number {
    switch (col) {
      case 'id':             return parseInt(r.id.replace(/\D/g,''), 10) || 0;
      case 'title':          return r.title.toLowerCase();
      case 'riskType':       return r.riskType;
      case 'inherentScore':  return r.inherentScore;
      case 'residualLevel':  return { low: 1, medium: 2, high: 3 }[r.residualLevel];
      case 'status':         return r.status;
      case 'dateIdentified': return r.dateIdentified.getTime();
    }
  }

  /** <app-pagination-bar> emits a zero-based page index. */
  onPageChange(page: number): void {
    this.currentPage.set(page + 1);
  }

  /** Called when the "items per page" dropdown changes. Resets to page 1
   *  so the visible slice stays consistent with the new page size. */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  setView(m: 'list' | 'grid' | 'heatmap') { this.viewMode.set(m); }

  openImport(): void { this.importDialog.open(); }

  onImported(newRisks: Partial<Risk>[]): void {
    this.risks.update(existing => [...existing, ...(newRisks as Risk[])]);
  }

  /* ── Uploaded register documents → RiskFile[] (keeps blobs downloadable) ── */
  private toRiskFiles(docs: File[] | undefined): RiskFile[] {
    return (docs ?? []).map(f => ({ name: f.name, size: f.size, file: f }));
  }

  /**
   * AddRiskResult.form may arrive as the plain model OR as the FormGroup
   * itself (depending on how add-risk closes the drawer) — normalise both.
   */
  private normalizeForm(input: unknown): RiskFormModel {
    const maybeGroup = input as { getRawValue?: () => unknown };
    const raw = typeof maybeGroup?.getRawValue === 'function'
      ? maybeGroup.getRawValue()
      : input;
    return raw as RiskFormModel;
  }

  /** Build a full Risk from the add-risk form. */
  private buildRisk(id: string, f: RiskFormModel, existingFiles: RiskFile[] = []): Risk {
    const impact     = f.impact ?? 1;
    const likelihood = f.likelihood ?? 1;
    const inherent   = calcInherent(impact, likelihood);
    const residual   = calcResidualScore(inherent, f.controlEffectiveness);
    return {
      id,
      riskType: f.riskType,
      title: f.title,
      description: f.description,
      company: f.company || 'Cygnus Aura',
      division: f.division || 'Dubai HQ',
      subDivision: f.subDivision,
      impact, likelihood,
      inherentScore: inherent,
      keyControls: f.keyControls,
      controlEffectiveness: f.controlEffectiveness,
      residualScore: residual,
      residualLevel: calcResidualLevel(residual),
      owner: f.owner,
      dateIdentified: f.dateIdentified ?? new Date(),
      lastUpdated: new Date(),
      status: f.status,
      linkedScopes: [], linkedFindings: [], linkedObservations: [],
      // already-persisted files survive; newly uploaded documents are appended
      supportingFiles: [...existingFiles.filter(x => x.url), ...this.toRiskFiles(f.documents)],
    };
  }

  private nextId(): string {
    const max = this.risks().reduce((m, r) =>
      Math.max(m, parseInt(r.id.replace(/\D/g, ''), 10) || 0), 0);
    return `RSK-${String(max + 1).padStart(3, '0')}`;
  }

  async openAdd(): Promise<void> {
    const ref = this.drawer.open<AddRiskComponent, AddRiskDrawerData>(
      AddRiskComponent, { width: '800px', data: { mode: 'create' } },
    );
    const result = await ref.afterClosed;
    if (result) {
      const newRisk = this.buildRisk(this.nextId(), this.normalizeForm(result.form));
      // `risks` is the shared store that Risk Approvals also reads, so a
      // newly-created risk with status 'open' shows up in the approvals
      // queue immediately — no separate "push to approvals" step needed.
      this.risks.update(list => [newRisk, ...list]);
      this.currentPage.set(1);
    }
  }

  async openEdit(r: Risk): Promise<void> {
    const ref = this.drawer.open<AddRiskComponent, AddRiskDrawerData>(
      AddRiskComponent, {
        width: '800px',
        data: { mode: 'edit', existing: {
          id: r.id, riskType: r.riskType, title: r.title, description: r.description,
          subDivision: r.subDivision, impact: r.impact, likelihood: r.likelihood,
          keyControls: r.keyControls, controlEffectiveness: r.controlEffectiveness,
          owner: r.owner, dateIdentified: r.dateIdentified, status: r.status,
          company: r.company, division: r.division,
        }},
      },
    );
    const result = await ref.afterClosed;
    if (result) {
      const updated = this.buildRisk(r.id, this.normalizeForm(result.form), r.supportingFiles);
      // keep the original identification date on edit
      updated.dateIdentified = r.dateIdentified;
      this.risks.update(list => list.map(x => (x.id === r.id ? updated : x)));
    }
  }

  openView(r: Risk): void {
    this.drawer.open<RiskDetailComponent, RiskDetailDrawerData>(
      RiskDetailComponent, { width: '720px', data: { risk: r } },
    );
  }

  downloadFile(f: RiskFile): void {
    const src = f.file ?? f.url;
    if (src) this.downloader.download(src, f.name);
  }

  /* ── Labels ── */
  riskTypeLabel(t: RiskType): string {
    return this.riskTypeOptions.find(o => o.value === t)?.label ?? t;
  }
  statusLabel(s: RiskStatus): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  ceLabel(ce: ControlEffectiveness): string {
    return ce.charAt(0).toUpperCase() + ce.slice(1);
  }
  scoreColor(score: number): string {
    const lvl = calcResidualLevel(score);
    return lvl === 'high' ? '#dc2626' : lvl === 'medium' ? '#ca8a04' : '#16a34a';
  }

  trackById = (_: number, r: Risk) => r.id;

  readonly displayConfirmation = signal(false);
  private readonly pendingRisk = signal<Risk | null>(null);

  /** True label for the confirm button — "Activate" or "Deactivate". */
  readonly confirmationAction = computed(() =>
    this.pendingRisk()?.status ? 'Activate' : 'Deactivate',
  );

  readonly confirmationTarget = computed(() => this.pendingRisk());

  openConfirmation(risk: Risk): void {
    this.pendingRisk.set(risk);
    this.displayConfirmation.set(true);
  }

  closeConfirmation(): void {
    this.displayConfirmation.set(false);
    this.pendingRisk.set(null);
  }

  /** Called when the user clicks "Yes" — toggles, then closes. */
  confirmToggleBlocked(): void {
    const c = this.pendingRisk();
    if (c) this.toggleBlocked(c);
    this.closeConfirmation();
  }

  toggleBlocked(risk: Risk): void {
    this.risks.update(list =>
      list.map(c => (c.id === risk.id ? { ...c, blocked: !c.status } : c)),
    );
  }
}