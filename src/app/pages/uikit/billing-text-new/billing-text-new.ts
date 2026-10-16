import { Component, inject, Input, OnInit, Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuditorState } from '@/app/core/state/auditor.reducer';
import { updateAuditorDetails } from '@/app/core/state/auditor.action';

@Component({
  selector: 'app-billing-text-new',
  imports: [],
  templateUrl: './billing-text-new.html',
  styleUrl: './billing-text-new.scss',
})
export class BillingTextNew implements OnInit {
  @Input() auditor: AuditorState | undefined;

  ngOnInit(): void {
    console.log('auditor data initialized in ProfileTextNew:', this.auditor);
  }
}
