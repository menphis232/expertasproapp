import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Marca peticiones que deben ir al API del tenant (subdominio + Bearer). */
export const USE_TENANT_API = new HttpContextToken<boolean>(() => false);

export function tenantApiContext(): HttpContext {
  return new HttpContext().set(USE_TENANT_API, true);
}
