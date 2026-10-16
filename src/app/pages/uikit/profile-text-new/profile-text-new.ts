import { AuditorState } from '@/app/core/state/auditor.reducer';
import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-profile-text-new',
  imports: [],
  templateUrl: './profile-text-new.html',
  styleUrl: './profile-text-new.scss',
})
export class ProfileTextNew implements OnInit {
  @Input() auditor: AuditorState | undefined;

  ngOnInit(): void {
    console.log('auditor data initialized in ProfileTextNew:', this.auditor);
  }
}
