import { Component, inject, Input, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { BillingTextNew } from '../billing-text-new/billing-text-new';
import { AuditorState } from '@/app/core/state/auditor.reducer';
import { updateAuditorDetails } from '@/app/core/state/auditor.action';
import { Localstorage, LocalStoragekeys } from '@/app/core/services/localstorage.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-auditor-billing-new',
  imports: [BillingTextNew, DrawIconComponent],
  templateUrl: './auditor-billing-new.html',
  styleUrl: './auditor-billing-new.scss',
})
export class AuditorBillingNew implements OnInit {
  @Input() auditor!: AuditorState;
  billingRole: string | undefined = "billing of the finance auditor";

  private localStorage = inject(Localstorage);
  private store: Store = inject(Store);

  async ngOnInit(): Promise<void> {
    if (this.auditor?.id) {
      const auditorData = await this.localStorage.getItem(LocalStoragekeys.AuditorData);
      // this.localStorage.setItem(LocalStoragekeys.AuditorData, { ...auditorData, billingRole: this.billingRole });
      
      this.store.dispatch(updateAuditorDetails({ billingRole: this.billingRole, prefferedLanguage: auditorData?.prefferedLanguage }));
    }
  }
}
