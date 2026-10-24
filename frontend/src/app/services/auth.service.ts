import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';

declare const google: any;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);

  readonly user = signal<string | null>(null);
  readonly accountsOn = signal(false);
  readonly googleClientId = signal<string | null>(null);
  private googleReady = false;

  init(): void {
    this.api.getData<any>('status').subscribe({
      next: (s) => {
        this.accountsOn.set(!!s.accounts);
        if (s.googleClientId) this.googleClientId.set(s.googleClientId);
        if (s.accounts) {
          this.api.getData<any>('auth/me').subscribe({
            next: (me) => this.user.set(me.email || null),
            error: () => this.user.set(null)
          });
        }
      },
      error: () => {}
    });
  }

  register(email: string, password: string): Observable<any> {
    return this.api.postData<any>('auth/register', { email, password }).pipe(
      tap((r) => this.user.set(r.email))
    );
  }

  login(email: string, password: string): Observable<any> {
    return this.api.postData<any>('auth/login', { email, password }).pipe(
      tap((r) => this.user.set(r.email))
    );
  }

  logout(): void {
    this.api.postData<any>('auth/logout', {}).subscribe({
      next: () => this.user.set(null),
      error: () => this.user.set(null)
    });
  }

  // Render the Google sign in button into the given element. The callback
  // receives the signed in email on success, or an error message.
  renderGoogleButton(el: HTMLElement, done: (email: string | null, error?: string) => void): void {
    const clientId = this.googleClientId();
    if (!clientId || typeof google === 'undefined' || !google.accounts) {
      done(null, 'Google sign in is not available right now. Use email and password instead.');
      return;
    }
    if (!this.googleReady) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: any) => {
          if (!resp || !resp.credential) {
            done(null, 'Google sign in was cancelled.');
            return;
          }
          this.api.postData<any>('auth/google', { credential: resp.credential }).subscribe({
            next: (r) => {
              this.user.set(r.email);
              done(r.email);
            },
            error: (err) => done(null, (err && err.error && err.error.error) || 'Google sign in did not work.')
          });
        }
      });
      this.googleReady = true;
    }
    el.innerHTML = '';
    google.accounts.id.renderButton(el, {
      theme: 'filled_blue',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 280
    });
  }
}
