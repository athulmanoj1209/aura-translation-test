import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Store } from '@ngrx/store';
import { setCredentials } from '../state/auth.action';
import { catchError, Observable, of, takeWhile, tap } from 'rxjs';
import { setAuditorDetails } from '../../core/state/auditor.action';
import { CryptoService } from './crypto.service';


@Injectable({
  providedIn: 'root',
})
export class AuthService {

  http = inject(HttpClient);
  store = inject(Store);
  cryptoService = inject(CryptoService);

  authState = this.store.selectSignal(state => state.auth);
  

  constructor() { }

  async checkAuth(): Promise<Observable<any>> {
    
    const encryptedAccessToken = this.authState()?.accessToken;
    const decryptedAccessToken = await this.decryptAndVerifyAccessToken(encryptedAccessToken);

    return this.http.get(`${environment.apiBaseUrl}/Audit/get-profile`, {
      headers: {
        "Authorization": "Bearer " + decryptedAccessToken
      },
      withCredentials: true,
    })
      .pipe(
        tap((response: any) => {
          // Handle the response as needed, e.g., store user data or update state
          console.log('Authentication check successful:', response);
          const id = response?.data?.auditorId;
          const email = response?.data?.auditorEmail;
          const userName = response?.data?.auditorName;
          const timeZone = response?.data?.timeZone;
        
          this.store.dispatch(setAuditorDetails({ id, email, userName, timeZone }));
          return response;
        }),
        catchError((error) => {
          console.error('Authentication check failed:', error);
          return of(null); // lets app continue bootstrapping
        })
      )

  }

  async decryptAndVerifyAccessToken(encryptedAccessToken: string): Promise<string | null> {
    if (!encryptedAccessToken) return null;
    const cryptoKey = await this.cryptoService.getCryptoKey();
    return await this.cryptoService.decrypt(cryptoKey, JSON.parse(encryptedAccessToken));
  }


}