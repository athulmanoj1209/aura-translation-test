import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  NgZone,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, startWith, take } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { OrganizationChartModule } from 'primeng/organizationchart';
import { TreeModule, TreeNodeExpandEvent, TreeNodeCollapseEvent } from 'primeng/tree';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmActionDialogComponent } from '@/app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { TreeNode } from 'primeng/api';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

// ── Real, shared data sources ───────────────────────────────────────────────
// The org chart used to maintain its own disconnected copy of every company /
// division / sub-division / scope (client-org-chart-static-data.ts). That made
// activating/deactivating a division here invisible everywhere else. It now
// reads and writes the SAME records that divisions.html, sub-divisions.html and
// the audit-scope-management page use, joined by company id / divisionCode /
// subDivisionName (the natural keys those pages already share).
import { CompanyDataService } from '@/app/features/audits/organization/services/company-data.service';
import { Company } from '@/app/features/audits/organization/company/models/company.model';
import type { StaticDivision, DivisionEditableFields } from '@/app/features/audits/organization/divisions/models/division-static.model';
import {
  DIVISION_STATIC_COMPANIES,
  setDivisionStatus,
  editStaticDivision,
} from '@/app/features/audits/organization/divisions/division-static-data';
import type { StaticSubDivision, SubDivisionEditableFields } from '@/app/features/audits/organization/sub-divisions/models/sub-division-static.model';
import {
  SUB_DIVISION_STATIC_COMPANIES,
  setSubDivisionStatus,
  editStaticSubDivision,
} from '@/app/features/audits/organization/sub-divisions/sub-division-static-data';
import type { StaticScope } from '@/app/features/audits/audit-plan/audit-scope-management/models/audit-scope.model';
import {
  AUDIT_SCOPE_STATIC_COMPANIES,
  subScopesOf,
  editStaticScope,
  setScopeStatus,
} from '@/app/features/audits/audit-plan/audit-scope-management/audit-scope-static-data';

import { RightDrawerService } from '@/app/shared/components/services/right-drawer.service';
import {
  AddCompanyModalComponent,
  AddCompanyDrawerData,
  CompanyFormModel,
} from '@/app/features/audits/organization/company/add-company-modal/add-company-modal.component';
import { AddDivisions } from '@/app/features/audits/organization/divisions/add-divisions/add-divisions.component';
import type { AddDivisionsDrawerData, AddDivisionsDrawerResult, DivisionProfileDrawerData } from '@/app/features/audits/organization/divisions/models/division-drawer.model';
import { AddSubDivisionComponent } from '@/app/features/audits/organization/sub-divisions/add-sub-division/add-sub-division.component';
import type {
  AddSubDivisionDrawerData,
  AddSubDivisionDrawerResult,
  SubDivisionFormSubDivision,
  SubDivisionProfileDrawerData,
} from '@/app/features/audits/organization/sub-divisions/models/sub-division-drawer.model';
import { AddAuditScopeComponent } from '@/app/features/audits/audit-plan/audit-scope-management/add-audit-scope/add-audit-scope.component';
import type { AddAuditScopeDrawerData, AddAuditScopeDrawerResult, ScopeProfileDrawerData } from '@/app/features/audits/audit-plan/audit-scope-management/models/audit-scope-drawer.model';
import { CompanyProfileComponent, CompanyProfileData } from '@/app/features/audits/organization/company/company-profile/company-profile.component';
import { DivisionProfileComponent } from '@/app/features/audits/organization/divisions/division-profile/division-profile.component';
import { SubDivisionProfileComponent } from '@/app/features/audits/organization/sub-divisions/sub-division-profile/sub-division-profile.component';
import { ScopeProfileComponent } from '@/app/features/audits/audit-plan/audit-scope-management/scope-profile/scope-profile.component';
import type { OrgChartViewMode, OrgNodeType, OrgNodeData, OrgTreeNode } from './models/org-chart-node.model';

// ── Cross-store lookups ──────────────────────────────────────────────────────
// division-static-data.ts / sub-division-static-data.ts / audit-scope-static-data.ts
// each own one level of the hierarchy; these walk the real arrays to join
// division -> sub-divisions -> scopes by divisionCode/subDivisionName, the same keys
// those pages already key off of.

function findDivisionByCode(divisionCode: string | null | undefined): StaticDivision | null {
  if (!divisionCode) return null;
  for (const company of DIVISION_STATIC_COMPANIES) {
    const division = company.divisions.find(b => b.divisionCode === divisionCode);
    if (division) return division;
  }
  return null;
}

function getSubDivisionsForDivision(divisionCode: string): StaticSubDivision[] {
  for (const company of SUB_DIVISION_STATIC_COMPANIES) {
    const division = company.divisions.find(b => b.divisionCode === divisionCode);
    if (division) return division.subDivisions;
  }
  return [];
}

function findSubDivision(divisionCode: string, subDivisionName: string): StaticSubDivision | null {
  return getSubDivisionsForDivision(divisionCode).find(d => d.subDivisionName === subDivisionName) ?? null;
}

function getScopesForSubDivision(divisionCode: string, subDivisionName: string): StaticScope[] {
  for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
    const division = company.divisions.find(b => b.divisionCode === divisionCode);
    const dept = division?.subDivisions.find(d => d.subDivisionName === subDivisionName);
    if (dept) return dept.scopes;
  }
  return [];
}

/**
 * Stands in for the sub-division name in a division-level scope's node id
 * (`DIV001::#division::Scope A`), so scope/sub-scope ids keep the same
 * 3/4-part shape that isBlocked / getScopeByNodeId etc. rely on.
 */
const DIVISION_SCOPE_SEGMENT = '#division';

/** Division-level scopes/sub-scopes (`subDivisionName: null`) — they sit directly under the division. */
function getScopesForDivision(divisionCode: string): StaticScope[] {
  for (const company of AUDIT_SCOPE_STATIC_COMPANIES) {
    const division = company.divisions.find(b => b.divisionCode === divisionCode);
    if (division) return division.scopes ?? [];
  }
  return [];
}

/** Scopes under a node-id parent segment: the division itself (DIVISION_SCOPE_SEGMENT) or a sub-division name. */
function getScopesForParent(divisionCode: string, segment: string): StaticScope[] {
  return segment === DIVISION_SCOPE_SEGMENT
    ? getScopesForDivision(divisionCode)
    : getScopesForSubDivision(divisionCode, segment);
}

@Component({
  selector: 'app-client-organizational-chart',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    OrganizationChartModule,
    TreeModule,
    SelectModule,
    MultiSelectModule,
    InputTextModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    ConfirmActionDialogComponent,
    DrawIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-organizational-chart.html',
  styleUrl: './client-organizational-chart.scss',
})
export class ClientOrganizationalChart {
  private readonly fb = inject(FormBuilder);
  private readonly drawer = inject(RightDrawerService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly companyDataService = inject(CompanyDataService);
  // NgZone lets us run the high-frequency mousemove handler
  //  outside Angular's change detection. Normally every DOM
  // event Angular listens to triggers a change-detection pass;
  //  mousemove can fire 60+ times/second while dragging, and all
  // it needs to do is set scrollLeft/scrollTop and toggle a
  // CSS class — none of that needs Angular's template to re-render. zone.runOutsideAngular(...) registers the listeners so they bypass that overhead; zone.run(...) is used once, at the very end, to step back inside the zone only when we actually need a signal update to reach the template (the cursor's is-panning class).
  private readonly zone = inject(NgZone);

  /** The scrollable org-chart viewport, referenced from the template via #chartWrap. */
  private readonly chartWrapRef = viewChild<ElementRef<HTMLDivElement>>('chartWrap');

  readonly companyOptions = this.companyDataService.all.map(c => ({ label: c.companyName, value: c.id }));

  readonly countryOptions = [
    { label: 'All Regions', value: null },
    { label: 'United Arab Emirates', value: 'ae' },
    { label: 'Saudi Arabia', value: 'sa' },
    { label: 'Bahrain', value: 'bh' },
    { label: 'Kuwait', value: 'kw' },
  ];

  readonly filters = this.fb.group({
    company: [null as string | null],
    search: [''],
    country: [null as string | null],
    emirateStates: [[] as string[]],
  });

  constructor() {
    this.filters.get('company')!.valueChanges.subscribe(() => {
      this.filters.patchValue({ emirateStates: [] });
      this.focusedNodeId.set(null);
    });
    this.filters.get('country')!.valueChanges.subscribe(() => {
      this.filters.patchValue({ emirateStates: [] });
    });

    this.route.queryParamMap.pipe(take(1)).subscribe(params => {
      const company = params.get('company');
      if (company) {
        this.filters.patchValue({ company });
      }
    });

    // Center the chart horizontally on the root company node whenever a
    // (different) company is loaded into the chart view.
    effect(() => {
      const company = this.currentCompany();
      const mode = this.viewMode();
      if (!company || mode !== 'chart') return;
      afterNextRender(() => this.centerChart(), { injector: this.injector });
    });
  }

  private readonly f = toSignal(
    this.filters.valueChanges.pipe(
      // debounceTime(200),
      distinctUntilChanged((a, b) =>
        a.company === b.company &&
        a.search === b.search &&
        a.country === b.country &&
        JSON.stringify(a.emirateStates ?? []) === JSON.stringify(b.emirateStates ?? []),
      ),
      startWith(this.filters.value),
    ),
    { initialValue: this.filters.value },
  );

  readonly viewMode = signal<OrgChartViewMode>('chart');
  readonly expandAll = signal<boolean>(true);
  /** Scope/sub-scope levels start collapsed; expanded via "Expand All" or per-node click. */
  readonly expandScopes = signal<boolean>(false);

  /** Per-node manual expand/collapse overrides in the chart view (keyed by node id), so a
   *  node the user opened/closed by hand stays that way across `tree` recomputations
   *  (e.g. triggered by bumpRefresh() after an edit/activate/deactivate action) instead of
   *  reverting to the `expandAll`/`expandScopes` default every node of that level shares. */
  readonly chartExpandedKeys = signal<Set<string>>(new Set());
  readonly chartCollapsedKeys = signal<Set<string>>(new Set());

  // ── Focus & refresh state ────────────────────────────────────────────────
  readonly focusedNodeId = signal<string | null>(null);
  /** Bumped after every edit/status-toggle mutation so the tree/list computeds
   *  (which read the mutated-in-place static data, not a fresh signal value)
   *  are forced to recompute. */
  readonly refreshTick = signal(0);
  private bumpRefresh(): void {
    this.refreshTick.update(n => n + 1);
  }

  // ── Confirmation dialog ──────────────────────────────────────────────────
  readonly displayConfirmation = signal(false);
  private readonly _pendingNode = signal<OrgNodeData | null>(null);

  readonly confirmationAction = computed(() => {
    const node = this._pendingNode();
    return node && this.isBlocked(node.id) ? 'Activate' : 'Deactivate';
  });
  readonly confirmationTarget = computed(() => this._pendingNode());

  // ── List-view expand/collapse state (keyed by node id) ───────────────────
  readonly listExpandedKeys = signal<Set<string>>(new Set());

  onListNodeExpand(event: TreeNodeExpandEvent): void {
    const key = event.node.key;
    if (key) this.listExpandedKeys.update(s => new Set([...s, key]));
  }

  onListNodeCollapse(event: TreeNodeCollapseEvent): void {
    const key = event.node.key;
    if (key) this.listExpandedKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
  }

  // ── Chart-view expand/collapse state (keyed by node id) ──────────────────
  onChartNodeExpand(event: { originalEvent: Event; node: OrgTreeNode }): void {
    const id = event.node?.data?.id;
    if (!id) return;
    this.chartExpandedKeys.update(s => new Set([...s, id]));
    this.chartCollapsedKeys.update(s => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });
  }

  onChartNodeCollapse(event: { originalEvent: Event; node: OrgTreeNode }): void {
    const id = event.node?.data?.id;
    if (!id) return;
    this.chartCollapsedKeys.update(s => new Set([...s, id]));
    this.chartExpandedKeys.update(s => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });
  }

  setViewMode(m: OrgChartViewMode): void { this.viewMode.set(m); }
  toggleAll(expand: boolean): void {
    this.expandAll.set(expand);
    this.expandScopes.set(expand);
    // "Expand All"/"Collapse All" is a hard reset — clear per-node overrides so every
    // node reverts to the new uniform default instead of keeping stale manual toggles.
    this.chartExpandedKeys.set(new Set());
    this.chartCollapsedKeys.set(new Set());
  }

  /** Emirate/state options derived from the currently selected company + country. */
  readonly emirateStateOptions = computed(() => {
    void this.refreshTick();
    const f = this.f();
    const company = f?.company ?? null;
    const country = f?.country ?? null;
    if (!company) return [];

    const divisions = DIVISION_STATIC_COMPANIES.find(c => c.id === company)?.divisions ?? [];
    const seen = new Set<string>();
    const opts: { label: string; value: string }[] = [];
    for (const b of divisions) {
      if (country && b.country !== country) continue;
      if (b.emirateState && !seen.has(b.emirateState)) {
        seen.add(b.emirateState);
        opts.push({ label: this.emirateStateLabel(b.emirateState), value: b.emirateState });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly hasEmirateStateOptions = computed(() => this.emirateStateOptions().length > 1);

  readonly tree = computed<OrgTreeNode[]>(() => {
    void this.refreshTick();
    const filters = this.f();
    const company = filters?.company ?? null;
    if (!company) return [];

    const search = (filters?.search ?? '').toLowerCase().trim();
    const country = filters?.country ?? null;
    const emirateStates = filters?.emirateStates ?? [];
    const exp = this.expandAll();
    const scopeExp = this.expandScopes();
    const expandedIds = this.chartExpandedKeys();
    const collapsedIds = this.chartCollapsedKeys();
    const resolveExpanded = (id: string, defaultVal: boolean): boolean => {
      if (expandedIds.has(id)) return true;
      if (collapsedIds.has(id)) return false;
      return defaultVal;
    };

    const companyRec = this.companyDataService.getById(company);
    if (!companyRec) return [];
    const divisions = DIVISION_STATIC_COMPANIES.find(c => c.id === company)?.divisions ?? [];
    const label = companyRec.companyName;
    const totalEmp = divisions.reduce((s, b) => s + (b.numberOfEmployees ?? 0), 0);

    const filtered = divisions.filter(b => {
      if (country && b.country !== country) return false;
      if (emirateStates.length > 0 && !emirateStates.includes(b.emirateState)) return false;
      if (!search) return true;
      return (
        b.divisionName.toLowerCase().includes(search) ||
        b.divisionCode.toLowerCase().includes(search) ||
        b.city.toLowerCase().includes(search) ||
        (b.hasSubDivision && getSubDivisionsForDivision(b.divisionCode).some(d => d.subDivisionName.toLowerCase().includes(search)))
      );
    }).sort((a, b) => a.emirateState.localeCompare(b.emirateState));

    if (!filtered.length) return [];

    /** Scope → sub-scope nodes for one parent; `segment` is the sub-division name or DIVISION_SCOPE_SEGMENT. */
    const buildScopeNodes = (divisionCode: string, segment: string, parentLabel: string): OrgTreeNode[] => {
      const scopes = getScopesForParent(divisionCode, segment);
      return scopes.filter(s => s.parentScopeId === null).map(s => {
        const subScopes = scopes.filter(ss => ss.parentScopeId === s.id);
        const scopeId = `${divisionCode}::${segment}::${s.scopeName}`;
        return {
          data: {
            type: 'scope' as OrgNodeType,
            id: scopeId,
            name: s.scopeName,
            subtitle: parentLabel,
            scopeType: s.scopeType,
            auditFrequency: s.auditFrequency,
            modeOfAudit: s.modeOfAudit,
            riskRating: s.riskRating ?? undefined,
            startDate: s.startDate,
            endDate: s.endDate,
            subScopeCount: subScopes.length,
          },
          expanded: resolveExpanded(scopeId, scopeExp),
          children: subScopes.map(ss => {
            const subscopeId = `${scopeId}::${ss.scopeName}`;
            return {
              data: {
                type: 'subscope' as OrgNodeType,
                id: subscopeId,
                name: ss.scopeName,
                subtitle: s.scopeName,
                scopeType: ss.scopeType,
                auditFrequency: ss.auditFrequency,
                modeOfAudit: ss.modeOfAudit,
                riskRating: ss.riskRating ?? undefined,
                startDate: ss.startDate,
                endDate: ss.endDate,
              },
              expanded: resolveExpanded(subscopeId, scopeExp),
              children: [],
            };
          }),
        };
      });
    };

    const divisionNodes: OrgTreeNode[] = filtered.map(b => {
      const divisionMatch = !search ||
        b.divisionName.toLowerCase().includes(search) ||
        b.divisionCode.toLowerCase().includes(search) ||
        b.city.toLowerCase().includes(search);
      // A division shows either its sub-divisions (hasSubDivision) or its own scopes, never both
      const allDepts = b.hasSubDivision ? getSubDivisionsForDivision(b.divisionCode) : [];
      const depts = divisionMatch
        ? allDepts
        : allDepts.filter(d => d.subDivisionName.toLowerCase().includes(search));

      const divisionId = b.divisionCode;

      const deptNodes: OrgTreeNode[] = depts.map(d => {
        const deptId = `${b.divisionCode}::${d.subDivisionName}`;
        return {
          data: {
            type: 'subDivision' as OrgNodeType,
            id: deptId,
            name: d.subDivisionName,
            subtitle: b.divisionName,
            status: d.status,
            riskRating: d.riskRating,
            riskStatus: d.riskStatus,
            numberOfEmployees: d.numberOfEmployees,
          },
          expanded: resolveExpanded(deptId, scopeExp),
          children: buildScopeNodes(b.divisionCode, d.subDivisionName, d.subDivisionName),
        };
      });

      // Division-level scopes (only when the division has no sub-divisions) always go
      // under the "Division Scopes" card. The card is sized by an invisible placeholder
      // sub-division card, so it matches the sub-division cards shown elsewhere.
      // Its toggle collapses/expands the division-level scopes as a group.
      const divisionScopeNodes = !b.hasSubDivision ? buildScopeNodes(b.divisionCode, DIVISION_SCOPE_SEGMENT, b.divisionName) : [];
      const spacerId = `${b.divisionCode}::${DIVISION_SCOPE_SEGMENT}`;
      const divisionScopeChildren: OrgTreeNode[] = !divisionScopeNodes.length
        ? []
        : [{
            data: {
              type: 'spacer' as OrgNodeType,
              id: spacerId,
              name: 'Division Scopes',
              subtitle: b.divisionName,
              mirror: {
                type: 'subDivision' as OrgNodeType,
                id: `${spacerId}::placeholder`,
                name: '',
                subtitle: b.divisionName,
                status: 'active',
                riskRating: 'medium',
                riskStatus: 'monitored',
                numberOfEmployees: 0,
              },
              scopeCount: divisionScopeNodes.length,
              subScopeCount: divisionScopeNodes.reduce((n, s) => n + (s.data?.subScopeCount ?? 0), 0),
            },
            styleClass: 'org-spacer-node',
            // Starts collapsed like the sub-divisions (the label shows what's inside); "Expand All" opens it.
            expanded: resolveExpanded(spacerId, scopeExp),
            children: divisionScopeNodes,
          }];

      return {
        data: {
          type: 'division' as OrgNodeType,
          id: divisionId,
          name: b.divisionName,
          subtitle: b.divisionCode,
          status: b.status,
          riskRating: b.riskRating,
          divisionType: b.divisionType,
          city: b.city,
          country: b.country,
          auditStatus: b.auditStatus,
          subDivisionCount: allDepts.length,
          employeeCount: b.numberOfEmployees ?? 0,
        },
        expanded: resolveExpanded(divisionId, exp),
        children: [...deptNodes, ...divisionScopeChildren],
      };
    });

    const fullTree: OrgTreeNode[] = [{
      data: {
        type: 'company' as OrgNodeType,
        id: company,
        name: label,
        subtitle: 'Organization',
        companyKey: company,
        divisionCount: filtered.length,
        employeeCount: totalEmp,
      },
      expanded: resolveExpanded(company, exp),
      children: divisionNodes,
    }];

    // Focus filter — show only the subtree rooted at the focused node
    const focusId = this.focusedNodeId();
    if (focusId) {
      const found = findOrgNode(fullTree, focusId);
      if (found) return [{ ...found, expanded: true }];
    }

    return fullTree;
  });

  readonly flatDivisions = computed<StaticDivision[]>(() => {
    void this.refreshTick();
    const filters = this.f();
    const company = filters?.company ?? null;
    if (!company) return [];
    const search = (filters?.search ?? '').toLowerCase().trim();
    const country = filters?.country ?? null;
    const emirateStates = filters?.emirateStates ?? [];
    const divisions = DIVISION_STATIC_COMPANIES.find(c => c.id === company)?.divisions ?? [];
    return divisions.filter(b => {
      if (country && b.country !== country) return false;
      if (emirateStates.length > 0 && !emirateStates.includes(b.emirateState)) return false;
      if (!search) return true;
      return (
        b.divisionName.toLowerCase().includes(search) ||
        b.divisionCode.toLowerCase().includes(search) ||
        b.city.toLowerCase().includes(search) ||
        (b.hasSubDivision && getSubDivisionsForDivision(b.divisionCode).some(d => d.subDivisionName.toLowerCase().includes(search)))
      );
    }).sort((a, b) => a.emirateState.localeCompare(b.emirateState));
  });

  readonly hasCompany = computed(() => !!this.f()?.company);

  readonly listTree = computed<TreeNode<OrgNodeData>[]>(() => {
    void this.refreshTick();
    const expKeys = this.listExpandedKeys();

    /** Scope → sub-scope list nodes for one parent; `segment` is the sub-division name or DIVISION_SCOPE_SEGMENT. */
    const buildScopeNodes = (bKey: string, segment: string, parentLabel: string): TreeNode<OrgNodeData>[] => {
      const scopes = getScopesForParent(bKey, segment);
      return scopes.filter(s => s.parentScopeId === null).map(s => {
        const sKey = `${bKey}::${segment}::${s.scopeName}`;
        const subScopes = scopes.filter(ss => ss.parentScopeId === s.id);
        return {
          key: sKey,
          expanded: expKeys.has(sKey),
          data: {
            type: 'scope' as OrgNodeType,
            id: sKey,
            name: s.scopeName,
            subtitle: parentLabel,
            scopeType: s.scopeType,
            auditFrequency: s.auditFrequency,
            modeOfAudit: s.modeOfAudit,
            riskRating: s.riskRating ?? undefined,
            subScopeCount: subScopes.length,
            divisionCode: bKey,
          },
          children: subScopes.map(ss => {
            const ssKey = `${sKey}::${ss.scopeName}`;
            return {
              key: ssKey,
              leaf: true,
              expanded: false,
              data: {
                type: 'subscope' as OrgNodeType,
                id: ssKey,
                name: ss.scopeName,
                subtitle: s.scopeName,
                scopeType: ss.scopeType,
                auditFrequency: ss.auditFrequency,
                modeOfAudit: ss.modeOfAudit,
                riskRating: ss.riskRating ?? undefined,
                divisionCode: bKey,
              },
              children: [],
            };
          }),
        };
      });
    };

    return this.flatDivisions().map(b => {
      const bKey = b.divisionCode;
      // A division shows either its sub-divisions (hasSubDivision) or its own scopes, never both.
      // Division-level scopes go under a "Division Scopes" group row (collapsed by
      // default like every list row; expanding it shows the scopes).
      const divisionScopeNodes = !b.hasSubDivision ? buildScopeNodes(bKey, DIVISION_SCOPE_SEGMENT, b.divisionName) : [];
      const groupKey = `${bKey}::${DIVISION_SCOPE_SEGMENT}`;
      const divisionScopeGroup: TreeNode<OrgNodeData>[] = !divisionScopeNodes.length ? [] : [{
        key: groupKey,
        expanded: expKeys.has(groupKey),
        data: {
          type: 'divisionScopes' as OrgNodeType,
          id: groupKey,
          name: 'Division Scopes',
          subtitle: b.divisionName,
          scopeCount: divisionScopeNodes.length,
          subScopeCount: divisionScopeNodes.reduce((n, s) => n + (s.data?.subScopeCount ?? 0), 0),
          divisionCode: bKey,
        },
        children: divisionScopeNodes,
      }];
      return {
        key: bKey,
        expanded: expKeys.has(bKey),
        data: {
          type: 'division' as OrgNodeType,
          id: bKey,
          name: b.divisionName,
          subtitle: `${b.divisionCode} · ${b.city}`,
          status: b.status,
          riskRating: b.riskRating,
          divisionType: b.divisionType,
          leaf: false,
          city: b.city,
          auditStatus: b.auditStatus,
          subDivisionCount: b.hasSubDivision ? getSubDivisionsForDivision(bKey).length : 0,
          employeeCount: b.numberOfEmployees ?? 0,
          divisionCode: bKey,
        },
        children: [
          ...this.getFilteredDepts(b).map(d => {
            const dKey = `${bKey}::${d.subDivisionName}`;
            return {
              key: dKey,
              expanded: expKeys.has(dKey),
              data: {
                type: 'subDivision' as OrgNodeType,
                id: dKey,
                name: d.subDivisionName,
                subtitle: `${d.numberOfEmployees ?? 0} employees`,
                status: d.status,
                riskRating: d.riskRating,
                riskStatus: d.riskStatus,
                numberOfEmployees: d.numberOfEmployees,
                divisionCode: bKey,
              },
              children: buildScopeNodes(bKey, d.subDivisionName, d.subDivisionName),
            };
          }),
          ...divisionScopeGroup,
        ],
      };
    });
  });

  readonly selectedCompanyLabel = computed(() =>
    this.companyOptions.find(c => c.value === this.f()?.company)?.label ?? ''
  );

  readonly currentCompany = computed(() => this.f()?.company ?? undefined);

  readonly totalEmployees = computed(() =>
    this.flatDivisions().reduce((s, b) => s + (b.numberOfEmployees ?? 0), 0)
  );

  getFilteredDepts(b: StaticDivision): StaticSubDivision[] {
    if (!b.hasSubDivision) return [];
    const search = (this.f()?.search ?? '').toLowerCase().trim();
    const depts = getSubDivisionsForDivision(b.divisionCode);
    if (!search) return depts;
    const divisionMatch =
      b.divisionName.toLowerCase().includes(search) ||
      b.divisionCode.toLowerCase().includes(search) ||
      b.city.toLowerCase().includes(search);
    return divisionMatch
      ? depts
      : depts.filter(d => d.subDivisionName.toLowerCase().includes(search));
  }

  // ── Block / focus helpers ────────────────────────────────────────────────

  /** Resolves the real record behind a node id (any level) and reports whether it's inactive. */
  isBlocked(id: string): boolean {
    const parts = id.split('::');
    if (parts.length === 1) {
      const division = findDivisionByCode(id);
      if (division) return division.status === 'inactive';
      return this.companyDataService.getById(id)?.blocked === true;
    }
    if (parts.length === 2) {
      return findSubDivision(parts[0], parts[1])?.status === 'inactive';
    }
    if (parts.length === 3) {
      return this.getScopeByNodeId(id)?.status === 'inactive';
    }
    return this.getSubscopeByNodeId(id)?.status === 'inactive';
  }

  /**
   * True if this node OR any ancestor (company → division → sub-division → scope)
   * is inactive. Drives disabling View/Edit/Focus so a deactivated node's
   * whole subtree becomes non-interactive — only that node's own
   * Activate/Deactivate control (driven by `isBlocked`, own status only)
   * stays clickable, so it can be reactivated independently.
   */
  isEffectivelyBlocked(data: OrgNodeData): boolean {
    if (this.isBlocked(data.id)) return true;

    const company = this.companyDataService.getById(this.currentCompany() ?? '');
    if (!company || data.type === 'company') return false;
    if (company.blocked) return true;
    if (data.type === 'division') return false;

    const divisionCode = data.id.split('::')[0];
    const division = findDivisionByCode(divisionCode);
    if (!division) return false;
    if (division.status === 'inactive') return true;
    if (data.type === 'subDivision') return false;

    const deptName = data.id.split('::')[1];
    // Division-level scopes have no sub-division ancestor (company → division → scope).
    if (deptName !== DIVISION_SCOPE_SEGMENT) {
      const dept = findSubDivision(divisionCode, deptName);
      if (!dept) return false;
      if (dept.status === 'inactive') return true;
    }
    if (data.type === 'scope') return false;

    const scopeName = data.id.split('::')[2];
    const scopes = getScopesForParent(divisionCode, deptName);
    const parentScope = scopes.find(s => s.scopeName === scopeName && s.parentScopeId === null);
    return parentScope?.status === 'inactive';
  }

  isFocused(): boolean {
    return this.focusedNodeId() !== null;
  }

  focusOnSubtree(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    this.focusedNodeId.set(data.id);
  }

  resetFocus(): void {
    this.focusedNodeId.set(null);
  }

  openConfirmation(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    this._pendingNode.set(data);
    this.displayConfirmation.set(true);
  }

  closeConfirmation(): void {
    this.displayConfirmation.set(false);
    this._pendingNode.set(null);
  }

  confirmToggleBlocked(): void {
    const node = this._pendingNode();
    if (node) {
      const next = this.isBlocked(node.id) ? 'active' : 'inactive';
      switch (node.type) {
        case 'company':
          this.companyDataService.toggleBlocked(node.id);
          break;
        case 'division':
          setDivisionStatus(node.id, next);
          break;
        case 'subDivision': {
          const [divisionCode, deptName] = node.id.split('::');
          const dept = findSubDivision(divisionCode, deptName);
          if (dept) setSubDivisionStatus(dept.subDivisionCode, next);
          break;
        }
        case 'scope': {
          const scope = this.getScopeByNodeId(node.id);
          if (scope) setScopeStatus(scope.id, next);
          break;
        }
        case 'subscope': {
          const ss = this.getSubscopeByNodeId(node.id);
          if (ss) setScopeStatus(ss.id, next);
          break;
        }
      }
      this.bumpRefresh();
    }
    this.closeConfirmation();
  }

  // ── Company actions ───────────────────────────────────────────────────────

  viewCompany(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    this.drawer.open(CompanyProfileComponent, {
      width: '769px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: this.buildCompanyProfileData(data) as CompanyProfileData,
    });
  }

  async editCompany(data: OrgNodeData, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ref = this.drawer.open<CompanyFormModel, AddCompanyDrawerData>(AddCompanyModalComponent, {
      width: '769px',
      data: { existing: this.buildCompanyFormModel(data), type: 'Edit' },
    });
    const result = await ref.afterClosed;
    if (!result || result.approval) return;

    const companyId = data.companyKey;
    if (!companyId) return;
    const existing = this.companyDataService.getById(companyId);
    if (!existing) return;

    const patch: Partial<Company> = {
      companyName: result.companyName ?? existing.companyName,
      typeOfEntity: result.typeOfEntity ?? undefined,
      industrySector: result.industrySector ?? undefined,
      ownershipType: result.ownershipType ?? undefined,
      countryOfIncorporation: result.countryOfIncorporation ?? undefined,
      regionEmirate: result.regionEmirate ?? undefined,
      city: result.city ?? undefined,
      address: result.address ?? undefined,
      email: result.email ?? undefined,
      phone: result.phone ?? undefined,
      website: result.website ?? undefined,
      tradeLegalRegNumber: result.tradeLegalRegNumber ?? undefined,
      dateOfIncorporation: result.dateOfIncorporation ?? null,
      parentCompany: result.parentCompany ?? undefined,
      groupAffiliation: result.groupAffiliation ?? undefined,
      notes: result.notes ?? undefined,
      isRegulated: result.isRegulated ?? undefined,
      regIndustry: result.regIndustry ?? undefined,
      regulatoryLicenseNumber: result.regulatoryLicenseNumber ?? undefined,
      licenseExpiryDate: result.licenseExpiryDate ?? null,
      regulatoryNotes: result.regulatoryNotes ?? undefined,
      currencyAccount: result.currencyAccount ?? undefined,
      annualTurnoverBracket: result.annualTurnoverBracket ?? undefined,
      numberOfEmployees: result.numberOfEmployees ?? existing.numberOfEmployees ?? null,
      numberOfSubDivisionsLocations: result.numberOfSubDivisionsLocations ?? existing.numberOfSubDivisionsLocations ?? null,
      fiscalYearStart: result.fiscalYearStart ?? undefined,
      treasuryFunctionsPresent: result.treasuryFunctionsPresent ?? undefined,
      cashHandlingInvolved: result.cashHandlingInvolved ?? undefined,
      riskRating: result.riskRating ?? undefined,
      riskOwner: result.riskOwner ?? undefined,
      lastAuditDate: result.lastAuditDate ?? null,
      nextPlannedAuditCycle: result.nextPlannedAuditCycle ?? undefined,
      residualRiskScore: result.residualRiskScore ?? undefined,
      riskNotes: result.riskNotes ?? undefined,
    };
    this.companyDataService.update(companyId, patch);
    this.bumpRefresh();
  }

  // ── Division actions ────────────────────────────────────────────────────────

  viewDivision(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    const division = this.getDivisionByCode(data.id);
    if (division) {
      this.drawer.open(DivisionProfileComponent, {
        width: '720px',
        styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
        data: { division } as unknown as DivisionProfileDrawerData,
      });
    }
  }

  async editDivision(data: OrgNodeData, ev: Event): Promise<void> {
    ev.stopPropagation();
    const division = this.getDivisionByCode(data.id);
    if (!division) return;
    const result = await this.drawer.open<AddDivisionsDrawerResult, AddDivisionsDrawerData>(AddDivisions, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'edit', division, initialTab: 0 },
    }).afterClosed;

    if (!result?.divisionUpdate) return;
    editStaticDivision(division.divisionCode, result.divisionUpdate as unknown as DivisionEditableFields);
    this.bumpRefresh();
  }

  // ── Sub-Division actions ────────────────────────────────────────────────────

  viewSubDivision(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    const divisionCode = data.id.split('::')[0];
    const deptName = data.id.split('::')[1];
    const division = this.getDivisionByCode(divisionCode);
    const dept = findSubDivision(divisionCode, deptName);
    if (dept) {
      const scopes = getScopesForSubDivision(divisionCode, deptName);
      const topScopes = scopes.filter(s => s.parentScopeId === null);
      const scopesNested = topScopes.map(s => ({
        ...s,
        subScopes: scopes
          .filter(ss => ss.parentScopeId === s.id)
          .map(ss => ({ ...ss, subScopeName: ss.scopeName, subScopeType: ss.scopeType })),
      }));
      this.drawer.open(SubDivisionProfileComponent, {
        width: '700px',
        styleClass: 'dept-profile-drawer rounded-tl-[35px] rounded-bl-[35px]',
        data: {
          subDivision: { ...this.toSubDivisionFormShape(dept), scopes: scopesNested },
          divisionName: division?.divisionName ?? '',
        } as unknown as SubDivisionProfileDrawerData,
      });
    }
  }

  /**
   * This page's seed keeps the department value (finance, human-resources…) in
   * `subDivisionType`, whereas the shared Sub-Division form/profile now use
   * `subDivisionType` for the Division Type domain (head_office, branch,
   * department…) plus a separate `departmentType`. Every org-chart record is a
   * department, so map it into that shape before handing it to those drawers.
   */
  private toSubDivisionFormShape<T extends { subDivisionType: string }>(dept: T) {
    return { ...dept, subDivisionType: 'department', departmentType: dept.subDivisionType };
  }

  /** Reverse of toSubDivisionFormShape for the edit drawer's result — keeps the existing department value if none was picked. */
  private fromSubDivisionFormUpdate(update: unknown, currentType: string): SubDivisionEditableFields {
    const { departmentType, subDivisionType: _formType, ...rest } = update as { departmentType?: string | null; subDivisionType?: string };
    return { ...rest, subDivisionType: departmentType ?? currentType } as unknown as SubDivisionEditableFields;
  }

  async editSubDivision(data: OrgNodeData, ev: Event): Promise<void> {
    ev.stopPropagation();
    const divisionCode = data.id.split('::')[0];
    const deptName = data.id.split('::')[1];
    const division = this.getDivisionByCode(divisionCode);
    const dept = findSubDivision(divisionCode, deptName);
    if (!dept || !division) return;

    const result = await this.drawer.open<AddSubDivisionDrawerResult, AddSubDivisionDrawerData>(AddSubDivisionComponent, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: {
        mode: 'edit',
        subDivision: { ...this.toSubDivisionFormShape(dept), divisionCode: division.divisionCode } as unknown as SubDivisionFormSubDivision,
      },
    }).afterClosed;

    if (!result?.subDivisionUpdate) return;
    editStaticSubDivision(
      result.previousSubDivisionCode ?? dept.subDivisionCode,
      this.fromSubDivisionFormUpdate(result.subDivisionUpdate, dept.subDivisionType),
    );
    this.bumpRefresh();
  }

  // ── Scope actions ──────────────────────────────────────────────────────────

  viewScope(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    const scope = this.getScopeByNodeId(data.id);
    if (!scope) return;
    const subScopes = subScopesOf(scope.id).map(s => ({ ...s, subScopeName: s.scopeName, subScopeType: s.scopeType }));
    this.drawer.open(ScopeProfileComponent, {
      width: '720px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { scope: { ...scope, subScopes }, subscope: null, parentName: data.subtitle } as unknown as ScopeProfileDrawerData,
    });
  }

  async editScope(data: OrgNodeData, ev: Event): Promise<void> {
    ev.stopPropagation();
    const scope = this.getScopeByNodeId(data.id);
    if (!scope) return;
    const result = await this.drawer.open<AddAuditScopeDrawerResult, AddAuditScopeDrawerData>(AddAuditScopeComponent, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'edit', scope, initialTab: 0 } as unknown as AddAuditScopeDrawerData,
    }).afterClosed;

    if (!result?.scopeUpdate) return;
    editStaticScope(scope.id, result.scopeUpdate as unknown as Omit<StaticScope, 'id'>);
    this.bumpRefresh();
  }

  viewSubscope(data: OrgNodeData, ev: Event): void {
    ev.stopPropagation();
    const ss = this.getSubscopeByNodeId(data.id);
    if (!ss) return;
    this.drawer.open(ScopeProfileComponent, {
      width: '720px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: {
        scope: null,
        subscope: { ...ss, subScopeName: ss.scopeName, subScopeType: ss.scopeType },
        parentName: data.subtitle,
      } as unknown as ScopeProfileDrawerData,
    });
  }

  async editSubscope(data: OrgNodeData, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ss = this.getSubscopeByNodeId(data.id);
    if (!ss) return;
    const result = await this.drawer.open<AddAuditScopeDrawerResult, AddAuditScopeDrawerData>(AddAuditScopeComponent, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'edit', scope: ss, initialTab: 0 } as unknown as AddAuditScopeDrawerData,
    }).afterClosed;

    if (!result?.scopeUpdate) return;
    editStaticScope(ss.id, result.scopeUpdate as unknown as Omit<StaticScope, 'id'>);
    this.bumpRefresh();
  }

  // ── List-view specific helpers ────────────────────────────────────────────

  /** Open block/unblock confirmation from list view. */
  openConfirmationInList(id: string, name: string, type: OrgNodeType, ev: Event): void {
    ev.stopPropagation();
    this._pendingNode.set({ type, id, name, subtitle: '' });
    this.displayConfirmation.set(true);
  }

  /** Switch to chart view and focus on the given subtree. */
  focusListNode(id: string, ev: Event): void {
    ev.stopPropagation();
    this.focusedNodeId.set(id);
    this.viewMode.set('chart');
  }

  viewDivisionInList(divisionCode: string, ev: Event): void {
    ev.stopPropagation();
    const division = this.getDivisionByCode(divisionCode);
    if (division) {
      this.drawer.open(DivisionProfileComponent, {
        width: '720px',
        styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
        data: { division } as unknown as DivisionProfileDrawerData,
      });
    }
  }

  async editDivisionInList(divisionCode: string, ev: Event): Promise<void> {
    ev.stopPropagation();
    const division = this.getDivisionByCode(divisionCode);
    if (!division) return;
    const result = await this.drawer.open<AddDivisionsDrawerResult, AddDivisionsDrawerData>(AddDivisions, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: { mode: 'edit', division, initialTab: 0 },
    }).afterClosed;

    if (!result?.divisionUpdate) return;
    editStaticDivision(division.divisionCode, result.divisionUpdate as unknown as DivisionEditableFields);
    this.bumpRefresh();
  }

  viewDeptInList(divisionCode: string, deptName: string, ev: Event): void {
    ev.stopPropagation();
    const division = this.getDivisionByCode(divisionCode);
    const dept = findSubDivision(divisionCode, deptName);
    if (dept) {
      const scopes = getScopesForSubDivision(divisionCode, deptName);
      const topScopes = scopes.filter(s => s.parentScopeId === null);
      const scopesNested = topScopes.map(s => ({
        ...s,
        subScopes: scopes
          .filter(ss => ss.parentScopeId === s.id)
          .map(ss => ({ ...ss, subScopeName: ss.scopeName, subScopeType: ss.scopeType })),
      }));
      this.drawer.open(SubDivisionProfileComponent, {
        width: '720px',
        styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
        data: {
          subDivision: { ...this.toSubDivisionFormShape(dept), scopes: scopesNested },
          divisionName: division?.divisionName ?? '',
        } as unknown as SubDivisionProfileDrawerData,
      });
    }
  }

  async editDeptInList(divisionCode: string, deptName: string, ev: Event): Promise<void> {
    ev.stopPropagation();
    const division = this.getDivisionByCode(divisionCode);
    const dept = findSubDivision(divisionCode, deptName);
    if (!dept || !division) return;

    const result = await this.drawer.open<AddSubDivisionDrawerResult, AddSubDivisionDrawerData>(AddSubDivisionComponent, {
      width: '700px',
      styleClass: 'rounded-tl-[35px] rounded-bl-[35px]',
      data: {
        mode: 'edit',
        subDivision: { ...this.toSubDivisionFormShape(dept), divisionCode: division.divisionCode } as unknown as SubDivisionFormSubDivision,
      },
    }).afterClosed;

    if (!result?.subDivisionUpdate) return;
    editStaticSubDivision(
      result.previousSubDivisionCode ?? dept.subDivisionCode,
      this.fromSubDivisionFormUpdate(result.subDivisionUpdate, dept.subDivisionType),
    );
    this.bumpRefresh();
  }

  // ── Quick-select ─────────────────────────────────────────────────────────

  quickSelect(value: string): void {
    this.filters.patchValue({ company: value });
    this.focusedNodeId.set(null);
  }

  // ── Label helpers ────────────────────────────────────────────────────────

  scopeTypeLabel(t?: string): string {
    const m: Record<string, string> = {
      subDivisional: 'SubDivisional', functional: 'Functional', independent: 'Independent',
    };
    return m[t ?? ''] ?? (t ?? '');
  }

  auditFrequencyLabel(f?: string): string {
    const m: Record<string, string> = { quarterly: 'Quarterly', annually: 'Annually', monthly: 'Monthly' };
    return m[f ?? ''] ?? (f ?? '');
  }

  modeOfAuditLabel(m?: string): string {
    const map: Record<string, string> = {
      full: 'Full', limited: 'Limited', thematic: 'Thematic', 'follow-up': 'Follow-up', continuous: 'Continuous',
    };
    return map[m ?? ''] ?? (m ?? '');
  }

  riskSeverity(r?: string): 'success' | 'warn' | 'danger' | 'secondary' {
    return r === 'low' ? 'success' : r === 'medium' ? 'warn' : r === 'high' ? 'danger' : 'secondary';
  }

  auditSeverity(s?: string): 'success' | 'info' | 'warn' | 'secondary' {
    const m: Record<string, 'success' | 'info' | 'warn' | 'secondary'> = {
      completed: 'success', in_progress: 'info', planned: 'warn', not_planned: 'secondary',
    };
    return m[s ?? ''] ?? 'secondary';
  }

  statusSeverity(s?: string): 'success' | 'secondary' {
    return s === 'active' ? 'success' : 'secondary';
  }

  divisionTypeLabel(t?: string): string {
    const m: Record<string, string> = {
      head_office: 'Head Office', division: 'Division', branch: 'Branch', department: 'Department', representative_office: 'Rep. Office',
      warehouse: 'Warehouse', factory: 'Factory', project_office: 'Project Office', subsidiary: 'Subsidiary',
    };
    return m[t ?? ''] ?? (t ?? '');
  }

  auditLabel(s?: string): string {
    const m: Record<string, string> = {
      completed: 'Completed', in_progress: 'In Progress', planned: 'Planned', not_planned: 'Not Planned',
    };
    return m[s ?? ''] ?? (s ?? '');
  }

  riskStatusLabel(s?: string): string {
    const m: Record<string, string> = { open: 'Open', closed: 'Closed', monitored: 'Monitored' };
    return m[s ?? ''] ?? (s ?? '');
  }

  emirateStateLabel(s?: string): string {
    const m: Record<string, string> = {
      dubai: 'Dubai', abudhabi: 'Abu Dhabi', sharjah: 'Sharjah',
      fujairah: 'Fujairah', rak: 'Ras Al Khaimah', ajman: 'Ajman',
      ummalquwain: 'Umm Al Quwain', khorfakkan: 'Khorfakkan',
      riyadh: 'Riyadh Province', makkah: 'Makkah Province',
      eastern: 'Eastern Province', tabuk: 'Tabuk Province', madinah: 'Al Madinah Province',
      capital: 'Capital', southern: 'Southern', muharraq: 'Muharraq',
      central: 'Central', northern: 'Northern',
      hawalli: 'Hawalli', jahra: 'Jahra', ahmadi: 'Ahmadi',
      farwaniya: 'Farwaniya', mubarak: 'Mubarak Al-Kabeer',
    };
    return m[s ?? ''] ?? (s ?? '');
  }

  getCompanyColor(key?: string): string {
    if (!key) return '#102e70';
    return this.companyDataService.getById(key)?.color ?? '#102e70';
  }

  getCompanyIcon(_key?: string): string {
    return 'pi pi-building';
  }

  // ── zoomin feature for org-chart ─────────────────────────────────────────
  readonly zoomLevel = signal<number>(0.56);
  private readonly MIN_ZOOM = 0.25;
  private readonly MAX_ZOOM = 3;
  private readonly ZOOM_STEP = 0.1;

  zoomIn(): void { this.zoomLevel.update(z => Math.min(+(z + this.ZOOM_STEP).toFixed(2), this.MAX_ZOOM)); }
  zoomOut(): void { this.zoomLevel.update(z => Math.max(+(z - this.ZOOM_STEP).toFixed(2), this.MIN_ZOOM)); }
  resetZoom(): void { this.zoomLevel.set(1); }

  onChartWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.deltaY < 0 ? this.zoomIn() : this.zoomOut();
  }

  /** Scrolls the chart viewport so the (horizontally centered) content is centered in view. */
  private centerChart(): void {
    const el = this.chartWrapRef()?.nativeElement;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }

  // ── Grab-to-pan tool ─────────────────────────────────────────────────────
  readonly panModeEnabled = signal<boolean>(false);
  readonly isPanning = signal<boolean>(false);
  // ([class.pan-mode-active]="panModeEnabled()", [class.is-active]="panModeEnabled()",
  // [class.is-panning]="isPanning()"). panModeEnabled is the on/off toggle from the header
  //  button; isPanning is only true while the mouse button is actually held down, i.e. what
  // flips the cursor from grab to grabbing.

  private panStartX = 0;
  private panStartY = 0;
  private panScrollLeft = 0;
  private panScrollTop = 0;
  private panHighlightedEl: HTMLElement | null = null;
  //Plain (non-signal) fields — just scratch storage for the current drag. They're deliberately not
  //  signals: they get written on every mousemove, and if they were signals every write would schedule change detection,
  //   defeating the whole point of runOutsideAngular.

  /** Whichever element actually owns vertical scrolling for the chart —
   *  #chartWrap itself if it's tall/overflow-bound enough to scroll on its
   *  own, otherwise the nearest scrollable ancestor. `null` means nothing
   *  in between scrolls, so the document/window should be panned instead.
   *  Resolved fresh on every pan start since layout can change (zoom,
   *  filters, expand/collapse all resize the chart). */
  private panVerticalTarget: HTMLElement | null = null;

  private readonly onPanMoveBound = (e: MouseEvent) => this.onPanMove(e);
  private readonly onPanEndBound = () => this.onPanEnd();

  /** Toggles Pan Mode on/off from the header hand-icon button. */
  togglePanMode(): void {
    this.panModeEnabled.update(v => !v);
    if (!this.panModeEnabled()) this.clearPanHighlight();
  }

  /** Blocks native image/text drag-out while Pan Mode is active — it would otherwise fight with drag-to-scroll. */
  onChartDragStart(event: DragEvent): void {
    if (this.panModeEnabled()) event.preventDefault();
  }

  /** Starts a pan gesture. Ignores clicks on interactive controls so node actions & the org-chart toggler still work. */
  onChartMouseDown(event: MouseEvent): void {
    if (!this.panModeEnabled() || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, input, a, .p-select, .p-multiselect, .p-node-toggler')) return;

    const el = this.chartWrapRef()?.nativeElement;
    if (!el) return;

    event.preventDefault();

    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panScrollLeft = el.scrollLeft;

    // #chartWrap only ever grows tall enough to actually overflow (and thus
    // scroll) horizontally on its own — vertically it just expands (see
    // min-height: 60vh in the SCSS with no bound) and an ancestor, or the
    // page itself, ends up owning the scroll instead. Setting el.scrollTop
    // on an element with nothing to scroll is a no-op, which is exactly why
    // vertical hand-panning did nothing before. Find whoever really owns
    // the vertical scroll so panning can drive it.
    this.panVerticalTarget = this.findVerticalScrollTarget(el);
    this.panScrollTop = this.panVerticalTarget
      ? this.panVerticalTarget.scrollTop
      : (document.scrollingElement?.scrollTop ?? window.scrollY);
    this.isPanning.set(true);

    // High-frequency mousemove only touches raw DOM (scroll offset + a class toggle),
    // so run the drag outside Angular's zone to avoid needless change detection.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onPanMoveBound);
      window.addEventListener('mouseup', this.onPanEndBound);
      window.addEventListener('mouseleave', this.onPanEndBound);
    });
  }

  private onPanMove(event: MouseEvent): void {
    const el = this.chartWrapRef()?.nativeElement;
    if (!el) return;

    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    el.scrollLeft = this.panScrollLeft - dx;

    const newTop = this.panScrollTop - dy;
    if (this.panVerticalTarget) {
      this.panVerticalTarget.scrollTop = newTop;
    } else if (document.scrollingElement) {
      document.scrollingElement.scrollTop = newTop;
    } else {
      window.scrollTo(window.scrollX, newTop);
    }

    this.updatePanHighlight(event.clientX, event.clientY);
  }

  private onPanEnd(): void {
    window.removeEventListener('mousemove', this.onPanMoveBound);
    window.removeEventListener('mouseup', this.onPanEndBound);
    window.removeEventListener('mouseleave', this.onPanEndBound);
    this.clearPanHighlight();
    this.panVerticalTarget = null;
    this.zone.run(() => this.isPanning.set(false));
  }

  /**
   * Walks up from #chartWrap to find whichever element has vertical
   * overflow scrolling enabled (overflow-y: auto/scroll) AND content taller
   * than its box — i.e. the element whose scrollTop actually needs to move
   * for vertical hand-panning to have any visible effect. Returns null when
   * no such ancestor exists, meaning the document itself should be panned.
   */
  private findVerticalScrollTarget(start: HTMLElement): HTMLElement | null {
    let node: HTMLElement | null = start;
    while (node && node !== document.documentElement && node !== document.body) {
      const style = getComputedStyle(node);
      const canScrollY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight;
      if (canScrollY) return node;
      node = node.parentElement;
    }
    return null;
  }

  /** Highlights whichever node card the hand icon is currently travelling over. */
  private updatePanHighlight(clientX: number, clientY: number): void {
    const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const card = hit?.closest('.node-card') as HTMLElement | null;
    if (card === this.panHighlightedEl) return;

    this.panHighlightedEl?.classList.remove('node-card--pan-highlight');
    card?.classList.add('node-card--pan-highlight');
    this.panHighlightedEl = card;
  }

  private clearPanHighlight(): void {
    this.panHighlightedEl?.classList.remove('node-card--pan-highlight');
    this.panHighlightedEl = null;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private getDivisionByCode(code: string): StaticDivision | null {
    return findDivisionByCode(code);
  }

  private getScopeByNodeId(nodeId: string): StaticScope | null {
    const [divisionCode, deptName, scopeName] = nodeId.split('::');
    return getScopesForParent(divisionCode, deptName)
      .find(s => s.scopeName === scopeName && s.parentScopeId === null) ?? null;
  }

  private getSubscopeByNodeId(nodeId: string): StaticScope | null {
    const [divisionCode, deptName, scopeName, subScopeName] = nodeId.split('::');
    const scopes = getScopesForParent(divisionCode, deptName);
    const parent = scopes.find(s => s.scopeName === scopeName && s.parentScopeId === null);
    if (!parent) return null;
    return scopes.find(s => s.parentScopeId === parent.id && s.scopeName === subScopeName) ?? null;
  }

  private buildCompanyProfileData(data: OrgNodeData): CompanyProfileData {
    const company = this.companyDataService.getById(data.companyKey ?? '');

    if (!company) {
      return { id: data.id, name: data.name, numberOfEmployees: data.employeeCount, numberOfSubDivisionsLocations: data.divisionCount };
    }

    const countryNames: Record<string, string> = {
      AE: 'United Arab Emirates', SA: 'Saudi Arabia', BH: 'Bahrain', KW: 'Kuwait',
    };
    const regionNames: Record<string, string> = {
      dubai: 'Dubai', abudhabi: 'Abu Dhabi', sharjah: 'Sharjah', fujairah: 'Fujairah',
      rak: 'Ras Al Khaimah', ajman: 'Ajman', riyadh: 'Riyadh Province', makkah: 'Makkah Province',
      eastern: 'Eastern Province', tabuk: 'Tabuk Province', madinah: 'Al Madinah Province',
      capital: 'Capital', central: 'Central', hawalli: 'Hawalli',
    };
    const ownershipNames: Record<string, string> = {
      private: 'Private', public: 'Public', government: 'Government',
      family: 'Family-Owned', 'joint-venture': 'Joint Venture', foreign: 'Foreign-Owned',
    };

    return {
      id: company.id,
      name: company.companyName,
      blocked: company.blocked,
      entityType: company.typeOfEntity ?? undefined,
      industry: company.industrySector ?? undefined,
      ownershipType: company.ownershipType ? (ownershipNames[company.ownershipType] ?? company.ownershipType) : undefined,
      country: company.countryOfIncorporation ? (countryNames[company.countryOfIncorporation] ?? company.countryOfIncorporation) : undefined,
      region: company.regionEmirate ? (regionNames[company.regionEmirate] ?? company.regionEmirate) : undefined,
      city: company.city ?? undefined,
      address: company.address ?? undefined,
      email: company.email ?? undefined,
      phone: company.phone ?? undefined,
      website: company.website ?? undefined,
      tradeLegalRegNumber: company.tradeLegalRegNumber ?? undefined,
      dateOfIncorporation: company.dateOfIncorporation ?? undefined,
      parentCompany: company.parentCompany ?? undefined,
      groupAffiliation: company.groupAffiliation ?? undefined,
      notes: company.notes ?? undefined,
      isRegulated: company.isRegulated ?? undefined,
      regIndustry: company.regIndustry ?? undefined,
      regulatoryLicenseNumber: company.regulatoryLicenseNumber ?? undefined,
      licenseExpiryDate: company.licenseExpiryDate ?? undefined,
      regulatoryNotes: company.regulatoryNotes ?? undefined,
      currencyAccount: company.currencyAccount ?? undefined,
      annualTurnoverBracket: company.annualTurnoverBracket ?? undefined,
      numberOfEmployees: company.numberOfEmployees ?? undefined,
      numberOfSubDivisionsLocations: company.numberOfSubDivisionsLocations ?? undefined,
      fiscalYearStart: company.fiscalYearStart ?? undefined,
      treasuryFunctionsPresent: company.treasuryFunctionsPresent ?? undefined,
      cashHandlingInvolved: company.cashHandlingInvolved ?? undefined,
      riskRating: company.riskRating ?? undefined,
      riskOwner: company.riskOwner ?? undefined,
      lastAuditDate: company.lastAuditDate ?? undefined,
      nextPlannedAuditCycle: company.nextPlannedAuditCycle ?? undefined,
      residualRiskScore: company.residualRiskScore ?? undefined,
      riskNotes: company.riskNotes ?? undefined,
    };
  }

  private buildCompanyFormModel(data: OrgNodeData): CompanyFormModel {
    const company = this.companyDataService.getById(data.companyKey ?? '');
    if (!company) {
      return {
        companyName: data.name,
        numberOfEmployees: data.employeeCount ?? null,
        numberOfSubDivisionsLocations: data.divisionCount ?? null,
      };
    }
    return {
      companyName: company.companyName,
      tradeLegalRegNumber: company.tradeLegalRegNumber ?? null,
      dateOfIncorporation: company.dateOfIncorporation ?? null,
      countryOfIncorporation: company.countryOfIncorporation ?? null,
      regionEmirate: company.regionEmirate ?? null,
      city: company.city ?? null,
      industrySector: company.industrySector ?? null,
      typeOfEntity: company.typeOfEntity ?? null,
      ownershipType: company.ownershipType ?? null,
      address: company.address ?? null,
      email: company.email ?? null,
      phone: company.phone ?? null,
      website: company.website ?? null,
      parentCompany: company.parentCompany ?? null,
      groupAffiliation: company.groupAffiliation ?? null,
      notes: company.notes ?? null,
      isRegulated: company.isRegulated ?? null,
      regIndustry: company.regIndustry ?? null,
      regulatoryLicenseNumber: company.regulatoryLicenseNumber ?? null,
      licenseExpiryDate: company.licenseExpiryDate ?? null,
      regulatoryNotes: company.regulatoryNotes ?? null,
      currencyAccount: company.currencyAccount ?? null,
      annualTurnoverBracket: company.annualTurnoverBracket ?? null,
      numberOfEmployees: company.numberOfEmployees ?? null,
      numberOfSubDivisionsLocations: company.numberOfSubDivisionsLocations ?? null,
      fiscalYearStart: company.fiscalYearStart ?? null,
      treasuryFunctionsPresent: company.treasuryFunctionsPresent ?? null,
      cashHandlingInvolved: company.cashHandlingInvolved ?? null,
      riskRating: company.riskRating ?? null,
      riskOwner: company.riskOwner ?? null,
      lastAuditDate: company.lastAuditDate ?? null,
      nextPlannedAuditCycle: company.nextPlannedAuditCycle ?? null,
      residualRiskScore: company.residualRiskScore ?? null,
      riskNotes: company.riskNotes ?? null,
    };
  }
}

// ── Pure tree helper ─────────────────────────────────────────────────────────

function findOrgNode(tree: OrgTreeNode[], id: string): OrgTreeNode | null {
  for (const node of tree) {
    if (node.data?.id === id) return node;
    if (node.children?.length) {
      const found = findOrgNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
