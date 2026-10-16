import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, mergeMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { EncryptedPayload } from '../models/encrypted-payload.model';
import { EncryptionService } from '../services/encryption.service';

/**
 * Direction-independent encryption interceptor.
 *
 * encryptionenabled  →  encrypts outgoing request bodies (POST/PUT/PATCH only)
 * decryptionenabled  →  decrypts incoming response bodies that look encrypted
 *
 * Both flags must match the server's DecryptRequest / EncryptResponse settings.
 */
@Injectable()
export class EncryptionInterceptor implements HttpInterceptor {
  //private static readonly BodyMethods = new Set(['POST', 'PUT', 'PATCH']);

  constructor(private readonly crypto: EncryptionService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const cfg = environment.encryption;

    // URL not in scope → middleware doesn't touch it on either side. Pure passthrough.
    if (!this.shouldEncrypt(req.url, cfg.urlPrefixes)) {
      return next.handle(req);
    }
    if (req.body instanceof FormData) {
    return next.handle(req);
  }
    const willEncryptRequest =
      cfg.encryptionenabled;

    const willDecryptResponse = cfg.decryptionenabled;

    // Build the outbound stream — either encrypt the body first, or send as-is.
    const outbound$: Observable<HttpEvent<unknown>> = willEncryptRequest
      ? from(this.crypto.encrypt(req.body ?? {})).pipe(
          mergeMap((encryptedBody) => {
            const encryptedReq = req.clone({
              body: encryptedBody,
              headers: req.headers.set('Content-Type', 'application/json'),
            });
            return next.handle(encryptedReq);
          }),
        )
      : next.handle(req);

    // Build the inbound stream — either decrypt the response, or pass it through.
    return willDecryptResponse ? this.decryptResponseStream(outbound$) : outbound$;
  }

  private decryptResponseStream(
    stream: Observable<HttpEvent<unknown>>,
  ): Observable<HttpEvent<unknown>> {
    return stream.pipe(
      mergeMap(async (event) => {
        if (!(event instanceof HttpResponse)) return event;

        const body = event.body;
        // Skip empty bodies (204, 304) and plain bodies (e.g. 4xx error strings).
        if (
          !body ||
          typeof body !== 'object' ||
          !('iv' in body) ||
          !('ciphertext' in body) ||
          !('Tag' in body)
        ) {
          return event;
        }

        const decrypted = await this.crypto.decrypt(body as EncryptedPayload);
        return event.clone({ body: decrypted });
      }),
    );
  }

  private shouldEncrypt(url: string, prefixes: string[]): boolean {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    return prefixes.some((p) => path.startsWith(p));
  }
}