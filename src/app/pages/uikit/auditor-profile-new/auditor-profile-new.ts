import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { ProfileTextNew } from '../profile-text-new/profile-text-new';
import { AuditorState } from '@/app/core/state/auditor.reducer';
import { updateAuditorDetails } from '@/app/core/state/auditor.action';
import { SelectModule } from 'primeng/select';
import { Localstorage, LocalStoragekeys } from '@/app/core/services/localstorage.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-auditor-profile-new',
  imports: [ProfileTextNew, SelectModule, DrawIconComponent],
  templateUrl: './auditor-profile-new.html',
  styleUrl: './auditor-profile-new.scss',
})

export class AuditorProfileNew implements OnInit, OnChanges {
  @Input() auditor!: AuditorState;
  @Output() profileRoleChangedAuditorData = new EventEmitter<AuditorState>();

  profileRole: string | undefined = "profile of the finance auditor";

  private store: Store = inject(Store);
  private localStorage = inject(Localstorage);

  async ngOnInit(): Promise<void> {
    if (this.auditor?.id) {
      const auditorData = await this.localStorage.getItem(LocalStoragekeys.AuditorData);
      // this.localStorage.setItem(LocalStoragekeys.AuditorData, { ...auditorData, profileRole: this.profileRole });
      
      this.profileRoleChangedAuditorData.emit({ ...this.auditor, profileRole: this.profileRole });
      this.store.dispatch(updateAuditorDetails({ profileRole: this.profileRole, prefferedLanguage: auditorData?.prefferedLanguage }));

    }
  }

  ngOnChanges(): void {
    console.log('profile child rerenders when input change');
  }

}
