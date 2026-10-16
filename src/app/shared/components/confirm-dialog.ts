import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule, ButtonSeverity } from 'primeng/button';
import { ConfirmActionType, ConfirmDialogService } from './services/confirm-dialog.service';


/*
  Mount ONCE in app.component.html:
    <app-confirm-dialog></app-confirm-dialog>

  Add ConfirmDialogComponent to app.component.ts imports array.

  Call from any component / service:
    const ok = await this.confirmSvc.confirm({
      title:        'Confirm Approval',
      message:      'Are you sure you want to approve this observation?',
      action:       'approve',
      confirmLabel: 'Yes, Approve',
    });
    if (ok) { ... }
*/

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,   // signals auto-trigger OnPush checks
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <!-- Dialog stays in the DOM; [visible] is toggled by the signal. -->
    <p-dialog
      [header]="svc.state()?.title ?? ''"
      [visible]="!!svc.state()"
      (visibleChange)="!$event && svc.respond(false)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="false"
      [style]="{ width: '420px' }"
      [styleClass]="'confirm-dialog confirm-dialog--' + (svc.state()?.action ?? '')">

      <!-- Body — only rendered when state exists -->
      <ng-container *ngIf="svc.state() as cfg">
        <div class="confirm-body">
          <div class="confirm-body__icon-wrap" [ngClass]="'icon-wrap--' + cfg.action">
            <i class="pi" [ngClass]="iconClass(cfg.action)"></i>
          </div>
          <p class="confirm-body__text">{{ cfg.message }}</p>
        </div>
      </ng-container>

      <!-- Footer -->
      <ng-template pTemplate="footer">
        <ng-container *ngIf="svc.state() as cfg">
          <p-button
            [label]="cfg.cancelLabel ?? 'No, Cancel'"
            icon="pi pi-times"
            [text]="true"
            severity="secondary"
            (onClick)="svc.respond(false)">
          </p-button>
          <p-button
            [label]="cfg.confirmLabel ?? 'Yes, Confirm'"
            [icon]="confirmIcon(cfg.action)"
            [severity]="cfg.confirmSeverity ?? defaultSeverity(cfg.action)"
            [outlined]="true"
            autofocus
            (onClick)="svc.respond(true)">
          </p-button>
        </ng-container>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep {
      .confirm-dialog .p-dialog-header {
        padding: 1.25rem 1.5rem 0.75rem;
        border-bottom: 1px solid var(--surface-border);
      }
      .confirm-dialog .p-dialog-content { padding: 1.5rem; }
      .confirm-dialog .p-dialog-footer  {
        padding: 0.75rem 1.5rem 1.25rem;
        display: flex; justify-content: flex-end; gap: 0.5rem;
        border-top: 1px solid var(--surface-border);
      }
    }

    .confirm-body {
      display: flex; flex-direction: column; align-items: center;
      gap: 1rem; text-align: center;

      &__icon-wrap {
        width: 56px; height: 56px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.6rem;

        &.icon-wrap--approve { background: #dcfce7; color: #16a34a; }
        &.icon-wrap--reject  { background: #fef2f2; color: #dc2626; }
        &.icon-wrap--delete  { background: #fef2f2; color: #dc2626; }
        &.icon-wrap--warning { background: #fff7ed; color: #ea580c; }
        &.icon-wrap--info    { background: var(--surface-hover); color: #2563eb; }
      }

      &__text { margin: 0; font-size: 0.95rem; color: #374151; line-height: 1.5; }
    }
  `],
})
export class ConfirmDialogComponent {
  readonly svc = inject(ConfirmDialogService);

  iconClass(action: ConfirmActionType): string {
    const map: Record<ConfirmActionType, string> = {
      approve: 'pi-check-circle',
      reject:  'pi-times-circle',
      delete:  'pi-trash',
      warning: 'pi-exclamation-triangle',
      info:    'pi-info-circle',
    };
    return map[action] ?? 'pi-question-circle';
  }

  confirmIcon(action: ConfirmActionType): string {
    const map: Record<ConfirmActionType, string> = {
      approve: 'pi pi-check',
      reject:  'pi pi-times',
      delete:  'pi pi-trash',
      warning: 'pi pi-check',
      info:    'pi pi-check',
    };
    return map[action] ?? 'pi pi-check';
  }

  defaultSeverity(action: ConfirmActionType): ButtonSeverity {
    const map: Record<ConfirmActionType, ButtonSeverity> = {
      approve: 'success',
      reject:  'danger',
      delete:  'danger',
      warning: 'warn',
      info:    'info',
    };
    return map[action] ?? 'primary';
  }
}