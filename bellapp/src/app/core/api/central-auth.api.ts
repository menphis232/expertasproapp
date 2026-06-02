import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  FastLoginRequest,
  LoginRequest,
  LoginResponse,
  TenantsUserResponse,
} from './api.models';
import { extractToken, normalizeUser } from './api-normalizers';
import { AuthSession } from '../auth/auth.session';

export interface CentralLoginResult {
  session: AuthSession;
}

/** Result of the first step: central login */
export interface InitialLoginResult {
  accessToken: string;
  tenantId: string;
  tenantDomain: string;
}

@Injectable({ providedIn: 'root' })
export class CentralAuthApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Step 1 — POST /app/auth/login-all-tenants to central server.
   * Returns initial token + primary tenant info.
   */
  loginAllTenants(
    payload: Pick<LoginRequest, 'email' | 'password'>
  ): Observable<InitialLoginResult> {
    const url = `${environment.centralApiUrl}${environment.apiPaths.login}`;
    return this.http.post<LoginResponse>(url, payload).pipe(
      map((response) => {
        const token = extractToken(response);
        if (!token) {
          throw new Error('La API no devolvió un token de acceso.');
        }
        const tenantId = response.tenant?.id ?? response.tenant?.slug;
        const tenantDomain = response.tenant?.domain;
        if (!tenantId || !tenantDomain) {
          throw new Error('La API no devolvió información del tenant.');
        }
        return { accessToken: token, tenantId, tenantDomain };
      })
    );
  }

  /**
   * Step 2 — GET /auth/tenants_user on the tenant domain.
   * Returns all tenants the user belongs to.
   */
  getTenantsUser(
    tenantDomain: string,
    accessToken: string
  ): Observable<TenantsUserResponse> {
    const url = `https://${tenantDomain}/api${environment.apiPaths.tenantsUser}`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    });
    return this.http.get<TenantsUserResponse>(url, { headers });
  }

  /**
   * Step 3 — POST /auth/fast-login on the tenant domain.
   * Requires the Bearer token obtained in step 1.
   */
  fastLogin(
    tenantDomain: string,
    payload: FastLoginRequest,
    accessToken: string
  ): Observable<CentralLoginResult> {
    const url = `https://${tenantDomain}/api${environment.apiPaths.fastLogin}`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    });
    return this.http.post<LoginResponse>(url, payload, { headers }).pipe(
      map((response) => this.toSession(response))
    );
  }

  private toSession(response: LoginResponse): CentralLoginResult {
    const token = extractToken(response);
    if (!token) {
      throw new Error('La API no devolvió un token de acceso.');
    }

    const user = response.user ? normalizeUser(response.user) : null;
    if (!user) {
      throw new Error('La API no devolvió datos del usuario.');
    }

    const tenantSlug =
      response.tenant?.id ?? response.tenant?.slug;
    const tenantDomain = response.tenant?.domain;

    if (!tenantSlug) {
      throw new Error('No se pudo determinar el tenant.');
    }

    const session: AuthSession = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantSlug,
      tenantDomain,
      accessToken: token,
      apiMode: 'remote',
      permissions: user.permissions,
    };

    return { session };
  }
}
