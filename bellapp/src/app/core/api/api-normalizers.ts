import { ApiListResponse, ApiUser, LoginResponse } from './api.models';

export function unwrapList<T>(body: T[] | ApiListResponse<T> | null | undefined): T[] {
  if (!body) {
    return [];
  }
  if (Array.isArray(body)) {
    return body;
  }
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (Array.isArray(record['config_clientes'])) {
      return record['config_clientes'] as T[];
    }
  }
  return body.data ?? body.items ?? [];
}

/** Desenvuelve un recurso individual (`{ data: {...} }` o el objeto directo). */
export function unwrapResource<T>(
  body: T | { data?: T } | null | undefined
): T | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  if ('data' in body && body.data != null && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as T;
  }
  return body as T;
}

export function extractToken(response: LoginResponse): string | null {
  return response.token ?? response.access_token ?? null;
}

export function normalizeUser(user: ApiUser): {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
} {
  const roleFromArray = user.roles?.[0]?.name;
  const role = roleFromArray ?? user.rol ?? user.role ?? 'Administrador';

  const permissions = user.roles
    ? user.roles.flatMap((r) => r.permissions?.map((p) => p.name) ?? [])
    : [];

  return {
    id: String(user.id),
    name:
      user.nombreApellido ??
      user.nombre_apellido ??
      user.name ??
      'Usuario',
    email: user.correo ?? user.email ?? '',
    role,
    permissions,
  };
}

export function parseApiDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string | string[]>;
}

/** Extrae un mensaje legible desde respuestas de error de la API (p. ej. Laravel). */
export function extractApiErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error'
): string {
  const body = getApiErrorBody(error);

  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }

  if (body && typeof body === 'object') {
    if (body.message?.trim()) {
      return body.message.trim();
    }

    const fieldMessages = flattenApiFieldErrors(body.errors);
    if (fieldMessages.length > 0) {
      return [...new Set(fieldMessages)].join(' ');
    }
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    const message = (error as { message: string }).message;
    if (message && !message.startsWith('Http failure response')) {
      return message;
    }
  }

  return fallback;
}

function getApiErrorBody(error: unknown): ApiErrorBody | string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('error' in error) {
    const nested = (error as { error?: unknown }).error;
    if (typeof nested === 'string') {
      return nested;
    }
    if (nested && typeof nested === 'object') {
      return nested as ApiErrorBody;
    }
  }

  return error as ApiErrorBody;
}

function flattenApiFieldErrors(
  errors?: Record<string, string | string[]>
): string[] {
  if (!errors) {
    return [];
  }

  const messages: string[] = [];
  for (const value of Object.values(errors)) {
    if (Array.isArray(value)) {
      messages.push(...value.filter((item) => typeof item === 'string' && item.trim()));
    } else if (typeof value === 'string' && value.trim()) {
      messages.push(value);
    }
  }
  return messages;
}
