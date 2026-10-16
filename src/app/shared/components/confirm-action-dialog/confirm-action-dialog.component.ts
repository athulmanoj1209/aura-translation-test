import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-confirm-action-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule, DrawIconComponent],
  templateUrl: './confirm-action-dialog.component.html',
  styleUrls:   ['./confirm-action-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmActionDialogComponent {
  @Input() visible    = false;
  @Input() action:  'Activate' | 'Deactivate' | 'Delete' = 'Deactivate';
  @Input() itemName   = '';

  @Output() confirmed  = new EventEmitter<void>();
  @Output() cancelled  = new EventEmitter<void>();

  get confirmLabel(): string {
    if (this.action === 'Delete') return 'Yes, Delete';
    return this.action === 'Deactivate' ? 'Yes, Deactivate' : 'Yes, Activate';
  }

  get confirmSeverity(): 'danger' | 'success' {
    return this.action === 'Activate' ? 'success' : 'danger';
  }
}