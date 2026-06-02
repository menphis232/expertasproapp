import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { parseApiDate, unwrapResource } from '../core/api/api-normalizers';
import { fetchTenantList } from '../core/api/tenant-api.helper';
import { tenantApiContext } from '../core/http/http.context';
import { TenantContextService } from '../core/tenant/tenant-context.service';
import { TIPO_DATOS } from '../models/client-field-config.model';

export interface ServiceField {
  id: string;
  description: string;
  dataType: 'Texto' | 'Número' | 'Fecha' | 'Lista' | 'Moneda';
  tipoDatoId?: number;
  required: boolean;
  order: number;
  options?: string[];
}

export interface Service {
  id: string;
  description: string;
  fields: ServiceField[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceFieldPayload {
  id?: number | null;
  descripcion: string;
  tipo_dato_id: number;
  requerido: boolean;
  options: string[];
  position: number;
}

export interface ServicePayload {
  descripcion: string;
  config_servicios: ServiceFieldPayload[];
}

interface ApiConfigServicio {
  id?: number;
  descripcion?: string;
  requerido?: boolean;
  position?: number;
  tipo_dato_id?: number;
  options?: string[];
  tipo_dato?: { id?: number; descripcion?: string };
}

interface ApiServicio {
  id?: number | string;
  descripcion?: string;
  description?: string;
  config_servicios?: ApiConfigServicio[];
  fields?: ServiceField[];
  created_at?: string;
  updated_at?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantContextService);
  private storageKey = 'bellapp_services';

  constructor() {
    this.loadFromStorage();
  }

  async refresh(): Promise<void> {
    const remote = await fetchTenantList<ApiServicio>(
      this.http,
      this.tenant,
      environment.apiPaths.services,
      () => this.services.map((s) => this.toDto(s))
    );
    this.services = remote.map((s) => this.fromDto(s));
    this.saveToStorage();
  }

  private services: Service[] = [];

  private fromDto(dto: ApiServicio): Service {
    const fields = (dto.config_servicios ?? dto.fields ?? []).map((f) =>
      this.mapField(f)
    );

    return {
      id: String(dto.id ?? ''),
      description: dto.descripcion ?? dto.description ?? '',
      fields,
      createdAt:
        parseApiDate(dto.created_at ?? dto.createdAt) ?? new Date(),
      updatedAt:
        parseApiDate(dto.updated_at ?? dto.updatedAt) ?? new Date(),
    };
  }

  private mapField(
    field: ApiConfigServicio | ServiceField
  ): ServiceField {
    if ('dataType' in field && field.dataType) {
      return field as ServiceField;
    }

    const apiField = field as ApiConfigServicio;
    const tipoDatoId = apiField.tipo_dato_id ?? apiField.tipo_dato?.id;
    return {
      id: String(apiField.id ?? ''),
      description: apiField.descripcion ?? '',
      dataType: this.mapDataTypeFromId(tipoDatoId, apiField.tipo_dato?.descripcion),
      tipoDatoId,
      required: apiField.requerido ?? false,
      order: apiField.position ?? 0,
      options: apiField.options ?? [],
    };
  }

  private mapDataTypeFromId(id?: number, descripcion?: string): ServiceField['dataType'] {
    if (descripcion) {
      return this.mapDataType(descripcion);
    }
    const tipo = TIPO_DATOS.find((t) => t.id === id);
    return tipo ? this.mapDataType(tipo.descripcion) : 'Texto';
  }

  mapDataTypeToId(dataType: ServiceField['dataType']): number {
    switch (dataType) {
      case 'Número':
        return 2;
      case 'Fecha':
        return 3;
      case 'Moneda':
        return 4;
      case 'Lista':
        return 6;
      default:
        return 1;
    }
  }

  private mapDataType(
    tipo?: string
  ): ServiceField['dataType'] {
    switch (tipo) {
      case 'Número':
        return 'Número';
      case 'Fecha':
        return 'Fecha';
      case 'Lista':
        return 'Lista';
      case 'Moneda':
        return 'Moneda';
      default:
        return 'Texto';
    }
  }

  private toDto(service: Service): ApiServicio {
    return {
      id: service.id,
      descripcion: service.description,
      fields: service.fields,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ApiServicio[];
        this.services = parsed.map((s) => this.fromDto(s));
      } catch (e) {
        console.error('Error loading services from storage:', e);
        this.services = [];
      }
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.services));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  }

  getServices(): Service[] {
    return this.services;
  }

  getServiceById(id: string): Service | undefined {
    return this.services.find((s) => s.id === id);
  }

  async fetchServiceDetail(id: string): Promise<Service | null> {
    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      return this.getServiceById(id) ?? null;
    }

    try {
      const body = await firstValueFrom(
        this.http.get<ApiServicio | { data?: ApiServicio }>(
          `${environment.apiPaths.services}/${id}`,
          { context: tenantApiContext() }
        )
      );
      const dto = unwrapResource(body);
      return dto ? this.fromDto({ ...dto, id: dto.id ?? id }) : this.getServiceById(id) ?? null;
    } catch (error) {
      console.warn(`[ServicesService] GET /v1/servicios/${id} falló`, error);
      return this.getServiceById(id) ?? null;
    }
  }

  async addService(payload: ServicePayload): Promise<Service> {
    const applyLocal = (): Service => {
      const fields: ServiceField[] = payload.config_servicios.map((f, i) => ({
        id: f.id != null ? String(f.id) : `${Date.now()}_${i}`,
        description: f.descripcion,
        dataType: this.mapDataTypeFromId(f.tipo_dato_id),
        tipoDatoId: f.tipo_dato_id,
        required: f.requerido,
        order: f.position,
        options: f.options ?? [],
      }));
      const newService: Service = {
        id: Date.now().toString(),
        description: payload.descripcion,
        fields,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.services.push(newService);
      this.saveToStorage();
      return newService;
    };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const body = await firstValueFrom(
          this.http.post<ApiServicio | { data?: ApiServicio }>(
            environment.apiPaths.services,
            payload,
            { context: tenantApiContext() }
          )
        );
        const dto = unwrapResource(body) ?? (body as ApiServicio);
        const created = this.fromDto({ ...dto, id: dto.id ?? Date.now() });
        this.services.push(created);
        this.saveToStorage();
        return created;
      } catch (error) {
        console.warn('[API] POST /v1/servicios falló.', error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  async updateService(id: string, payload: ServicePayload): Promise<Service | null> {
    const existing = this.services.find((s) => s.id === id);
    if (!existing) {
      return null;
    }

    const applyLocal = (): Service => {
      const fields: ServiceField[] = payload.config_servicios.map((f, i) => ({
        id: f.id != null ? String(f.id) : `${Date.now()}_${i}`,
        description: f.descripcion,
        dataType: this.mapDataTypeFromId(f.tipo_dato_id),
        tipoDatoId: f.tipo_dato_id,
        required: f.requerido,
        order: f.position,
        options: f.options ?? [],
      }));
      const updated: Service = {
        ...existing,
        description: payload.descripcion,
        fields,
        updatedAt: new Date(),
      };
      const index = this.services.findIndex((s) => s.id === id);
      if (index !== -1) {
        this.services[index] = updated;
        this.saveToStorage();
      }
      return updated;
    };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const body = await firstValueFrom(
          this.http.put<ApiServicio | { data?: ApiServicio }>(
            `${environment.apiPaths.services}/${id}`,
            payload,
            { context: tenantApiContext() }
          )
        );
        const dto = unwrapResource(body) ?? (body as ApiServicio);
        const updated = this.fromDto({ ...dto, id: dto.id ?? id });
        const index = this.services.findIndex((s) => s.id === id);
        if (index !== -1) {
          this.services[index] = updated;
          this.saveToStorage();
        }
        return updated;
      } catch (error) {
        console.warn(`[API] PUT /v1/servicios/${id} falló.`, error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  async deleteService(id: string): Promise<boolean> {
    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        await firstValueFrom(
          this.http.delete<void>(`${environment.apiPaths.services}/${id}`, {
            context: tenantApiContext(),
          })
        );
      } catch (error) {
        console.warn(`[API] DELETE /v1/servicios/${id} falló.`, error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    const index = this.services.findIndex((s) => s.id === id);
    if (index === -1) {
      return false;
    }
    this.services.splice(index, 1);
    this.saveToStorage();
    return true;
  }
}
