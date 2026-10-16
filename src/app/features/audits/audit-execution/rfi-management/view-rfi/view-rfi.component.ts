import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ConfirmDialogService } from '@/app/shared/components/services/confirm-dialog.service';
import { FormsModule } from '@angular/forms';

import { Subscription } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { QuestionareSection } from '@/app/features/audits/audit-execution/rfi-management/questionare-section/questionare-section.component';
import type { EnrichedRFI } from '@/app/features/audits/audit-execution/rfi-management/models/rfi.model';
import type { ViewRfiDrawerData } from '@/app/features/audits/audit-execution/rfi-management/models/rfi-drawer.model';
import type { StaticDoc } from '@/app/features/audits/audit-execution/rfi-management/models/rfi-document.model';
import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { ToastService } from '@/app/shared/components/toast/toast.service';
import { acceptStaticRfiResponse, rejectStaticRfiResponse } from '@/app/features/audits/audit-execution/rfi-management/rfi-static-data';
import { resolveScopeOrgLabels, type ScopeOrgLabels } from '@/app/shared/utils/no-sub-division-message';

@Component({
  selector: 'app-view-rfi',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    TabsModule,
    ButtonModule,
    CardModule,
    ChipModule,
    DividerModule,
    MessageModule,
    PanelModule,
    TagModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
    DialogModule,
    QuestionareSection,
  ],
  providers: [MessageService],
  templateUrl: './view-rfi.component.html',
  styleUrl: './view-rfi.component.scss',
})
export class ViewRfi implements OnDestroy {
  private readonly drawerRef = inject(DrawerRef);
  private readonly confirmSvc = inject(ConfirmDialogService);
  protected readonly data = inject(DRAWER_DATA, { optional: true }) as ViewRfiDrawerData | null;

  private readonly toast = inject(ToastService);

  // ── RFI being viewed — always set for this component ───────────────────────
  rfi: EnrichedRFI | null = this.data?.rfi ?? null;

  /** Live company / division / sub-division labels — `rfi.company` is only the company id. */
  get org(): ScopeOrgLabels | null {
    return this.rfi
      ? resolveScopeOrgLabels(this.rfi.company, this.rfi.divisionCode, this.rfi.subDivisionLabel)
      : null;
  }

  // ── Current user — drives auditor vs client rendering ─────────────────────
  currentUser: string = this.data?.currentUser ?? 'auditor';

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'completed':    return 'success';
      case 'under-review': return 'secondary';
      case 'overdue':      return 'danger';
      case 'reopened':     return 'danger';
      default:             return 'warn';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'completed':    return 'Completed';
      case 'under-review': return 'Under Review';
      case 'overdue':      return 'Overdue';
      case 'reopened':     return 'Reopened';
      default:             return 'Pending';
    }
  }

  // Label for tab 0
  get tab1Label(): string {
    return 'View RFI';
  }

  activeTabIndex: string | number | undefined = 0;
  drawerWidth: string = '680px';
  showRejectInput = false;
  rejectReason = '';
  private readonly boundOnResize = (event: MouseEvent) => this.onResize(event);
  private readonly boundOnResizeEnd = () => this.onResizeEnd();
  private subs = new Subscription();

  // ── Static backend documents ───────────────────────────────────────────────
  staticDocs: StaticDoc[] = this.getDefaultStaticDocs();

  private getDefaultStaticDocs(): StaticDoc[] {
    return [
      {
        name: 'Audit_Theory_BRD.docx',
        url: 'http://localhost:5251/uploads/Audit_Theory_BRD.docx',
        description: 'Business Requirements Document detailing audit theory and engagement methodology',
      },
      {
        name: 'Cygnus_AURA_BRD 12 JAN 2026.docx',
        url: 'http://localhost:5251/uploads/Cygnus_AURA_BRD 12 JAN 2026.docx',
        description: 'Cygnus AURA platform Business Requirements Document — January 2026 release baseline',
      },
    ];
  }

  // ── Response status helpers ────────────────────────────────────────────────
  responseSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      default:         return 'info';
    }
  }

  responseStatusLabel(status: string): string {
    switch (status) {
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      default:         return 'Pending Review';
    }
  }

  constructor(private messageService: MessageService) {}

  // ── Open / Download static doc ─────────────────────────────────────────────
  // These docs are served by the real backend (`http://localhost:5251/uploads/...`),
  // not through HttpClient, so the global error interceptor can't catch a failure
  // here — check reachability ourselves before opening/downloading.
  private async isDocReachable(url: string): Promise<boolean> {
    try {
      await fetch(url, { method: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  }

  async openDoc(url: string): Promise<void> {
    if (!(await this.isDocReachable(url))) {
      this.toast.warning('This Feature is under development', '');
      return;
    }
    window.open(url, '_blank');
  }

  async downloadDoc(doc: StaticDoc): Promise<void> {
    if (!(await this.isDocReachable(doc.url))) {
      this.toast.warning('This Feature is under development', '');
      return;
    }
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Auditor accept / reject ────────────────────────────────────────────────
  async onAcceptRfi(): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Accept RFI Response',
      message: 'Are you sure you want to accept this client response? This action will mark the RFI as completed.',
      action: 'approve',
      confirmLabel: 'Yes, Accept',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    if (this.rfi) {
      acceptStaticRfiResponse(this.rfi.id);
    }
    this.onClose();
    this.toast.success('The client response has been accepted successfully.', 'RFI Approved');
    this.resetForm();
  }

  onRejectRfi(): void {
    this.showRejectInput = true;
  }

  async onSubmitReject(): Promise<void> {
    if (!this.rejectReason.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Reason Required',
        detail: 'Please provide a reason for rejection before submitting.',
      });
      return;
    }

    const ok = await this.confirmSvc.confirm({
      title: 'Reject RFI Response',
      message: `You are about to reject this RFI response. Reason: "${this.rejectReason}". This action cannot be undone.`,
      action: 'reject',
      confirmLabel: 'Yes, Reject',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    if (this.rfi) {
      rejectStaticRfiResponse(this.rfi.id, this.rejectReason);
    }
    this.onClose();
    this.toast.error(`RFI response rejected. Reason: ${this.rejectReason}`, 'RFI Rejected');
    this.rejectReason = '';
    this.showRejectInput = false;
    this.resetForm();
  }

  onCancelReject(): void {
    this.showRejectInput = false;
    this.rejectReason = '';
  }

  private resetForm(): void {
    this.showRejectInput = false;
    this.rejectReason = '';

    this.subs.unsubscribe();
    this.subs = new Subscription();

    this.staticDocs = this.getDefaultStaticDocs();
  }

  onClose(): void {
    this.drawerRef.close(null);
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    document.addEventListener('mousemove', this.boundOnResize);
    document.addEventListener('mouseup', this.boundOnResizeEnd);
  }

  private onResize(event: MouseEvent): void {
    const newWidth = window.innerWidth - event.clientX;
    if (newWidth >= 300 && newWidth <= 1200) {
      this.drawerWidth = `${newWidth}px`;
      const panel = document.querySelector('.add-rfi-drawer') as HTMLElement | null;
      if (panel) panel.style.width = this.drawerWidth;
    }
  }

  private onResizeEnd(): void {
    document.removeEventListener('mousemove', this.boundOnResize);
    document.removeEventListener('mouseup', this.boundOnResizeEnd);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    document.removeEventListener('mousemove', this.boundOnResize);
    document.removeEventListener('mouseup', this.boundOnResizeEnd);
  }
}
