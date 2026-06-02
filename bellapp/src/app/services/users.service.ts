import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiRole } from '../core/api/api.models';
import { parseApiDate, unwrapResource } from '../core/api/api-normalizers';
import { fetchTenantList } from '../core/api/tenant-api.helper';
import { tenantApiContext } from '../core/http/http.context';
import { TenantContextService } from '../core/tenant/tenant-context.service';

export interface Role {
  id: number;
  name: string;
}

export interface User {
  id: string;
  nombreApellido: string;
  correo: string;
  password: string;
  rol: string;
  roleIds: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPayload {
  name: string;
  email: string;
  password: string;
  password_confirm: string;
  roles: number[];
}

interface ApiUser {
  id?: number | string;
  name?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  roles?: ApiRole[];
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantContextService);
  private storageKey = 'bellapp_users';

  private users: User[] = [];
  private roles: Role[] = [];

  constructor() {
    this.loadFromStorage();
  }

  async refreshRoles(): Promise<Role[]> {
    const remote = await fetchTenantList<ApiRole>(
      this.http,
      this.tenant,
      environment.apiPaths.roles,
      () => this.roles
    );
    this.roles = remote.map((r) => ({ id: r.id, name: r.name }));
    return this.roles;
  }

  getRoles(): Role[] {
    return this.roles;
  }

  async refresh(): Promise<void> {
    const remote = await fetchTenantList<ApiUser>(
      this.http,
      this.tenant,
      environment.apiPaths.users,
      () => this.users.map((u) => this.toDto(u))
    );
    this.users = remote.map((u) => this.fromDto(u));
    this.saveToStorage();
  }

  private fromDto(dto: ApiUser): User {
    const roleIds = (dto.roles ?? []).map((r) => r.id);
    return {
      id: String(dto.id ?? ''),
      nombreApellido: dto.name ?? '',
      correo: dto.email ?? '',
      password: '',
      rol: dto.roles?.[0]?.name ?? '',
      roleIds,
      createdAt: parseApiDate(dto.created_at) ?? new Date(),
      updatedAt: parseApiDate(dto.updated_at) ?? new Date(),
    };
  }

  private toDto(user: User): ApiUser {
    return {
      id: user.id,
      name: user.nombreApellido,
      email: user.correo,
      roles: user.roleIds.map((id) => ({
        id,
        name: this.roles.find((r) => r.id === id)?.name ?? user.rol,
      })),
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User[];
        this.users = parsed.map((user) => ({
          ...user,
          roleIds: user.roleIds ?? [],
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        }));
      } catch (e) {
        console.error('Error loading users from storage:', e);
        this.users = [];
      }
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.users));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  }

  getUsers(): User[] {
    return this.users;
  }

  getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find((u) => u.correo === email);
  }

  async fetchUserById(id: string): Promise<User | null> {
    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      return this.getUserById(id) ?? null;
    }

    try {
      const body = await firstValueFrom(
        this.http.get<ApiUser | { data?: ApiUser }>(
          `${environment.apiPaths.users}/${id}`,
          { context: tenantApiContext() }
        )
      );
      const dto = unwrapResource(body);
      return dto ? this.fromDto({ ...dto, id: dto.id ?? id }) : null;
    } catch (error) {
      console.warn(`[UsersService] GET /v1/users/${id} falló`, error);
      return this.getUserById(id) ?? null;
    }
  }

  /** Solo para fallback local (p. ej. auth sin API). */
  addUserLocal(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const newUser: User = {
      ...user,
      roleIds: user.roleIds ?? [],
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(newUser);
    this.saveToStorage();
    return newUser;
  }

  async addUser(payload: UserPayload): Promise<User> {
    const applyLocal = (): User =>
      this.addUserLocal({
        nombreApellido: payload.name,
        correo: payload.email,
        password: payload.password,
        rol: this.resolveRoleName(payload.roles),
        roleIds: payload.roles,
      });

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const body = await firstValueFrom(
          this.http.post<ApiUser | { data?: ApiUser }>(
            environment.apiPaths.users,
            payload,
            { context: tenantApiContext() }
          )
        );
        const dto = unwrapResource(body) ?? (body as ApiUser);
        const created = this.fromDto({ ...dto, id: dto.id ?? Date.now() });
        this.users.push(created);
        this.saveToStorage();
        return created;
      } catch (error) {
        console.warn('[API] POST /v1/users falló.', error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  /** Solo para fallback local (p. ej. auth sin API). */
  updateUserLocal(id: string, updates: Partial<User>): User | null {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return null;
    }
    this.users[index] = {
      ...this.users[index],
      ...updates,
      updatedAt: new Date(),
    };
    this.saveToStorage();
    return this.users[index];
  }

  async updateUser(id: string, payload: UserPayload): Promise<User | null> {
    const existing = this.users.find((u) => u.id === id);
    if (!existing) {
      return null;
    }

    const applyLocal = (): User => {
      const updated: User = {
        ...existing,
        nombreApellido: payload.name,
        correo: payload.email,
        password: payload.password || existing.password,
        rol: this.resolveRoleName(payload.roles),
        roleIds: payload.roles,
        updatedAt: new Date(),
      };
      const index = this.users.findIndex((u) => u.id === id);
      if (index !== -1) {
        this.users[index] = updated;
        this.saveToStorage();
      }
      return updated;
    };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const body = await firstValueFrom(
          this.http.put<ApiUser | { data?: ApiUser }>(
            `${environment.apiPaths.users}/${id}`,
            payload,
            { context: tenantApiContext() }
          )
        );
        const dto = unwrapResource(body) ?? (body as ApiUser);
        const updated = this.fromDto({ ...dto, id: dto.id ?? id });
        const index = this.users.findIndex((u) => u.id === id);
        if (index !== -1) {
          this.users[index] = updated;
          this.saveToStorage();
        }
        return updated;
      } catch (error) {
        console.warn(`[API] PUT /v1/users/${id} falló.`, error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  async deleteUser(id: string): Promise<boolean> {
    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        await firstValueFrom(
          this.http.delete<void>(`${environment.apiPaths.users}/${id}`, {
            context: tenantApiContext(),
          })
        );
      } catch (error) {
        console.warn(`[API] DELETE /v1/users/${id} falló.`, error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return false;
    }
    this.users.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  private resolveRoleName(roleIds: number[]): string {
    const firstId = roleIds[0];
    if (firstId == null) {
      return '';
    }
    return this.roles.find((r) => r.id === firstId)?.name ?? '';
  }
}
