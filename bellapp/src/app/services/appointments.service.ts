import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { parseApiDate } from '../core/api/api-normalizers';
import { fetchTenantList } from '../core/api/tenant-api.helper';
import { tenantApiContext } from '../core/http/http.context';
import { TenantContextService } from '../core/tenant/tenant-context.service';

export interface Appointment {
  id: string;
  patientName: string;
  clientId?: string;
  service: string;
  professionalId?: string;
  professionalName?: string;
  time: string;
  date: Date;
  status: 'pending' | 'completed' | 'cancelled';
  comment?: string;
}

type AppointmentDto = Omit<Appointment, 'date'> & {
  date: string | Date;
  patient_name?: string;
  client_id?: string;
  professional_id?: string;
  professional_name?: string;
};

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantContextService);
  private readonly storageKey = 'bellapp_appointments';
  private appointments: Appointment[] = [];

  constructor() {
    this.loadFromStorage();
  }

  async refresh(): Promise<void> {
    const remote = await fetchTenantList<AppointmentDto>(
      this.http,
      this.tenant,
      environment.apiPaths.appointments,
      () => this.appointments
    );
    this.appointments = remote.map((dto) => this.fromDto(dto));
    this.saveToStorage();
  }

  getAppointments(): Appointment[] {
    return this.appointments;
  }

  getStatistics() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthAppointments = this.appointments.filter((apt) => {
      const aptDate = new Date(apt.date);
      return (
        aptDate.getMonth() === currentMonth &&
        aptDate.getFullYear() === currentYear
      );
    });

    return {
      pending: monthAppointments.filter((apt) => apt.status === 'pending')
        .length,
      completed: monthAppointments.filter((apt) => apt.status === 'completed')
        .length,
      cancelled: monthAppointments.filter((apt) => apt.status === 'cancelled')
        .length,
      total: monthAppointments.length,
    };
  }

  async addAppointment(
    appointment: Omit<Appointment, 'id'>
  ): Promise<Appointment> {
    const applyLocal = (): Appointment => {
      const created: Appointment = {
        ...appointment,
        id: Date.now().toString(),
      };
      this.appointments.push(created);
      this.saveToStorage();
      return created;
    };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const dto = await firstValueFrom(
          this.http.post<AppointmentDto>(
            environment.apiPaths.appointments,
            this.toDto(appointment),
            { context: tenantApiContext() }
          )
        );
        const created = this.fromDto({
          ...dto,
          id: String(dto.id ?? Date.now()),
        });
        this.appointments.push(created);
        this.saveToStorage();
        return created;
      } catch (error) {
        console.warn('[API] POST appointment falló.', error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    return applyLocal();
  }

  async updateAppointment(
    id: string,
    updates: Partial<Appointment>
  ): Promise<Appointment | null> {
    const existing = this.appointments.find((apt) => apt.id === id);
    if (!existing) {
      return null;
    }

    const merged = { ...existing, ...updates };

    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        const dto = await firstValueFrom(
          this.http.put<AppointmentDto>(
            `${environment.apiPaths.appointments}/${id}`,
            this.toDto(merged),
            { context: tenantApiContext() }
          )
        );
        const updated = this.fromDto({ ...dto, id: String(dto.id ?? id) });
        const index = this.appointments.findIndex((apt) => apt.id === id);
        if (index !== -1) {
          this.appointments[index] = updated;
          this.saveToStorage();
        }
        return updated;
      } catch (error) {
        console.warn('[API] PUT appointment falló.', error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    const index = this.appointments.findIndex((apt) => apt.id === id);
    this.appointments[index] = merged;
    this.saveToStorage();
    return merged;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    if (environment.apiEnabled && this.tenant.canUseTenantApi()) {
      try {
        await firstValueFrom(
          this.http.delete<void>(
            `${environment.apiPaths.appointments}/${id}`,
            { context: tenantApiContext() }
          )
        );
      } catch (error) {
        console.warn('[API] DELETE appointment falló.', error);
        if (!environment.fallbackToLocalStorage) {
          throw error;
        }
      }
    }

    const index = this.appointments.findIndex((apt) => apt.id === id);
    if (index === -1) {
      return false;
    }
    this.appointments.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  getAppointmentById(id: string): Appointment | undefined {
    return this.appointments.find((apt) => apt.id === id);
  }

  private fromDto(dto: AppointmentDto): Appointment {
    const date =
      parseApiDate(dto.date) ?? new Date(dto.date as string | Date);
    return {
      id: String(dto.id),
      patientName: dto.patientName ?? dto.patient_name ?? '',
      clientId: dto.clientId ?? dto.client_id,
      service: dto.service,
      professionalId: dto.professionalId ?? dto.professional_id,
      professionalName: dto.professionalName ?? dto.professional_name,
      time: dto.time,
      date,
      status: dto.status,
      comment: dto.comment,
    };
  }

  private toDto(
    appointment: Omit<Appointment, 'id'> | Appointment
  ): Record<string, unknown> {
    return {
      patient_name: appointment.patientName,
      client_id: appointment.clientId,
      service: appointment.service,
      professional_id: appointment.professionalId,
      professional_name: appointment.professionalName,
      time: appointment.time,
      date:
        appointment.date instanceof Date
          ? appointment.date.toISOString()
          : appointment.date,
      status: appointment.status,
      comment: appointment.comment,
    };
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppointmentDto[];
        this.appointments = parsed.map((apt) => this.fromDto(apt));
        return;
      } catch (e) {
        console.error('Error loading appointments from storage:', e);
      }
    }
    this.initializeDefaultData();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.appointments));
    } catch (e) {
      console.error('Error saving appointments to storage:', e);
    }
  }

  private initializeDefaultData(): void {
    this.appointments = [
      {
        id: '1',
        patientName: 'Giancarlo Poppa',
        clientId: '1',
        service: 'Limpieza + Extracción',
        professionalId: '1',
        professionalName: 'Constanza Astudillo',
        time: '10:00',
        date: new Date(2026, 0, 10),
        status: 'pending',
        comment: '',
      },
    ];
    this.saveToStorage();
  }
}
