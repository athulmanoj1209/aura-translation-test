import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TooltipModule } from 'primeng/tooltip';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

import {
  AuditFinding,
  AuditFindingService,
  ESCALATION_POLICY,
  FindingSeverity,
  FindingStatus,
} from '@/app/features/audits/audit-execution/findings/services/audit-finding.service';

type DetailTab = 'overview' | 'evidence' | 'history' | 'escalation';

/* ============================================================
 *  Finding Detail — routable page
 *
 *  Wire-up:
 *
 *    {
 *      path: 'follow-up-audit/:id',
 *      loadComponent: () =>
 *        import('./app/Admin/follow-up-audit/finding-detail.component')
 *          .then(c => c.FindingDetailComponent),
 *      data: { breadcrumb: 'Finding Detail' }
 *    }
 *
 *  The list page navigates here via router.navigate(['/follow-up-audit', f.id]).
 * ============================================================ */

@Component({
  selector: 'app-finding-detail',
  standalone: true,
  imports: [CommonModule, DatePipe,TooltipModule, DrawIconComponent],
  templateUrl: './findings-detail.component.html',
  styleUrls: ['./findings-detail.component.scss'],
})
export class FindingDetailComponent implements OnInit {
 
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly location   = inject(Location);
  private readonly service    = inject(AuditFindingService);
  private readonly destroyRef = inject(DestroyRef);
 
  readonly finding   = signal<AuditFinding | null>(null);
  readonly loading   = signal(true);
  readonly notFound  = signal(false);
  readonly tab       = signal<DetailTab>('overview');
 
  /** Org-wide policy rules (static — same for every finding). */
  readonly policy = ESCALATION_POLICY;
 
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
 
    this.service.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => {
        this.loading.set(false);
        if (f) this.finding.set(f);
        else this.notFound.set(true);
      });
  }
 
  /* ---------------- Navigation ---------------- */
 
  /** Path to the list page — change this if your list route differs. */
  private readonly listRoute = '/audits/follow-up';
 
  goBack(): void {
    // Prefer browser history (preserves table scroll / filters); fall
    // back to the list route if we landed here via a deep link.
    if (window.history.length > 1) this.location.back();
    else this.router.navigate([this.listRoute]);
  }
 
  setTab(t: DetailTab): void {
    this.tab.set(t);
  }
 
  /* ---------------- Display helpers ---------------- */
 
  severityLabel(s: FindingSeverity | undefined): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
 
  statusLabel(s: FindingStatus): string {
    switch (s) {
      case 'in-progress': return 'In Progress';
      default: return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
 
  /* ---------------- Evidence display helpers ---------------- */
 
  /** Pretty file size — "1.2 MB", "640 KB". */
  formatFileSize(bytes?: number): string {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024)         return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024)            return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }
 
  /** PrimeIcon class for a given file extension. */
  iconForFile(fileType?: string): string {
    switch (fileType?.toLowerCase()) {
      case 'pdf':                                              return 'pi-file-pdf';
      case 'xls': case 'xlsx': case 'csv':                     return 'pi-file-excel';
      case 'doc': case 'docx':                                 return 'pi-file-word';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return 'pi-image';
      case 'zip': case 'rar': case '7z':                       return 'pi-folder';
      default:                                                  return 'pi-file';
    }
  }
}