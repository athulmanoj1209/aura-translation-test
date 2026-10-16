import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { DrawerRef, DRAWER_DATA } from '@/app/shared/components/drawer-ref';
import { User, UserRole, UserStatus } from '@/app/features/user/users/services/user.service';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

/** Close-result emitted when used in drawer mode. */
export type UserProfileAction =
  | { kind: 'edit'; userId: string }
  | { kind: 'delete'; userId: string }
  | { kind: 'reset-password'; userId: string }
  | { kind: 'toggle-status'; userId: string; nextStatus: UserStatus }
  | { kind: 'resend-invitation'; userId: string };

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, DatePipe, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent {

  /** Drawer mode wiring (optional — falls back to @Input). */
  private readonly drawerRef = inject(DrawerRef, { optional: true }) as
    | DrawerRef<UserProfileAction | null, User>
    | null;
  private readonly drawerData = inject(DRAWER_DATA, { optional: true }) as User | null;

  private readonly _user = signal<User | null>(this.drawerData);

  @Input() set user(value: User | null | undefined) {
    if (value) this._user.set(value);
  }
  get user(): User | null { return this._user(); }

  /** Embedded-page outputs. */
  @Output() readonly closed              = new EventEmitter<void>();
  @Output() readonly edit                = new EventEmitter<User>();
  @Output() readonly delete              = new EventEmitter<User>();
  @Output() readonly toggleStatus        = new EventEmitter<User>();
  @Output() readonly resendInvitation    = new EventEmitter<User>();
  @Output() readonly resetPassword       = new EventEmitter<User>();

  /* ---------------- Derived ---------------- */
  readonly u = computed(() => this._user());

  readonly initials = computed(() => {
    const name = this._user()?.fullName ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]!.toUpperCase())
      .join('');
  });

  readonly statusInfo = computed<{ label: string; tier: string }>(() => {
    const s = this._user()?.status ?? 'active';
    return {
      label: STATUS_LABEL[s],
      tier:  s,
    };
  });

  readonly roleLabel = computed(() => {
    const r = this._user()?.role;
    return r ? ROLE_LABEL[r] : '';
  });

  /** "2 days ago" friendly relative time for lastLoginAt. */
  readonly lastLoginRelative = computed<string>(() => {
    const ts = this._user()?.lastLoginAt;
    if (!ts) return 'Never';
    const d = ts instanceof Date ? ts : new Date(ts);
    const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (mins < 1)     return 'Just now';
    if (mins < 60)    return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)     return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)     return `${days} day${days === 1 ? '' : 's'} ago`;
    if (days < 30)    return `${Math.floor(days / 7)} week${days >= 14 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12)  return `${months} month${months === 1 ? '' : 's'} ago`;
    return `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''} ago`;
  });

  /* ---------------- Tiny UI state --------------------- */
  readonly copiedField = signal<'email' | 'phone' | null>(null);

  async copy(field: 'email' | 'phone', value?: string): Promise<void> {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
    this.copiedField.set(field);
    setTimeout(() => {
      if (this.copiedField() === field) this.copiedField.set(null);
    }, 1200);
  }

  /* ---------------- Actions --------------------------- */


 

  onClose(): void {
    this.closed.emit();
    this.drawerRef?.close(null);
  }

  /** Avatar fallback to initials if the image fails to load. */
  onAvatarError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img) img.style.display = 'none';
  }
}

/* ============================================================
 *  Display dictionaries
 * ============================================================ */
const ROLE_LABEL: Record<UserRole, string> = {
  admin:   'Administrator',
  manager: 'Manager',
  auditor: 'Auditor',
  viewer:  'Viewer',
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active:    'Active',
  pending:   'Pending Invitation',
  suspended: 'Suspended',
  deleted:   'Deleted',
};
