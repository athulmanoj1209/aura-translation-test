import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withPreloading, PreloadAllModules } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { CygnusPreset } from './app/core/theme/cygnus.preset';
import { appRoutes } from './app.routes';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { authReducer } from './app/core/state/auth.reducer';
import { auditorReducer } from './app/core/state/auditor.reducer';
import { globalRefreshInterceptor } from './app/core/interceptors/global.refresh-interceptor';
import { httpErrorInterceptor } from './app/core/interceptors/error.interceptor';
import { loggingInterceptor } from './app/core/interceptors/logging.interceptor';
import { EncryptionInterceptor } from './app/core/interceptors/encryption.interceptor';
import { DivisionsListComponent } from './app/features/audits/organization/divisions/divisions-list/divisions-list.component';
import { CLIENT_MODE, CLIENT_MODE_VALUE } from './app/core/config/client-mode';

export const appConfig: ApplicationConfig = {
    providers: [
        // Which client this build is for — decides which static seed file each
        // data source reads from. Toggle it in core/config/client-mode.ts, which the
        // module-level seed files read directly; this just exposes it to DI.
        { provide: CLIENT_MODE, useValue: CLIENT_MODE_VALUE },
        provideRouter(
            appRoutes,
            withInMemoryScrolling({
                anchorScrolling: 'enabled',
                scrollPositionRestoration: 'enabled'
            }),
            withEnabledBlockingInitialNavigation(),
            withPreloading(PreloadAllModules)),
        provideHttpClient(
            withFetch(),
            withInterceptors([
                globalRefreshInterceptor,
                httpErrorInterceptor,
                loggingInterceptor
            ]),
            withInterceptorsFromDi()
        ),
        { provide: HTTP_INTERCEPTORS, useClass: EncryptionInterceptor, multi: true },
        provideZonelessChangeDetection(),
        providePrimeNG({ theme: { preset: CygnusPreset, options: { darkModeSelector: '.app-dark' } } }),
        provideStore({ auth: authReducer, auditor: auditorReducer }),
        provideStoreDevtools({
            maxAge: 25, // devtools will keep only last 25 snapshots like last 25 states, ie last 25 dispatched actions
            logOnly: !isDevMode(), //returns whether angular is in development mode if logOnly false then devtools can dispatch, time travel and read state, if logonly true devtools can only view logs
            autoPause: true, // When the Redux DevTools window is closed: NgRx stops recording actions, when we open it again: the recording gets resumes again
            //Why this exists:
            // large apps dispatch a LOT of actions
            // recording everything costs memory
            trace: false, //if true then traces from where the action is dispatche from 
            connectInZone: true, //need to leaen
        }),
    ]
};
