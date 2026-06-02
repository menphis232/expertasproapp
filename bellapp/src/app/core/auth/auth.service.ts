import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CentralAuthApi } from '../api/central-auth.api';
import { TenantContextService } from '../tenant/tenant-context.service';
import { UsersService, User } from '../../services/users.service';
import { ApiMode, AuthSession, SessionTenant } from './auth.session';

const DEFAULT_ADMIN: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
  nombreApellido: 'Administrador',
  correo: 'admin@bellapp.cl',
  password: 'admin123',
  rol: 'Administrador',
  roleIds: [1],
};

export interface TenantOption {
  id: string;
  domain: string;
}

export interface LoginResult {
  ok: boolean;
  apiMode: ApiMode;
  /** True when the user belongs to multiple tenants and must pick one */
  requiresTenantSelection?: boolean;
  tenants?: TenantOption[];
  /** Preserved for fast-login after tenant selection */
  pendingEmail?: string;
  pendingTenantDomain?: string;
  /** Step-1 token required by fast-login */
  pendingAccessToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly centralAuth = inject(CentralAuthApi);
  private readonly tenantContext = inject(TenantContextService);
  private readonly usersService = inject(UsersService);

  private readonly sessionSignal = signal<AuthSession | null>(
    this.tenantContext.session()
  );

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly currentUser = computed(() => this.sessionSignal());
  readonly apiMode = computed(
    () => this.sessionSignal()?.apiMode ?? ('local' as ApiMode)
  );
  readonly usesRemoteApi = computed(
    () => this.apiMode() === 'remote' && this.tenantContext.canUseTenantApi()
  );

  constructor() {
    this.ensureDefaultAdmin();
    const stored = this.tenantContext.session();
    if (stored) {
      this.sessionSignal.set(stored);
    }
  }

  /**
   * 3-step login flow:
   * 1. POST /app/auth/login-all-tenants → initial token + primary tenant
   * 2. GET  {tenantDomain}/auth/tenants_user → list of user's tenants
   * 3a. Single tenant → POST {tenantDomain}/auth/fast-login → persist session
   * 3b. Multiple tenants → return list so caller shows selector
   */
  async login(email: string, password: string): Promise<LoginResult> {
    if (environment.apiEnabled) {
      try {
        // Step 1: authenticate against central server
        const initial = await firstValueFrom(
          this.centralAuth.loginAllTenants({
            email: email.trim(),
            password,
          })
        );

        // Step 2: fetch all tenants the user belongs to
        const tenantsData = await firstValueFrom(
          this.centralAuth.getTenantsUser(
            initial.tenantDomain,
            initial.accessToken
          )
        );

        const tenants: TenantOption[] = tenantsData.tenants
          .filter((t) => t.id && t.domain)
          .map((t) => ({ id: t.id!, domain: t.domain! }));

        if (tenants.length === 1) {
          // Step 3a: single tenant — fast-login directly
          const fastResult = await firstValueFrom(
            this.centralAuth.fastLogin(
              initial.tenantDomain,
              { tenant: tenants[0].id, email: email.trim() },
              initial.accessToken
            )
          );
          this.persistSession({
            ...fastResult.session,
            centralToken: initial.accessToken,
            fastLoginDomain: initial.tenantDomain,
            availableTenants: tenants,
          });
          return { ok: true, apiMode: 'remote' };
        }

        // Step 3b: multiple tenants — caller must show selector
        return {
          ok: true,
          apiMode: 'remote',
          requiresTenantSelection: true,
          tenants,
          pendingEmail: email.trim(),
          pendingTenantDomain: initial.tenantDomain,
          pendingAccessToken: initial.accessToken,
        };
      } catch (error) {
        console.warn('[Auth] API central falló, intentando login local.', error);
        if (!environment.fallbackToLocalStorage) {
          return { ok: false, apiMode: 'local' };
        }
      }
    }

    const localOk = this.loginLocal(email, password, 'demo');
    return { ok: localOk, apiMode: 'local' };
  }

  /** Completes login after the user picks a tenant from the multi-tenant selector. */
  async selectTenant(
    tenantId: string,
    email: string,
    tenantDomain: string,
    centralToken: string,
    availableTenants?: SessionTenant[]
  ): Promise<LoginResult> {
    try {
      const fastResult = await firstValueFrom(
        this.centralAuth.fastLogin(
          tenantDomain,
          { tenant: tenantId, email },
          centralToken
        )
      );
      this.persistSession({
        ...fastResult.session,
        centralToken,
        fastLoginDomain: tenantDomain,
        availableTenants,
      });
      return { ok: true, apiMode: 'remote' };
    } catch (error) {
      console.error('[Auth] Fast-login falló.', error);
      return { ok: false, apiMode: 'remote' };
    }
  }

  /**
   * Switches the active tenant from within the app (menu).
   * fast-login must go through the same domain used in the original login (step 1).
   */
  async switchTenant(tenant: SessionTenant): Promise<boolean> {
    const session = this.sessionSignal();
    if (!session?.email) {
      return false;
    }
    // Use the same domain as the original login step 1 — fast-login is always routed there
    const fastLoginDomain = session.fastLoginDomain ?? session.tenantDomain;
    const tokenForFastLogin = session.centralToken;
    if (!tokenForFastLogin || !fastLoginDomain) {
      return false;
    }
    try {
      const fastResult = await firstValueFrom(
        this.centralAuth.fastLogin(
          fastLoginDomain,
          { tenant: tenant.id, email: session.email },
          tokenForFastLogin
        )
      );
      this.persistSession({
        ...fastResult.session,
        centralToken: session.centralToken,
        fastLoginDomain,
        availableTenants: session.availableTenants,
      });
      return true;
    } catch (error) {
      console.error('[Auth] Switch de tenant falló.', error);
      return false;
    }
  }

  logout(): void {
    this.tenantContext.clearSession();
    this.sessionSignal.set(null);
  }

  hasRole(...roles: User['rol'][]): boolean {
    const current = this.sessionSignal();
    return current ? roles.includes(current.role as User['rol']) : false;
  }

  hasPermission(permission: string): boolean {
    return this.sessionSignal()?.permissions?.includes(permission) ?? false;
  }

  private loginLocal(
    email: string,
    password: string,
    tenantSlug: string
  ): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.usersService
      .getUsers()
      .find((u) => u.correo.toLowerCase() === normalizedEmail);

    if (!user || user.password !== password) {
      return false;
    }

    this.persistSession({
      userId: user.id,
      email: user.correo,
      name: user.nombreApellido,
      role: user.rol,
      tenantSlug,
      apiMode: 'local',
    });
    return true;
  }

  private persistSession(session: AuthSession): void {
    this.tenantContext.setSession(session);
    this.sessionSignal.set(session);
  }

  private ensureDefaultAdmin(): void {
    const users = this.usersService.getUsers();
    if (users.length === 0) {
      this.usersService.addUserLocal(DEFAULT_ADMIN);
      return;
    }
    const hasAdmin = users.some(
      (u) => u.correo.toLowerCase() === DEFAULT_ADMIN.correo.toLowerCase()
    );
    if (!hasAdmin) {
      this.usersService.addUserLocal(DEFAULT_ADMIN);
      return;
    }

    const admin = users.find(
      (u) => u.correo.toLowerCase() === DEFAULT_ADMIN.correo.toLowerCase()
    );
    if (admin && admin.password === '***') {
      this.usersService.updateUserLocal(admin.id, {
        password: DEFAULT_ADMIN.password,
      });
    }
  }
}
