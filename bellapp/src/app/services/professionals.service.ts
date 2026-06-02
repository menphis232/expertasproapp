import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { parseApiDate, unwrapResource } from '../core/api/api-normalizers';
import { fetchTenantList } from '../core/api/tenant-api.helper';
import { tenantApiContext } from '../core/http/http.context';
import { TenantContextService } from '../core/tenant/tenant-context.service';

export interface Professional {
  id: string;
  nombreApellido: string;
  rut: string;
  servicios: string[];
  credenciales: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProfessionalUserOption = 'no_user' | 'create_user';

export interface CreateProfessionalPayload {
  rut: string;
  name: string;
  servicios: number[];
  user_option: ProfessionalUserOption;
  user_assigned_id?: number;
  email?: string;
  password?: string;
  password_confirm?: string;
}

export type UpdateProfessionalPayload = CreateProfessionalPayload;

interface ApiProfessionalServicio {
  id?: number;
  descripcion?: string;
}

interface ApiProfessional {
  id?: number | string;
  name?: string;
  nombre_apellido?: string;
  nombreApellido?: string;
  rut?: string;
  servicios?: ApiProfessionalServicio[] | string[];
  credenciales?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

@Injectable({ providedIn: 'root' })
export class ProfessionalsService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantContextService);
  private storageKey = 'bellapp_professionals';

  constructor() {
    this.loadFromStorage();
  }

  async refresh(): Promise<void> {
    const remote = await fetchTenantList<ApiProfessional>(
      this.http,
      this.tenant,
      environment.apiPaths.professionals,
      () => this.professionals.map((p) => this.toDto(p))
    );
    this.professionals = remote.map((p) => this.fromDto(p));
    this.saveToStorage();
  }

  private professionals: Professional[] = [];

  private fromDto(dto: ApiProfessional): Professional {
    const servicios = (dto.servicios ?? []).map((s) =>
      typeof s === 'string' ? s : (s.descripcion ?? '')
    ).filter(Boolean);

    return {
      id: String(dto.id ?? ''),
      nombreApellido:
        dto.name ?? dto.nombreApellido ?? dto.nombre_apellido ?? '',
      rut: dto.rut ?? '',
      servicios,
      credenciales: dto.credenciales ?? '',
      createdAt:
        parseApiDate(dto.created_at ?? dto.createdAt) ?? new Date(),
      updatedAt:
        parseApiDate(dto.updated_at ?? dto.updatedAt) ?? new Date(),
    };
  }

  private toDto(professional: Professional): ApiProfessional {
    return {
      id: professional.id,
      name: professional.nombreApellido,
      rut: professional.rut,
      servicios: professional.servicios,
      credenciales: professional.credenciales,
      createdAt: professional.createdAt,
      updatedAt: professional.updatedAt,
    };
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ApiProfessional[];
        this.professionals = parsed.map((p) => this.fromDto(p));
      } catch (e) {
        console.error('Error loading professionals from storage:', e);
        this.professionals = [];
      }
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.professionals));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  }

  getProfessionals(): Professional[] {
    return this.professionals;
  }

  getProfessionalById(id: string): Professional | undefined {
    return this.professionals.find((p) => p.id === id);
  }

  async addProfessional(
    payload: CreateProfessionalPayload
  ): Promise<Professional> {
    const applyLocal = (): Professional => {
      const servicioLabels = payload.servicios.map((id) => String(id));
      const newProfessional: Professional = {
        id: Date.now().toString(),
        nombreApellido: payload.name,
        rut: payload.rut,
        servicios: servicioLabels,
        credenciales: payload.user_option === 'create_user' ? 'crear' : 'no_crear',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.professionals.push(newProfessional);
      this.saveToStorage();
      return newProfessional;
    };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const body = await firstValueFrom(
          this.http.post<ApiProfessional | { data?: ApiProfessional }>(
            environment.apiPaths.professionals,
            payload,
            { context: tenantApiContext() }
          )
        );
        const dto = unwrapResource(body) ?? (body as ApiProfessional);
        const created = this.fromDto({
          ...dto,
          id: dto.id ?? Date.now(),
        });
        this.professionals.push(created);
        this.saveToStorage();
        return created;
      } catch (error) {
        console.warn('[API] POST /v1/professionals falló.', error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  async updateProfessional(
    id: string,
    payload: UpdateProfessionalPayload
  ): Promise<Professional | null> {
    const existing = this.professionals.find((p) => p.id === id);
    if (!existing) {
      return null;
    }

    const applyLocal = (): Professional => {
      const servicioLabels = payload.servicios.map((sid) => String(sid));
      const updated: Professional = {
        ...existing,
        nombreApellido: payload.name,
        rut: payload.rut,
        servicios: servicioLabels,
        credenciales: payload.user_option === 'create_user' ? 'crear' : 'no_crear',
        updatedAt: new Date(),
      };
      const index = this.professionals.findIndex((p) => p.id === id);
      if (index !== -1) {
        this.professionals[index] = updated;
        this.saveToStorage();
      }
      return updated;
    };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const body = await firstValueFrom(
          this.http.put<ApiProfessional | { data?: ApiProfessional }>(
            `${environment.apiPaths.professionals}/${id}`,
            payload,
            { context: tenantApiContext() }
          )
        );
        const dto = unwrapResource(body) ?? (body as ApiProfessional);
        const updated = this.fromDto({ ...dto, id: dto.id ?? id });
        const index = this.professionals.findIndex((p) => p.id === id);
        if (index !== -1) {
          this.professionals[index] = updated;
          this.saveToStorage();
        }
        return updated;
      } catch (error) {
        console.warn(`[API] PUT /v1/professionals/${id} falló.`, error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  async deleteProfessional(id: string): Promise<boolean> {
    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        await firstValueFrom(
          this.http.delete<void>(
            `${environment.apiPaths.professionals}/${id}`,
            { context: tenantApiContext() }
          )
        );
      } catch (error) {
        console.warn(`[API] DELETE /v1/professionals/${id} falló.`, error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    const index = this.professionals.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }
    this.professionals.splice(index, 1);
    this.saveToStorage();
    return true;
  }
}
