import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';



@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <app-toast [toast]="toast" (dismissed)="toastService.dismiss($event)" />
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
 
    .toast-container > * {
      pointer-events: all;
    }
  `],
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}