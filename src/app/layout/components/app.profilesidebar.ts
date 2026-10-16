import { Component, computed, inject, isDevMode, OnInit, signal, Signal } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { BadgeModule } from 'primeng/badge';
import { LayoutService } from '@/app/layout/service/layout.service';
import { Store } from '@ngrx/store';
import { AuthState } from '@/app/core/state/auth.reducer';
import { clearCredentials } from '@/app/core/state/auth.action';
import { AuditorState, LanguagesRoutes, PrefferedLanguages } from '@/app/core/state/auditor.reducer';
import { clearAuditorDetails, setAuditorDetails, updateAuditorDetails } from '@/app/core/state/auditor.action';
import { AuditorProfileNew } from '@/app/pages/uikit/auditor-profile-new/auditor-profile-new';
import { AuditorBillingNew } from '@/app/pages/uikit/auditor-billing-new/auditor-billing-new';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgIf } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { Router } from '@angular/router';
import { Localstorage, LocalStoragekeys } from '@/app/core/services/localstorage.service';
import { MessageService } from 'primeng/api';
import { Toast } from "primeng/toast";
import { retry } from 'rxjs';
import { AuthService } from '@/app/core/services/auth.service';


@Component({
    selector: '[app-profilesidebar]',
    imports: [ButtonModule, DrawerModule, BadgeModule, AuditorProfileNew, AuditorBillingNew, FormsModule, SelectModule, Toast, DatePipe],
    providers: [MessageService],
    template: `
        <p-toast />
        <p-drawer [visible]="visible()" (onHide)="onDrawerHide()" position="right" [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'" styleClass="layout-profile-sidebar w-full sm:w-25rem">
            <div class="flex flex-col mx-auto md:mx-0">
                <span class="mb-2 font-semibold">Welcome</span>
                <span class="text-surface-500 dark:text-surface-400 font-medium">{{ auditorState().userName }}</span>
                <span class="text-surface-400 dark:text-surface-500 text-sm mb-8">{{ auditorState().email }}</span>

                <div class="font-semibold text-xl">Select Language</div>
                    <p-select [(ngModel)]="dropdownValue" [options]="dropdownValues" optionLabel="language_name" (onChange)="onLanguageChange($event)" placeholder="Select" />

                <!-- <div class="font-semibold text-xl mt-4 mb-2">Select Time Zone</div> -->
                    <!-- <p-select [(ngModel)]="selectedTimeZone" [options]="timeZones" optionLabel="name" (onChange)="onTimezoneChange($event)" placeholder="Select Time Zone" /> -->

                <ul class="list-none m-0 p-0 mt-3">
                    <!-- <div *ngIf="this.profileRoleUpdatedInGlobal">profile role has been updated in global state</div> -->
                    <!-- <div *ngIf="this.profileRoleUpdated">profile role has been updated in props output</div> -->
                    <app-auditor-profile-new [auditor]="auditorState()" (profileRoleChangedAuditorData)="receivedUpdatedAuditorDetails($event)"></app-auditor-profile-new>
                    <app-auditor-billing-new [auditor]="auditorState()"></app-auditor-billing-new>
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <i class="pi pi-cog text-xl text-primary"></i>
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">Settings</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">Exercitation veniam</p>
                            </div>
                        </a>
                    </li>
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <i class="pi pi-power-off text-xl text-primary"></i>
                            </span>
                            <button class="ml-4" (click)="signOut()">
                                <span class="mb-2 font-semibold">Sign Out</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">Sed ut perspiciatis</p>
                            </button>
                        </a>
                    </li>
                </ul>
            </div>

            <div class="flex flex-col mt-8 mx-auto md:mx-0">
                <span class="mb-2 font-semibold">Notifications</span>
                <span class="text-surface-500 dark:text-surface-400 font-medium mb-8">You have 3 notifications</span>

                <ul class="list-none m-0 p-0">
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <i class="pi pi-comment text-xl text-primary"></i>
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">Response received</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">5 min ago</p>
                            </div>
                        </a>
                    </li>
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <i class="pi pi-trash text-xl text-primary"></i>
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">opened by John Doe</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">15min ago</p>
                            </div>
                        </a>
                    </li>
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <i class="pi pi-folder text-xl text-primary"></i>
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">updated by Jane Smith</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">3h ago</p>
                            </div>
                        </a>
                    </li>
                </ul>
            </div>

            <!-- <div class="flex flex-col mt-8 mx-auto md:mx-0">
                <span class="mb-2 font-semibold">Messages</span>
                <span class="text-surface-500 dark:text-surface-400 font-medium mb-8">You have new messages</span>

                <ul class="list-none m-0 p-0">
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <img src="/demo/images/avatar/circle/avatar-m-8.png" alt="Avatar" class="w-8 h-8" />
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">James Robinson</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">10 min ago</p>
                            </div>
                            <p-badge value="3" class="ml-auto"></p-badge>
                        </a>
                    </li>
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <img src="/demo/images/avatar/circle/avatar-f-8.png" alt="Avatar" class="w-8 h-8" />
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">Mary Watson</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">15min ago</p>
                            </div>
                            <p-badge value="1" class="ml-auto"></p-badge>
                        </a>
                    </li>
                    <li>
                        <a class="cursor-pointer flex mb-4 p-4 items-center border border-surface-200 dark:border-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-150">
                            <span>
                                <img src="/demo/images/avatar/circle/avatar-f-4.png" alt="Avatar" class="w-8 h-8" />
                            </span>
                            <div class="ml-4">
                                <span class="mb-2 font-semibold">Aisha Webb</span>
                                <p class="text-surface-500 dark:text-surface-400 m-0">3h ago</p>
                            </div>
                            <p-badge value="2" class="ml-auto"></p-badge>
                        </a>
                    </li>
                </ul>
            </div> -->
        </p-drawer>
    `
})
export class AppProfileSidebar implements OnInit {
    visible = computed(() => !!this.layoutService.layoutState().profileSidebarVisible);

    inputTerm = signal('');
    router = inject(Router);
    dropdownValue: any = signal(null);
    dropdownValues: any[] = [];
    apiData = signal<any>(null);
    profileRoleUpdated = signal(false);
    profileRoleUpdatedInGlobal = signal(false);
    usersCurrentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    currentTime = new Date().toISOString();

    selectedTimeZone: any = null;
    timeZones = [
        { name: 'UTC', value: 'UTC' },
        { name: 'Local Time Zone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { name: 'Eastern Standard', value: 'America/New_York' },
        { name: 'Central European', value: 'Europe/Paris' },
        { name: 'India Standard', value: 'Asia/Kolkata' },
        { name: 'China Standard', value: 'Asia/Shanghai' },
        { name: 'Japan Standard', value: 'Asia/Tokyo' },
        { name: 'Gulf Standard', value: 'Asia/Dubai' },
        { name: 'Central European', value: 'Europe/Madrid' },
        { name: 'Central European', value: 'Europe/Berlin' },
        { name: 'Central European', value: 'Europe/Paris' },
        { name: 'French Polynesia', value: 'Pacific/Tahiti' },
    ];

    auditorState: Signal<AuditorState>;
    authState: Signal<AuthState>;

    private http = inject(HttpClient);
    private localStorage = inject(Localstorage);
    private authService = inject(AuthService);

    DateTime: Date | null = null;

    store: Store<{ auth: AuthState; auditor: AuditorState }> = inject(Store);
    messageService = inject(MessageService);

    constructor(public layoutService: LayoutService) {
        this.auditorState = this.store.selectSignal((state: any) => state.auditor);
        this.authState = this.store.selectSignal((state: any) => state.auth);
    }

    async ngOnInit(): Promise<void> {

        const date = new Date(); // Current local time

        const auditorTimeZone = this.auditorState()?.timeZone || '';

        if (!auditorTimeZone || auditorTimeZone == '') {
            const auditorData = await this.localStorage.getItem(LocalStoragekeys.AuditorData);
            this.store.dispatch(updateAuditorDetails({ timeZone: auditorData?.timeZone }));
        }

        const dubaiISO = date.toLocaleString('en-US', {
            timeZone: auditorTimeZone,
            hour12: false
        });

        // You now have a string of what time it is in Tokyo right now
        console.log(`Current time in Dubai: ${dubaiISO}`);

        const rawExpiry = await this.localStorage.getItem(LocalStoragekeys.AuditorSessionExpiration);

        console.log('Raw expiry from storage:', rawExpiry);

        console.log("time options is :", Intl.DateTimeFormat().resolvedOptions().hour12);

        this.DateTime = rawExpiry ? new Date(rawExpiry) : null;

        // this.http.get<HttpResponse<any>>(`${environment.apiBaseUrl}/Audit/get-languages`).subscribe({
        //     next: (response: any) => {
        //         this.dropdownValues = response.data;
        //     },
        //     error: () => {
        //         alert("failed to fetch language and region");
        //     }
        // });

        // to test the refresh endpoint
        // this.http.get('http://localhost:5250/api/Audit/sample', { withCredentials: true }).subscribe({});

        // this.http.get('http://localhost:5250/api/Audit/check-retr', { withCredentials: true }).pipe(retry(3)).subscribe({});

        if (!this.auditorState().id) {
            const auditorData = await this.localStorage.getItem(LocalStoragekeys.AuditorData);
            if (auditorData) {
                this.store.dispatch(setAuditorDetails({
                    id: auditorData?.id,
                    userName: auditorData?.userName,
                    email: auditorData?.email,
                    profileRole: auditorData?.profileRole,
                    billingRole: auditorData?.billingRole,
                    prefferedLanguage: auditorData?.prefferedLanguage,
                }));
            }

            if (this.auditorState()?.profileRole !== "" || !!this.auditorState()?.profileRole) {
                this.profileRoleUpdatedInGlobal.set(true);
            }

            // console.log('Auditor State in parent profile sidebar:', this.auditorState());
            // this.http.get('https://jsonplaceholder.typicode.com/todos/1').subscribe((data) => {
            //     console.log('HTTP response received:', data);
            //     this.apiData.set(data);
            // });
        }


        // if (this.auditorState()?.prefferedLanguage || !isDevMode()) {
        //     const lang = this.auditorState()?.prefferedLanguage;
        //     const baseUrl = '/translation-demo/';

        //     switch (lang) {
        //         case 'en-US':
        //             // Forces browser to load the English bundle at the root
        //             window.location.href = baseUrl;
        //             break;
        //         case 'es-PR':
        //             // Forces browser to load the Spanish bundle in the subfolder
        //             window.location.href = baseUrl + 'es-PR/';
        //             break;
        //         default:
        //             window.location.href = baseUrl;
        //     }
        // }

        const englishUSUrl = LanguagesRoutes.EnglishUSRoute;
        const spanishPRUrl = LanguagesRoutes.SpanishPRRoute;
        const FrenchDefaultUrl = LanguagesRoutes.FrenchDefaultRoute;
        const GermanDefaultUrl = LanguagesRoutes.GermanDefaultRoute;
        const ArabicSAUrl = LanguagesRoutes.ArabicSARoute;
        const currentPath = window.location.pathname;

        let lang = this.auditorState()?.prefferedLanguage;

        if (lang == null) {
            const auditorData = await this.localStorage.getItem(LocalStoragekeys.AuditorData);
            lang = auditorData?.prefferedLanguage;

            this.store.dispatch(
                updateAuditorDetails({ prefferedLanguage: lang })
            );
        }

        // if (lang === PrefferedLanguages.EnglishUS && currentPath !== LanguagesRoutes.EnglishUSRoute) {
        //     window.location.href = LanguagesRoutes.EnglishUSRoute;
        // } else if (lang === PrefferedLanguages.SpanishPR && currentPath !== LanguagesRoutes.SpanishPRRoute) {
        //     window.location.href = LanguagesRoutes.SpanishPRRoute;
        // } else if (lang === PrefferedLanguages.arabicSA && currentPath !== LanguagesRoutes.ArabicSARoute) {
        //     window.location.href = LanguagesRoutes.ArabicSARoute;
        // } else if (lang === PrefferedLanguages.frenchDefault && currentPath !== LanguagesRoutes.FrenchDefaultRoute) {
        //     window.location.href = LanguagesRoutes.FrenchDefaultRoute;
        // }

    }

    receivedUpdatedAuditorDetails(updatedAuditor: AuditorState) {
        console.log('Received updated auditor details from child component:', updatedAuditor);
        this.profileRoleUpdated.set(true);
    }

    // const selected = this.dropdownValues.find(
    //   x => x.language_code === this.dropdownValue
    // );

    // console.log(selected?.language_name); // "English-US"

    onLanguageChange(event: any) {
        console.log('Selected language code:', event);
        const selectedLanguage = event.value.language_code as PrefferedLanguages;
        // return;

        // localStorage.setItem(
        //     'AuditorData',
        //     JSON.stringify({
        //         ...this.auditorState(),
        //         prefferedLanguage: selectedLanguage
        //     })   // todo encrypt user data
        // );

        this.localStorage.setItem(LocalStoragekeys.AuditorData, {
            ...this.auditorState(),
            prefferedLanguage: selectedLanguage
        });

        this.store.dispatch(
            updateAuditorDetails({ prefferedLanguage: selectedLanguage })
        );

        // uncommets only at build time
        // switch (selectedLanguage) {
        //     case PrefferedLanguages.EnglishUS:
        //         window.location.href = LanguagesRoutes.EnglishUSRoute;
        //         break;

        //     case PrefferedLanguages.SpanishPR:
        //         window.location.href = LanguagesRoutes.SpanishPRRoute;
        //         break;

        //     case PrefferedLanguages.GermanDefault:
        //         window.location.href = LanguagesRoutes.GermanDefaultRoute;
        //         break;

        //     case PrefferedLanguages.frenchDefault:
        //         window.location.href = LanguagesRoutes.FrenchDefaultRoute;
        //         break;

        //     case PrefferedLanguages.arabicSA:
        //         window.location.href = LanguagesRoutes.ArabicSARoute;
        //         break;

        //     default:
        //         window.location.href = LanguagesRoutes.EnglishUSRoute;
        // }
    }


    async onTimezoneChange(event: any) {
        const selectedValue = event.value?.value;
        if (!selectedValue) return;

        const decryptedToken = await this.authService.decryptAndVerifyAccessToken(this.authState()?.accessToken ?? '');
        if (!decryptedToken) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Unable to authenticate. Please log in again.' });
            return;
        }

        // this.http.put(
        //     'http://localhost:5251/api/Audit/update-timezone',
        //     { timeZone: selectedValue },
        //     { headers: { Authorization: `Bearer ${decryptedToken}` } }
        // ).subscribe({
        //     next: () => {
        //         this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Time zone updated successfully.' });
        //     },
        //     error: () => {
        //         this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update time zone.' });
        //     }
        // });
    }

    onDrawerHide() {
        this.layoutService.layoutState.update((state) => ({
            ...state,
            profileSidebarVisible: false
        }));
    }

    signOut() {
        // localStorage.removeItem('AuditorAccessToken');
        // localStorage.removeItem('AuditorData');
        // this.localStorage.removeItem(LocalStoragekeys.AuditorAccessToken);
        this.http.post(`${environment.apiBaseUrl}/Audit/logout`, {}, { withCredentials: true }).subscribe({
            next: () => {
                console.log('Logged out successfully');
                this.store.dispatch(clearCredentials());
                this.store.dispatch(clearAuditorDetails());
                this.localStorage.removeItem(LocalStoragekeys.AuditorData);
                this.messageService.add({ severity: 'success', summary: 'success', detail: 'You have been logged out successfully.' });
            },
            error: (err) => {
                console.error('Logout failed', err);
                this.messageService.add({ severity: 'error', summary: 'error', detail: 'Failed to logout' });
            }
        });
        this.onDrawerHide();
    }

    search() {
        console.log('Searching for:', this.inputTerm());
    }
}
