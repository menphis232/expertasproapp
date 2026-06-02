export type ApiMode = 'remote' | 'local';

export interface SessionTenant {
  id: string;
  domain: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantSlug: string;
  tenantDomain?: string;
  /** Tenant-specific token from fast-login — used for API calls */
  accessToken?: string;
  /** Central token from login-all-tenants */
  centralToken?: string;
  /** Domain of the primary tenant (step 1) — all fast-login calls must go through this domain */
  fastLoginDomain?: string;
  apiMode?: ApiMode;
  permissions?: string[];
  /** All tenants the user belongs to (for the in-app tenant switcher) */
  availableTenants?: SessionTenant[];
}

export const AUTH_SESSION_KEY = 'bellapp_session';
