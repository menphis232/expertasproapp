import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { tenantApiContext } from '../core/http/http.context';
import { TenantContextService } from '../core/tenant/tenant-context.service';

export type AgendaEstado = 'pendiente' | 'realizado' | 'cancelado';

export interface AgendaItem {
  id: number;
  fecha: string;
  hora: string;
  clienteId?: number;
  clienteNombre: string;
  servicioId?: number;
  servicio: string;
  profesionalId?: number;
  profesionalNombre: string;
  estado: AgendaEstado;
  duracion: number;
}

export interface AgendaCompleteDetalle {
  config_servicio_id: number;
  valor: string;
  comentario?: string;
}

export interface AgendaUpsertPayload {
  clienteId: number;
  serviciosId: number[];
  profesionalId?: number;
  fecha: string;
  hora: string;
  comentario?: string;
}

export interface AgendaMetrics {
  pendiente: number;
  realizado: number;
}

interface ApiAgendaItem {
  id: number;
  fecha: string;
  end_at?: string;
  estado: string;
  duration_minutes?: number;
  cliente?: { id?: number; nombre_completo?: string };
  profesional?: { id?: number; name?: string };
  servicio?: { id?: number; descripcion?: string };
}

interface ApiAgendaResponse {
  meta: {
    metrics: {
      pendiente?: number;
      realizado?: number;
    };
  };
  current_page?: number;
  data: ApiAgendaItem[];
}

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantContextService);

  private readonly _items = signal<AgendaItem[]>([]);
  private readonly _metrics = signal<AgendaMetrics>({ pendiente: 0, realizado: 0 });

  readonly items = this._items.asReadonly();
  readonly metrics = this._metrics.asReadonly();

  readonly stats = computed(() => {
    const m = this._metrics();
    return {
      pending: m.pendiente,
      completed: m.realizado,
      cancelled: 0,
      total: m.pendiente + m.realizado,
    };
  });

  async refresh(month?: number, year?: number): Promise<void> {
    if (!this.canUseApi()) return;

    const now = new Date();
    const queryMonth = month ?? now.getMonth() + 1;
    const queryYear = year ?? now.getFullYear();

    try {
      const resp = await firstValueFrom(
        this.http.get<ApiAgendaResponse>(
          `${environment.apiPaths.agenda}?month=${queryMonth}&year=${queryYear}`,
          { context: tenantApiContext() }
        )
      );
      this._metrics.set({
        pendiente: resp.meta?.metrics?.pendiente ?? 0,
        realizado: resp.meta?.metrics?.realizado ?? 0,
      });
      this._items.set((resp.data ?? []).map((d) => this.fromDto(d)));
    } catch (error) {
      console.warn('[AgendaService] GET /v1/agenda falló', error);
      if (!environment.fallbackToLocalStorage) throw error;
    }
  }

  canUseApi(): boolean {
    return environment.apiEnabled && this.tenant.canUseTenantApi();
  }

  async create(payload: AgendaUpsertPayload): Promise<void> {
    if (!this.canUseApi()) {
      throw new Error('API de agenda no disponible');
    }

    await firstValueFrom(
      this.http.post(
        environment.apiPaths.agenda,
        this.toApiBody(payload),
        { context: tenantApiContext() }
      )
    );
  }

  async update(id: number, payload: AgendaUpsertPayload): Promise<void> {
    if (!this.canUseApi()) {
      throw new Error('API de agenda no disponible');
    }

    await firstValueFrom(
      this.http.put(
        `${environment.apiPaths.agenda}/${id}`,
        this.toApiBody(payload),
        { context: tenantApiContext() }
      )
    );
  }

  async updateEstado(id: number, estado: AgendaEstado): Promise<void> {
    if (!this.canUseApi()) {
      throw new Error('API de agenda no disponible');
    }

    await firstValueFrom(
      this.http.patch(
        `${environment.apiPaths.agenda}/${id}`,
        { estado },
        { context: tenantApiContext() }
      )
    );
  }

  /** DELETE /v1/agenda/{id} */
  async delete(id: number): Promise<void> {
    if (!this.canUseApi()) {
      throw new Error('API de agenda no disponible');
    }

    await firstValueFrom(
      this.http.delete(`${environment.apiPaths.agenda}/${id}`, {
        context: tenantApiContext(),
      })
    );
  }

  async cancel(id: number): Promise<void> {
    if (!this.canUseApi()) {
      throw new Error('API de agenda no disponible');
    }

    await firstValueFrom(
      this.http.put(
        `${environment.apiPaths.agenda}/cancel/${id}`,
        {},
        { context: tenantApiContext() }
      )
    );
  }

  async complete(id: number, detalles: AgendaCompleteDetalle[]): Promise<void> {
    if (!this.canUseApi()) {
      throw new Error('API de agenda no disponible');
    }

    await firstValueFrom(
      this.http.put(
        `${environment.apiPaths.agenda}/complete/${id}`,
        { detalles },
        { context: tenantApiContext() }
      )
    );
  }

  private toApiBody(payload: AgendaUpsertPayload): Record<string, unknown> {
    const body: Record<string, unknown> = {
      fecha: payload.fecha,
      hora: payload.hora,
      cliente_id: payload.clienteId,
      servicios_id: payload.serviciosId,
      comentario: payload.comentario ?? '',
    };

    if (payload.profesionalId != null) {
      body['profesional_id'] = payload.profesionalId;
    }

    return body;
  }

  private fromDto(dto: ApiAgendaItem): AgendaItem {
    const { dateKey, hora } = this.parseFechaHora(dto.fecha ?? '');
    return {
      id: dto.id,
      fecha: dateKey,
      hora,
      clienteId: dto.cliente?.id,
      clienteNombre: dto.cliente?.nombre_completo ?? 'Cliente',
      servicioId: dto.servicio?.id,
      servicio: dto.servicio?.descripcion ?? '',
      profesionalId: dto.profesional?.id,
      profesionalNombre: dto.profesional?.name ?? '',
      estado: this.normalizeEstado(dto.estado),
      duracion: dto.duration_minutes ?? 0,
    };
  }

  private parseFechaHora(raw: string): { dateKey: string; hora: string } {
    if (!raw) {
      return { dateKey: '', hora: '' };
    }

    const normalized = raw.replace('T', ' ');
    const [datePart, timePart] = normalized.split(' ');
    const hora = timePart?.slice(0, 5) ?? '';

    return { dateKey: datePart ?? raw, hora };
  }

  private normalizeEstado(estado: string): AgendaEstado {
    if (estado === 'realizado' || estado === 'completed') return 'realizado';
    if (estado === 'cancelado' || estado === 'cancelled') return 'cancelado';
    return 'pendiente';
  }
}
