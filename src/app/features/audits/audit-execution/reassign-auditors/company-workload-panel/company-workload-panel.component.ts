import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';


import {
  AuditorOption, CompanyGroup, SubDivisionGroup, PendingMap, ScopeGroup, SelectionToggle, StageEvent, UnstageEvent,
} from '../models/auditor-reassignment.model';
import { AssignmentRowComponent } from '../assignment-row/assignment-row.component';

/** One collapsible company panel: division·sub-division group headers → scope rows. */
@Component({
  selector: 'app-company-workload-panel',
  standalone: true,
  imports: [CommonModule, AssignmentRowComponent],
  templateUrl: './company-workload-panel.component.html',
  styleUrls: ['./company-workload-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyWorkloadPanelComponent implements OnInit {
  company       = input.required<CompanyGroup>();
  targetOptions = input.required<AuditorOption[]>();
  fromAuditor   = input<AuditorOption | null>(null);
  pending       = input<PendingMap>(new Map());
  bulkMode      = input(false);
  selectedIds   = input<Set<number>>(new Set());
  busyIds       = input<Set<number>>(new Set());
  startOpen     = input(false);

  stage    = output<StageEvent>();
  unstage  = output<UnstageEvent>();
  toggle   = output<SelectionToggle>();

  expanded = signal(false);

  ngOnInit(): void {
    this.expanded.set(this.startOpen());
  }

  trackBySubDivision = (_: number, d: SubDivisionGroup) => d.key;
  trackByScope       = (_: number, s: ScopeGroup)       => s.key;
}