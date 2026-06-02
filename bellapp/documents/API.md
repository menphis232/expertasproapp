# BellApp — Contrato API (multi-tenant)

## Arquitectura

| Servicio | URL |
|----------|-----|
| Central (login) | `https://central.bellapp.cl/api` |
| Tenant (datos) | `https://{tenant}.bellapp.cl/api` |

## Autenticación central

`POST /auth/login`

```json
{
  "email": "usuario@clinica.cl",
  "password": "secret",
  "tenant_slug": "demo"
}
```

Respuesta esperada:

```json
{
  "token": "jwt-or-sanctum-token",
  "user": {
    "id": 1,
    "nombre_apellido": "Admin",
    "correo": "usuario@clinica.cl",
    "rol": "Administrador"
  },
  "tenant": { "slug": "demo", "name": "Clínica Demo" }
}
```

También se acepta `access_token` en lugar de `token`, y lista `tenants[]` si el usuario tiene varios.

## API del tenant

Todas las peticiones llevan `Authorization: Bearer {token}`.

| Recurso | Métodos |
|---------|---------|
| `/appointments` | GET, POST |
| `/appointments/{id}` | PUT, DELETE |
| `/clients` | GET, POST, PUT, DELETE |
| `/clients/fields-config` | GET |
| `/professionals` | GET, POST, PUT, DELETE |
| `/users` | GET, POST, PUT, DELETE |
| `/services` | GET, POST, PUT, DELETE |

Las listas pueden devolverse como array directo o como `{ "data": [...] }`.

## Modo fallback

Si la API no responde, la app usa `localStorage` (`bellapp_*`) cuando `environment.fallbackToLocalStorage` es `true`.
