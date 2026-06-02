import { Injectable, computed, signal } from '@angular/core';

import { resolveTenantApiUrl } from '../../../environments/environment';
import { AUTH_SESSION_KEY, AuthSession } from '../auth/auth.session';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly sessionSignal = signal<AuthSession | null>(this.readSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly tenantSlug = computed(() => this.sessionSignal()?.tenantSlug ?? null);
  readonly accessToken = computed(() => this.sessionSignal()?.accessToken ?? null);
  readonly apiBaseUrl = computed(() => {
    const slug = this.tenantSlug();
    return slug ? resolveTenantApiUrl(slug) : null;
  });

  setSession(session: AuthSession): void {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  clearSession(): void {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    this.sessionSignal.set(null);
  }

  canUseTenantApi(): boolean {
    return !!(this.tenantSlug() && this.accessToken());
  }

  private readSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  }
}
