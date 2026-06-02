export interface ApiTenant {
  /** New API format */
  id?: string;
  domain?: string;
  /** Legacy format */
  slug?: string;
  name?: string;
}

export interface ApiPermission {
  id: number;
  name: string;
  description?: string;
}

export interface ApiRole {
  id: number;
  name: string;
  permissions?: ApiPermission[];
}

export interface ApiUser {
  id: string | number;
  nombre_apellido?: string;
  nombreApellido?: string;
  name?: string;
  correo?: string;
  email?: string;
  rol?: string;
  role?: string;
  roles?: ApiRole[];
}

export interface LoginRequest {
  email: string;
  password: string;
  tenant_slug?: string;
}

export interface LoginResponse {
  token?: string;
  access_token?: string;
  user?: ApiUser;
  tenant?: ApiTenant;
  tenants?: ApiTenant[];
  message?: string;
}

export interface TenantsUserResponse {
  email: string;
  tenants: ApiTenant[];
}

export interface FastLoginRequest {
  tenant: string;
  email: string;
}

export interface ApiListResponse<T> {
  data?: T[];
  items?: T[];
}
