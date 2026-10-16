import { Component, inject, OnInit, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { Store } from '@ngrx/store';
import { AuditorState } from '@/app/core/state/auditor.reducer';
import { AuthState } from '@/app/core/state/auth.reducer';
import { updateAuditorDetails } from '@/app/core/state/auditor.action';
import { DateTime } from 'luxon';
import { Localstorage, LocalStoragekeys } from '@/app/core/services/localstorage.service';
import { environment } from '@/app/environments/environment';

@Component({
    selector: 'app-add-methods',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        InputTextModule,
        DatePickerModule,
        ButtonModule,
        ToastModule
    ],
    providers: [MessageService],
    templateUrl: './add-methods.html',
    styleUrl: './add-methods.scss'
})
export class AddMethods implements OnInit {
    private fb = inject(FormBuilder);
    private http = inject(HttpClient);
    private messageService = inject(MessageService);
    private localStorage = inject(Localstorage);


    auditorTimeZone: string = '';
    store: Store<{ auth: AuthState; auditor: AuditorState }> = inject(Store);
    auditorState: Signal<AuditorState>;

    private readonly apiUrl = `${environment.apiBaseUrl}/Audit/add-methods`;

    constructor() {
        this.auditorState = this.store.selectSignal((state: any) => state.auditor);
    }

    form: FormGroup = this.fb.group({
        methodName: ['', [Validators.required, Validators.minLength(2)]],
        methodExpiration: [null, Validators.required]
    });

    async ngOnInit(): Promise<void> {

        this.auditorTimeZone = this.auditorState()?.timeZone || '';
        if (!this.auditorTimeZone || this.auditorTimeZone == '') {
            const auditorData = await this.localStorage.getItem(LocalStoragekeys.AuditorData);
            this.auditorTimeZone = auditorData?.timeZone || '';
            this.store.dispatch(updateAuditorDetails({ timeZone: this.auditorTimeZone }));
        }
    }

    // private toDateTimeOffsetForTimeZone(date: Date): string {
    //     const pad = (n: number) => String(n).padStart(2, '0');

    //     const parts = new Intl.DateTimeFormat('en-CA', {
    //         timeZone: this.auditorTimeZone,
    //         year: 'numeric',
    //         month: '2-digit',
    //         day: '2-digit',
    //         hour: '2-digit',
    //         minute: '2-digit',
    //         second: '2-digit',
    //         hour12: false
    //     }).formatToParts(date);

    //     const get = (type: string) =>
    //         parts.find(p => p.type === type)?.value ?? '';

    //     const year = get('year');
    //     const month = get('month');
    //     const day = get('day');
    //     const hour = get('hour');
    //     const minute = get('minute');
    //     const second = get('second');

    //     const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    //     const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));

    //     const offsetMinutes =
    //         (tzDate.getTime() - utcDate.getTime()) / 60000;

    //     const sign = offsetMinutes >= 0 ? '+' : '-';
    //     const offsetHour = pad(Math.floor(Math.abs(offsetMinutes) / 60));
    //     const offsetMinute = pad(Math.abs(offsetMinutes) % 60);

    //     return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
    // }

    // transform(utcIso: string | null | undefined, fmt = 'yyyy-LL-dd HH:mm'): string {
    //     if (!utcIso) return '';
    //     return DateTime.fromISO(utcIso, { zone: 'utc' })
    //         .setZone(this.auditorTimeZone)
    //         .toFormat(fmt);
    // }

    private transform(date: Date): string {
        return DateTime.fromJSDate(date)
            .setZone(this.auditorTimeZone)
            .toISO({ suppressMilliseconds: true }) ?? '';
    }


    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const selectedDate: Date = this.form.value.methodExpiration;

        const payload = {
            methodName: this.form.value.methodName,
            // methodExpiration: this.toDateTimeOffsetForTimeZone(selectedDate)
            methodExpiration: this.transform(selectedDate)
        };

        this.http.post<any>(this.apiUrl, payload).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'Method added successfully.'
                });
                this.form.reset();
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to add method.'
                });
            }
        });
    }

    // ngOnInit(): void {
    //     // Initialization logic if needed

    // }
}