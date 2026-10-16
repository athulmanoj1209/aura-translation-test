import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';

import { DrawerRef, DRAWER_DATA } from '../../../../../shared/components/drawer-ref';
import { AuditEvent, EventType, LocationType } from '../models/events-meeting.model';
import { DrawIconComponent } from '@/app/shared/components/draw-icon/draw-icon.component';

@Component({
  selector: 'app-event-profile',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, TagModule, DividerModule, DrawIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-meetings-profile.component.html',
  styleUrls: ['./events-meetings-profile.component.scss'],
})
export class EventProfileComponent {

  /** Drawer wiring — optional so the component also works embedded. */
  private readonly drawerRef = inject(DrawerRef, { optional: true }) as DrawerRef<AuditEvent> | null;
  private readonly drawerData = inject(DRAWER_DATA, { optional: true }) as AuditEvent | null;

  readonly event = signal<AuditEvent | null>(this.drawerData);

  readonly e = computed(() => this.event());

  readonly LocationType = LocationType;
  readonly EventType = EventType;

  /** Initials fallback for organizer avatar. */
  readonly organizerInitials = computed(() => {
    const name = this.event()?.organizer?.name ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]!.toUpperCase())
      .join('');
  });

  /** Badge style per event type. */
  typeBadgeClass = computed<string>(() => {
    const type = this.event()?.eventType;
    switch (type) {
      case EventType.Meeting:               return 'badge--blue';
      case EventType.SiteVisit:             return 'badge--green';
      case EventType.RFIIssued:             return 'badge--amber';
      case EventType.EvidenceSubmission:    return 'badge--teal';
      case EventType.FindingCreationUpdate: return 'badge--red';
      case EventType.MOM:                   return 'badge--purple';
      default:                              return 'badge--blue';
    }
  });

  /** Duration in minutes between start and end. */
  readonly durationLabel = computed<string | null>(() => {
    const ev = this.event();
    if (!ev?.startDateTime || !ev?.endDateTime) return null;
    const mins = Math.round(
      (new Date(ev.endDateTime).getTime() - new Date(ev.startDateTime).getTime()) / 60000
    );
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  });

  formatDateTime(d: Date | string): string {
    const dt = new Date(d);
    return dt.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  formatDateOnly(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  /** Initials for any participant name — safe for template calls. */
  participantInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w.charAt(0).toUpperCase())
      .join('');
  }

  /** Human-readable file size from bytes. */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onClose(): void {
    this.drawerRef?.close(null);
  }

}