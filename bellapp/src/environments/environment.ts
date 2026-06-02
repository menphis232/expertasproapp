export const environment = {
  production: false,
  /** Intenta la API remota; si falla, usa localStorage. */
  apiEnabled: true,
  fallbackToLocalStorage: true,
  centralApiUrl: 'https://central.bellapp.cl/api',
  tenantApiUrlPattern: 'https://{tenant}.bellapp.cl/api',
  apiPaths: {
    login: '/app/auth/login-all-tenants',
    tenantsUser: '/auth/tenants_user',
    fastLogin: '/auth/fast-login',
    appointments: '/appointments',
    clients: '/v1/clientes',
    clientFieldsConfig: '/v1/clientes/field-configuration',
    professionals: '/v1/professionals',
    users: '/v1/users',
    roles: '/v1/roles',
    services: '/v1/servicios',
    agenda: '/v1/agenda',
  },
};

export function resolveTenantApiUrl(tenantSlug: string): string {
  return environment.tenantApiUrlPattern.replace('{tenant}', tenantSlug);
}
