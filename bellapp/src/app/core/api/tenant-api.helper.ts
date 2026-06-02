import { HttpClient } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { tenantApiContext } from '../http/http.context';
import { TenantContextService } from '../tenant/tenant-context.service';
import { unwrapList } from './api-normalizers';
import { ApiListResponse } from './api.models';

export async function fetchTenantList<T>(
  http: HttpClient,
  tenant: TenantContextService,
  path: string,
  fallback: () => T[]
): Promise<T[]> {
  if (!environment.apiEnabled || !tenant.canUseTenantApi()) {
    return fallback();
  }

  try {
    const body = await firstValueFrom(
      http.get<T[] | ApiListResponse<T>>(path, { context: tenantApiContext() })
    );
    return unwrapList(body);
  } catch (error) {
    console.warn(`[API] GET ${path} falló, usando datos locales.`, error);
    if (environment.fallbackToLocalStorage) {
      return fallback();
    }
    throw error;
  }
}

export function mutateTenant<T>(
  http: HttpClient,
  tenant: TenantContextService,
  request$: Observable<T>,
  fallback: () => T
): Observable<T> {
  if (!environment.apiEnabled || !tenant.canUseTenantApi()) {
    return of(fallback());
  }

  return request$.pipe(
    catchError((error) => {
      console.warn('[API] mutación falló, usando datos locales.', error);
      if (environment.fallbackToLocalStorage) {
        return of(fallback());
      }
      throw error;
    })
  );
}
