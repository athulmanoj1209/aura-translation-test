import { Component, DestroyRef, inject, NgZone, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Localstorage, LocalStoragekeys } from './app/core/services/localstorage.service';
import { Store } from '@ngrx/store';
import { AuthState } from './app/core/state/auth.reducer';
import { AuditorState } from './app/core/state/auditor.reducer';
import { clearAuditorDetails } from './app/core/state/auditor.action';
import { clearCredentials, updateCredentials } from './app/core/state/auth.action';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { RightDrawerHostComponent } from './app/shared/components/right-drawer-host.component/right-drawer-host.component';
import { ConfirmDialogComponent } from './app/shared/components/confirm-dialog';
import { ToastContainerComponent } from './app/shared/components/toast/toast-container';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, RightDrawerHostComponent, ConfirmDialogComponent,ToastContainerComponent],
    template: `<router-outlet></router-outlet> <app-right-drawer-host></app-right-drawer-host> <app-confirm-dialog></app-confirm-dialog> <app-toast-container />`
})
export class AppComponent {
    // private localStorage = inject(Localstorage);
    // private http = inject(HttpClient);
    // private store = inject(Store<{ auth: AuthState, auditor: AuditorState }>);
    // private ngZone = inject(NgZone);
    // private destroyRef = inject(DestroyRef);

    // authState = this.store.selectSignal(state => state.auth);

    // timer = 3000;

    // private sessionIntervalSubscription?: Subscription;

    // ngOnInit() {
    //     this.ngZone.runOutsideAngular(() => {
    //         this.sessionIntervalSubscription = interval(this.timer)
    //             .pipe(takeUntilDestroyed(this.destroyRef))
    //             .subscribe(async () => {

    //                 console.log('timer running');
    //                 const auth = this.authState();

    //                 const isLoggedIn = !!auth?.accessToken;

    //                 if (!isLoggedIn) {
    //                     return;
    //                 }

    //                 let sessionExpiration = auth?.sessionExpiration;



    //                 if (!sessionExpiration) {
    //                     const storedSessionExpiration = await this.localStorage.getItem(
    //                         LocalStoragekeys.AuditorSessionExpiration
    //                     );

    //                     if (!storedSessionExpiration) {
    //                         return;
    //                     }

    //                     sessionExpiration = storedSessionExpiration;

    //                     this.ngZone.run(() => {
    //                         this.store.dispatch(
    //                             updateCredentials({ sessionExpiration: storedSessionExpiration })
    //                         );
    //                     });
    //                 }

    //                 const stateSessionExpiration = auth?.sessionExpiration || sessionExpiration;

    //                 this.http.post("http://localhost:5251/api/Audit/check-session", { SessionExpiry: stateSessionExpiration }, { withCredentials: true }).subscribe({
    //                     next: (response: any) => {
    //                         console.log('chekinig session response', response);
    //                         // return;
    //                     },
    //                     error: (error) => {
    //                         console.error('Error clearing session:', error);
    //                     }
    //                 });

    //                 if (new Date(sessionExpiration) < new Date()) {
    //                     this.ngZone.run(() => {
    //                         this.store.dispatch(clearCredentials());
    //                         this.store.dispatch(clearAuditorDetails());

    //                         this.localStorage.removeItem(LocalStoragekeys.AuditorAccessToken);
    //                         this.localStorage.removeItem(LocalStoragekeys.AuditorSessionExpiration);
    //                     });

    //                     this.stopSessionInterval();
    //                 }
    //             });
    //     });
    // }

    // private stopSessionInterval() {
    //     this.sessionIntervalSubscription?.unsubscribe();
    //     this.sessionIntervalSubscription = undefined;
    // }

}









// // import { AfterViewChecked, Component, inject, NgZone, OnInit } from '@angular/core';
// // import { RouterModule } from '@angular/router';
// // import { interval } from 'rxjs';
// // import { Localstorage, LocalStoragekeys } from './app/service/localstorage';
// // import { Store } from '@ngrx/store';
// // import { AuthState } from './app/core/state/auth.reducer';
// // import { AuditorState } from './app/core/state/auditor.reducer';
// // import { clearAuditorDetails } from './app/core/state/auditor.action';
// // import { clearCredentials, setCredentials, updateCredentials } from './app/core/state/auth.action';

// // @Component({
// //     selector: 'app-root',
// //     standalone: true,
// //     imports: [RouterModule],
// //     template: `<router-outlet></router-outlet>`
// // })
// // export class AppComponent implements OnInit {
// //     localStorage = inject(Localstorage);
// //     store = inject(Store<{ auth: AuthState, auditor: AuditorState }>);
// //     ngZone = inject(NgZone);

// //     authState = this.store.selectSignal(state => state.auth);
// //     timer = 3000;

// //     constructor() { }

// //     ngOnInit() {
// //         this.ngZone.runOutsideAngular(() => {
// //             interval(this.timer).subscribe(async () => {
// //                 // console.log("running interval");
// //                 if (!this.authState()?.sessionExpiration || this.authState()?.sessionExpiration == null) {
// //                     const sessionExpiration = await this.localStorage.getItem(LocalStoragekeys.AuditorSessionExpiration);
// //                     this.store.dispatch(updateCredentials({ sessionExpiration: sessionExpiration }));
// //                 }
// //                 const sessionExpiration = this.authState()?.sessionExpiration;
// //                 // console.log("sessionExpiration", sessionExpiration);
// //                 if (sessionExpiration && new Date(sessionExpiration) < new Date()) {
// //                     // Handle session expiration
// //                     this.ngZone.run(() => {
// //                         this.store.dispatch(clearCredentials());
// //                         this.store.dispatch(clearAuditorDetails());
// //                         this.localStorage.removeItem(LocalStoragekeys.AuditorAccessToken);
// //                         this.localStorage.removeItem(LocalStoragekeys.AuditorSessionExpiration);
// //                     });
// //                 }
// //             });
// //         });
// //     }


// // ngAfterViewChecked(): void {
// // ngAfterViewChecked() { console.log('Change detection completed'); }
// // }

// // }
