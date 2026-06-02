import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TenantContextService } from '../tenant/tenant-context.service';
import { USE_TENANT_API } from './http.context';

/**
 * Reescribe URLs relativas al API del tenant activo e inyecta Authorization.
 */
export const tenantApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.context.get(USE_TENANT_API)) {
    return next(req);
  }

  const tenant = inject(TenantContextService);
  const baseUrl = tenant.apiBaseUrl();
  const token = tenant.accessToken();

  if (!baseUrl || !token) {
    throw new Error('Sesión de tenant incompleta.');
  }

  const path = req.url.startsWith('/') ? req.url.slice(1) : req.url;
  const url = `${baseUrl.replace(/\/$/, '')}/${path}`;

  return next(
    req.clone({
      url,
      setHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
  );
};
