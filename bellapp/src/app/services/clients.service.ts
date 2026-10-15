import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { parseApiDate, unwrapList, unwrapResource } from '../core/api/api-normalizers';
import { fetchTenantList } from '../core/api/tenant-api.helper';
import { tenantApiContext } from '../core/http/http.context';
import { TenantContextService } from '../core/tenant/tenant-context.service';
import {
  ClientFieldConfig,
  ClientFieldConfigPayload,
  ClientFieldConfigSaveItem,
  FieldRoleRef,
  TIPO_DATOS,
} from '../models/client-field-config.model';
import {
  ClientAppointmentRecord,
  ClientDetail,
  ClientFieldValue,
} from '../models/client-detail.model';

export interface CustomField {
  id: string;
  description: string;
  dataType: 'Texto' | 'Número' | 'Fecha' | 'Lista' | 'Moneda' | 'Checkboxes';
  role: string;
  columnNumber: number;
  required: boolean;
  order: number;
}

export interface Illness {
  id: string;
  description: string;
  comment: string;
}

export interface Medication {
  id: string;
  description: string;
  comment: string;
}

export interface ClientFieldWrite {
  id: number;
  descripcion: string;
  valor: string | null;
}

export interface ClientWritePayload {
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  rut?: string | null;
  referido_por?: string | null;
  credenciales?: string | null;
  enfermedades: { description: string; comment: string }[];
  medicamentos: { description: string; comment: string }[];
  campos_valores: ClientFieldWrite[];
}

export interface Client {
  id: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: Date;
  rut?: string;
  referidoPor?: string;
  credenciales?: string;
  enfermedades: Illness[];
  medicamentos: Medication[];
  customFields?: { [key: string]: any };
  createdAt: Date;
  updatedAt: Date;
}

interface ApiFieldRole {
  id?: number;
  name?: string;
}

interface ApiFieldConfig {
  id?: number | string;
  tipo_dato_id?: number;
  descripcion?: string;
  requerido?: boolean;
  show_column?: number | boolean;
  position?: number;
  options?: string[];
  roles?: (ApiFieldRole | string)[];
  role_names?: string[];
  tipo_dato?: { id?: number; descripcion?: string; tipo?: string };
}

interface ApiClient {
  id?: number | string;
  nombres?: string;
  apellidos?: string;
  nombre_completo?: string;
  fechaNacimiento?: Date | string;
  fecha_nacimiento?: string;
  rut?: string;
  referidoPor?: string;
  referido_por?: string;
  credenciales?: string;
  enfermedades?: Illness[];
  medicamentos?: Medication[];
  customFields?: { [key: string]: unknown };
  created_at?: string;
  updated_at?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface ApiClientsPage {
  current_page?: number;
  data?: ApiClient[];
  last_page?: number;
  per_page?: number;
  total?: number;
}

interface ClientsPageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

interface ClientsListQuery {
  perPage: number;
  orderBy: string;
  sortedBy: 'asc' | 'desc';
}

interface ApiClientCita {
  id?: number;
  fecha?: string;
  estado?: string;
  servicio?: { descripcion?: string };
}

interface ApiClientFieldValue {
  id?: number | string;
  descripcion?: string;
  position?: number;
  valor?: string | null;
  tipo_dato?: { tipo?: string; descripcion?: string };
}

interface ApiClientDetail extends ApiClient {
  edad?: number;
  fecha_nacimiento?: string;
  user_assigned?: { name?: string } | null;
  citas?: ApiClientCita[];
  campos_valores?: ApiClientFieldValue[];
  enfermedades?: Illness[];
  medicamentos?: Medication[];
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantContextService);
  private storageKey = 'bellapp_clients';
  private fieldsConfigKey = 'bellapp_client_fields_config';

  constructor() {
    this.loadFromStorage();
    this.initializeDefaultFields();
  }

  async refresh(): Promise<void> {
    await this.loadClientsPage(1, true);

    const fields = await fetchTenantList<ApiFieldConfig>(
      this.http,
      this.tenant,
      environment.apiPaths.clientFieldsConfig,
      () => this.customFields.map((f) => this.fieldToDto(f))
    );
    if (fields.length > 0) {
      this.fieldConfigCache = fields.map((f) => this.parseApiFieldConfig(f));
      this.customFields = this.fieldConfigCache.map((f) => this.configToCustomField(f));
      this.saveToStorage();
    }
  }

  getFieldConfigs(): ClientFieldConfig[] {
    return [...this.fieldConfigCache].sort((a, b) => a.position - b.position);
  }

  private configToCustomField(field: ClientFieldConfig): CustomField {
    return {
      id: field.id != null ? String(field.id) : '',
      description: field.descripcion,
      dataType: this.mapFieldDataType(field.tipo_dato?.descripcion),
      role: field.roles[0]?.name ?? 'Todos',
      columnNumber: field.show_column,
      required: field.requerido,
      order: field.position,
    };
  }

  private parseFieldConfig(raw: ApiFieldConfig): CustomField {
    return {
      id: String(raw.id ?? ''),
      description: raw.descripcion ?? '',
      dataType: this.mapFieldDataType(raw.tipo_dato?.descripcion),
      role: raw.role_names?.[0] ?? 'Todos',
      columnNumber: this.parseShowColumn(raw.show_column),
      required: raw.requerido ?? false,
      order: raw.position ?? 0,
    };
  }

  private fieldToDto(field: CustomField): ApiFieldConfig {
    return {
      id: field.id,
      descripcion: field.description,
      requerido: field.required,
      show_column: field.columnNumber,
      position: field.order,
      role_names: [field.role],
    };
  }

  private mapFieldDataType(
    tipo?: string
  ): CustomField['dataType'] {
    switch (tipo) {
      case 'Número':
        return 'Número';
      case 'Fecha':
        return 'Fecha';
      case 'Lista':
        return 'Lista';
      case 'Moneda':
        return 'Moneda';
      case 'Checkboxes':
        return 'Checkboxes';
      default:
        return 'Texto';
    }
  }

  private parseClient(raw: ApiClient | Client): Client {
    const api = raw as ApiClient;
    let nombres = raw.nombres ?? '';
    let apellidos = raw.apellidos ?? '';

    if (!nombres && api.nombre_completo) {
      const parts = api.nombre_completo.trim().split(/\s+/);
      nombres = parts[0] ?? '';
      apellidos = parts.slice(1).join(' ');
    }

    return {
      id: String(raw.id ?? ''),
      nombres,
      apellidos,
      fechaNacimiento:
        parseApiDate(raw.fechaNacimiento) ??
        parseApiDate(api.fecha_nacimiento) ??
        (typeof raw.fechaNacimiento === 'string'
          ? new Date(raw.fechaNacimiento)
          : undefined),
      rut: raw.rut,
      referidoPor: raw.referidoPor ?? api.referido_por,
      credenciales: raw.credenciales,
      enfermedades: raw.enfermedades ?? [],
      medicamentos: raw.medicamentos ?? [],
      customFields: raw.customFields,
      createdAt:
        parseApiDate((raw as ApiClient).created_at ?? raw.createdAt) ??
        new Date(),
      updatedAt:
        parseApiDate((raw as ApiClient).updated_at ?? raw.updatedAt) ??
        new Date(),
    };
  }

  private clients: Client[] = [];
  private customFields: CustomField[] = [];
  private fieldConfigCache: ClientFieldConfig[] = [];
  private pageMeta: ClientsPageMeta = {
    currentPage: 1,
    lastPage: 1,
    perPage: 20,
    total: 0,
  };

  private listQuery: ClientsListQuery = {
    perPage: 20,
    orderBy: 'nombres',
    sortedBy: 'desc',
  };

  setClientListSort(sortedBy: 'asc' | 'desc'): void {
    this.listQuery = {
      ...this.listQuery,
      orderBy: 'nombres',
      sortedBy,
    };
  }

  hasMoreClients(): boolean {
    return this.pageMeta.currentPage < this.pageMeta.lastPage;
  }

  clientsTotal(): number {
    return this.pageMeta.total > 0 ? this.pageMeta.total : this.clients.length;
  }

  async loadMoreClients(): Promise<void> {
    if (!this.hasMoreClients()) {
      return;
    }
    await this.loadClientsPage(this.pageMeta.currentPage + 1, false);
  }

  private async loadRemainingClientPages(): Promise<void> {
    let guard = 0;
    while (this.hasMoreClients() && guard < 20) {
      const before = this.pageMeta.currentPage;
      try {
        await this.loadClientsPage(before + 1, false);
      } catch (error) {
        console.warn('[ClientsService] No se pudo cargar la página siguiente de clientes', error);
        break;
      }
      if (this.pageMeta.currentPage <= before) {
        break;
      }
      guard += 1;
    }
  }

  private async loadClientsPage(page: number, replace: boolean): Promise<void> {
    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      this.pageMeta = {
        currentPage: 1,
        lastPage: 1,
        perPage: this.clients.length || 30,
        total: this.clients.length,
      };
      return;
    }

    try {
      const body = await firstValueFrom(
        this.http.get<ApiClientsPage | ApiClient[]>(environment.apiPaths.clients, {
          context: tenantApiContext(),
          params: {
            page: String(page),
            perPage: String(this.listQuery.perPage),
            orderBy: this.listQuery.orderBy,
            sortedBy: this.listQuery.sortedBy,
          },
        })
      );
      const parsed = this.parseClientsPage(body, page);
      if (parsed.items.length === 0 && parsed.total > 0) {
        throw new Error('La página de clientes llegó sin registros');
      }

      if (replace) {
        this.clients = parsed.items;
      } else {
        const known = new Set(this.clients.map((client) => client.id));
        const fresh = parsed.items.filter((client) => client.id && !known.has(client.id));
        if (fresh.length === 0) {
          this.pageMeta = { ...this.pageMeta, currentPage: this.pageMeta.lastPage };
          this.saveToStorage();
          return;
        }
        this.clients = [...this.clients, ...fresh];
      }

      this.pageMeta = {
        currentPage: parsed.currentPage,
        lastPage: Math.max(parsed.lastPage, 1),
        perPage: parsed.perPage,
        total: parsed.total,
      };
      this.saveToStorage();
    } catch (error) {
      console.warn(
        `[ClientsService] GET /v1/clientes?page=${page}&perPage=${this.listQuery.perPage}&orderBy=${this.listQuery.orderBy}&sortedBy=${this.listQuery.sortedBy} falló`,
        error
      );
      if (replace && environment.fallbackToLocalStorage) {
        this.pageMeta = {
          currentPage: 1,
          lastPage: 1,
          perPage: this.clients.length || 30,
          total: this.clients.length,
        };
        return;
      }
      throw error;
    }
  }

  private parseClientsPage(
    body: ApiClientsPage | ApiClient[],
    requestedPage: number
  ): { items: Client[]; currentPage: number; lastPage: number; perPage: number; total: number } {
    if (Array.isArray(body)) {
      const items = body.map((client) => this.parseClient(client));
      return {
        items,
        currentPage: 1,
        lastPage: 1,
        perPage: items.length || 30,
        total: items.length,
      };
    }

    const source = this.unwrapClientsPayload(body);
    if (Array.isArray(source)) {
      const items = source.map((client) => this.parseClient(client));
      return {
        items,
        currentPage: 1,
        lastPage: 1,
        perPage: items.length || this.listQuery.perPage,
        total: items.length,
      };
    }

    const rows = Array.isArray(source.data) ? source.data : [];
    const items = rows.map((client) => this.parseClient(client));
    const lastPage = source.last_page && source.last_page > 0 ? source.last_page : 1;
    return {
      items,
      currentPage: source.current_page ?? requestedPage,
      lastPage,
      perPage: source.per_page && source.per_page > 0 ? source.per_page : this.listQuery.perPage,
      total: source.total ?? items.length,
    };
  }

  private unwrapClientsPayload(
    body: ApiClientsPage | ApiClient[]
  ): ApiClientsPage | ApiClient[] {
    if (Array.isArray(body) || !body?.data || Array.isArray(body.data)) {
      return body;
    }

    const nested = body.data as unknown as ApiClientsPage;
    if (nested && typeof nested === 'object' && (nested.current_page != null || Array.isArray(nested.data))) {
      return nested;
    }

    return body;
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.clients = parsed.map((client: Client) => this.parseClient(client));
      } catch (e) {
        console.error('Error loading clients from storage:', e);
        this.clients = [];
      }
    }

    const fieldsStored = localStorage.getItem(this.fieldsConfigKey);
    if (fieldsStored) {
      try {
        this.customFields = JSON.parse(fieldsStored);
      } catch (e) {
        console.error('Error loading fields config from storage:', e);
        this.initializeDefaultFields();
      }
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.clients));
      localStorage.setItem(this.fieldsConfigKey, JSON.stringify(this.customFields));
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  }

  private initializeDefaultFields(): void {
    if (this.customFields.length === 0) {
      this.customFields = [
        { id: '1', description: 'Teléfono', dataType: 'Texto', role: 'Todos', columnNumber: 1, required: true, order: 1 },
        { id: '2', description: 'Sexo', dataType: 'Texto', role: 'Todos', columnNumber: 1, required: false, order: 2 },
        { id: '3', description: 'Email', dataType: 'Texto', role: 'Todos', columnNumber: 1, required: true, order: 3 },
        { id: '4', description: 'Dirección', dataType: 'Texto', role: 'Todos', columnNumber: 1, required: false, order: 4 },
        { id: '5', description: 'Profesión / Actividad laboral', dataType: 'Texto', role: 'Todos', columnNumber: 1, required: false, order: 5 }
      ];
      this.saveToStorage();
    }
  }

  getClients(): Client[] {
    return this.clients;
  }

  getClientById(id: string): Client | undefined {
    return this.clients.find(c => c.id === id);
  }

  findClientForAppointment(
    clienteId?: number,
    clienteNombre?: string
  ): Client | undefined {
    if (clienteId != null) {
      const byId = this.getClientById(String(clienteId));
      if (byId) return byId;
    }

    if (!clienteNombre) return undefined;

    const normalized = clienteNombre.toLowerCase().trim();
    return this.clients.find((c) => {
      const full = `${c.nombres} ${c.apellidos}`.toLowerCase().trim();
      return full === normalized;
    });
  }

  async fetchClientDetail(id: string): Promise<ClientDetail | null> {
    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      return this.clientToDetail(this.getClientById(id));
    }

    try {
      const body = await firstValueFrom(
        this.http.get<ApiClientDetail | { data?: ApiClientDetail }>(
          `${environment.apiPaths.clients}/${id}`,
          { context: tenantApiContext() }
        )
      );
      const dto = unwrapResource(body);
      const detail = dto ? this.parseClientDetail(dto, id) : null;
      if (detail) return detail;
      return this.clientToDetail(this.getClientById(id));
    } catch (error) {
      console.warn(`[ClientsService] GET /clientes/${id} falló`, error);
      return this.clientToDetail(this.getClientById(id));
    }
  }

  private parseClientDetail(dto: ApiClientDetail, fallbackId?: string): ClientDetail | null {
    const resourceId = dto.id ?? fallbackId;
    if (resourceId == null || resourceId === '') return null;

    const parsed = this.parseClient(dto);
    const camposValores = (dto.campos_valores ?? []).map((f) =>
      this.parseFieldValue(f)
    );

    return {
      id: String(resourceId),
      nombreCompleto:
        dto.nombre_completo ??
        `${parsed.nombres} ${parsed.apellidos}`.trim(),
      nombres: parsed.nombres,
      apellidos: parsed.apellidos,
      rut: dto.rut ?? undefined,
      fechaNacimiento: parseApiDate(dto.fecha_nacimiento) ?? parsed.fechaNacimiento,
      edad: dto.edad,
      userAssigned: dto.user_assigned?.name,
      createdAt: parsed.createdAt,
      citas: (dto.citas ?? []).map((c) => this.parseCita(c)),
      enfermedades: (dto.enfermedades ?? []).map((e) => ({
        id: String(e.id ?? ''),
        description: e.description,
        comment: e.comment,
      })),
      medicamentos: (dto.medicamentos ?? []).map((m) => ({
        id: String(m.id ?? ''),
        description: m.description,
        comment: m.comment,
      })),
      camposValores,
    };
  }

  private parseFieldValue(raw: ApiClientFieldValue): ClientFieldValue {
    return {
      id: String(raw.id ?? ''),
      description: raw.descripcion ?? '',
      tipo: raw.tipo_dato?.tipo ?? 'string',
      valor: raw.valor ?? null,
      position: raw.position ?? 0,
    };
  }

  private parseCita(raw: ApiClientCita): ClientAppointmentRecord {
    const fecha = raw.fecha ?? '';
    const normalized = fecha.replace('T', ' ');
    const [datePart, timePart] = normalized.split(' ');
    return {
      id: raw.id ?? 0,
      fecha: datePart ?? fecha,
      hora: timePart?.slice(0, 5) ?? '',
      estado: raw.estado ?? 'pendiente',
      servicio: raw.servicio?.descripcion ?? '',
    };
  }

  private clientToDetail(client?: Client): ClientDetail | null {
    if (!client) return null;

    return {
      id: client.id,
      nombreCompleto: `${client.nombres} ${client.apellidos}`.trim(),
      nombres: client.nombres,
      apellidos: client.apellidos,
      rut: client.rut,
      fechaNacimiento: client.fechaNacimiento,
      createdAt: client.createdAt,
      citas: [],
      enfermedades: client.enfermedades,
      medicamentos: client.medicamentos,
      camposValores: [],
    };
  }

  addClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client {
    const newClient: Client = {
      ...client,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.clients.push(newClient);
    this.saveToStorage();
    return newClient;
  }

  updateClient(id: string, updates: Partial<Client>): Client | null {
    const index = this.clients.findIndex(c => c.id === id);
    if (index !== -1) {
      this.clients[index] = {
        ...this.clients[index],
        ...updates,
        updatedAt: new Date()
      };
      this.saveToStorage();
      return this.clients[index];
    }
    return null;
  }

  deleteClient(id: string): boolean {
    const index = this.clients.findIndex(c => c.id === id);
    if (index !== -1) {
      this.clients.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Configuración de campos personalizados
  getCustomFields(): CustomField[] {
    return [...this.customFields].sort((a, b) => a.order - b.order);
  }

  addCustomField(field: Omit<CustomField, 'id'>): CustomField {
    const newField: CustomField = {
      ...field,
      id: Date.now().toString()
    };
    this.customFields.push(newField);
    this.saveToStorage();
    return newField;
  }

  updateCustomField(id: string, updates: Partial<CustomField>): CustomField | null {
    const index = this.customFields.findIndex(f => f.id === id);
    if (index !== -1) {
      this.customFields[index] = { ...this.customFields[index], ...updates };
      this.saveToStorage();
      return this.customFields[index];
    }
    return null;
  }

  deleteCustomField(id: string): boolean {
    const index = this.customFields.findIndex(f => f.id === id);
    if (index !== -1) {
      this.customFields.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  updateFieldsOrder(fields: CustomField[]): void {
    this.customFields = fields.map((field, index) => ({
      ...field,
      order: index + 1
    }));
    this.saveToStorage();
  }

  /** Carga la configuración de campos desde la API (sin fallback local). */
  async fetchFieldConfiguration(): Promise<ClientFieldConfig[]> {
    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      return this.getCustomFields().map((f) => this.customFieldToConfig(f));
    }

    const body = await firstValueFrom(
      this.http.get<ApiFieldConfig[] | { data?: ApiFieldConfig[]; config_clientes?: ApiFieldConfig[] }>(
        environment.apiPaths.clientFieldsConfig,
        { context: tenantApiContext() }
      )
    );

    const parsed = unwrapList(body).map((item) => this.parseApiFieldConfig(item));
    if (parsed.length > 0) {
      this.fieldConfigCache = parsed;
    }
    return parsed;
  }

  async saveClient(id: string | null, payload: ClientWritePayload): Promise<Client | null> {
    const applyLocal = (): Client | null => {
      const data = this.writePayloadToClient(payload);
      if (id) {
        return this.updateClient(id, data);
      }
      return this.addClient(data);
    };

    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      return applyLocal();
    }

    const request = id
      ? this.http.put<ApiClient | { data?: ApiClient }>(
          `${environment.apiPaths.clients}/${id}`,
          payload,
          { context: tenantApiContext() }
        )
      : this.http.post<ApiClient | { data?: ApiClient }>(
          environment.apiPaths.clients,
          payload,
          { context: tenantApiContext() }
        );

    const body = await firstValueFrom(request);
    const dto = unwrapResource(body) ?? (body as ApiClient);
    const saved = this.parseClient({ ...dto, id: dto.id ?? id ?? '' });
    const index = this.clients.findIndex((c) => c.id === saved.id);
    if (index !== -1) {
      this.clients[index] = { ...this.clients[index], ...saved };
    } else if (saved.id) {
      this.clients.push({
        ...saved,
        enfermedades: saved.enfermedades ?? [],
        medicamentos: saved.medicamentos ?? [],
        createdAt: saved.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
    }
    this.saveToStorage();
    return saved.id ? saved : applyLocal();
  }

  private writePayloadToClient(payload: ClientWritePayload): Omit<Client, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      nombres: payload.nombres,
      apellidos: payload.apellidos,
      fechaNacimiento: payload.fecha_nacimiento ? new Date(payload.fecha_nacimiento) : undefined,
      rut: payload.rut ?? undefined,
      referidoPor: payload.referido_por ?? undefined,
      credenciales: payload.credenciales ?? undefined,
      enfermedades: payload.enfermedades.map((e, i) => ({
        id: `${Date.now()}_${i}`,
        description: e.description,
        comment: e.comment,
      })),
      medicamentos: payload.medicamentos.map((m, i) => ({
        id: `${Date.now()}_${i}`,
        description: m.description,
        comment: m.comment,
      })),
      customFields: Object.fromEntries(
        payload.campos_valores.map((f) => [String(f.id), f.valor ?? ''])
      ),
    };
  }

  /** Persiste la configuración de campos en la API. */
  async saveFieldConfiguration(
    items: ClientFieldConfigSaveItem[]
  ): Promise<ClientFieldConfig[]> {
    const payload: ClientFieldConfigPayload = { config_clientes: items };

    if (!environment.apiEnabled || !this.tenant.canUseTenantApi()) {
      this.applyLocalFieldConfig(items);
      return items.map((item, index) => this.saveItemToConfig(item, index));
    }

    const body = await firstValueFrom(
      this.http.post<ApiFieldConfig[] | { data?: ApiFieldConfig[] }>(
        environment.apiPaths.clientFieldsConfig,
        payload,
        { context: tenantApiContext() }
      )
    );

    const list = unwrapList(body);
    const parsed = list.length
      ? list.map((item) => this.parseApiFieldConfig(item))
      : items.map((item, index) => this.saveItemToConfig(item, index));

    this.syncCustomFieldsFromConfig(parsed);
    return parsed;
  }

  private parseApiFieldConfig(raw: ApiFieldConfig): ClientFieldConfig {
    const tipoDatoId = raw.tipo_dato_id ?? raw.tipo_dato?.id ?? 1;
    const catalogTipo = TIPO_DATOS.find((t) => t.id === tipoDatoId);

    return {
      id: raw.id != null ? Number(raw.id) : null,
      tipo_dato_id: tipoDatoId,
      descripcion: raw.descripcion ?? '',
      requerido: raw.requerido ?? false,
      show_column: this.parseShowColumn(raw.show_column),
      position: raw.position ?? 0,
      options: raw.options ?? [],
      roles: this.parseFieldRoles(raw),
      tipo_dato: raw.tipo_dato
        ? {
            id: raw.tipo_dato.id ?? tipoDatoId,
            descripcion: catalogTipo?.descripcion ?? raw.tipo_dato.descripcion ?? '',
            tipo: raw.tipo_dato.tipo ?? catalogTipo?.tipo ?? 'string',
          }
        : catalogTipo,
    };
  }

  private parseFieldRoles(raw: ApiFieldConfig): FieldRoleRef[] {
    if (raw.role_names?.length) {
      return raw.role_names.map((name, index) => ({ id: index + 1, name }));
    }

    return (raw.roles ?? []).map((role, index) => {
      if (typeof role === 'string') {
        return { id: index + 1, name: role };
      }
      return {
        id: role.id ?? index + 1,
        name: role.name,
      };
    });
  }

  private parseShowColumn(value?: number | boolean): number {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return this.normalizeShowColumn(value);
  }

  private normalizeShowColumn(value?: number): number {
    if (value == null || value <= 1) return value ?? 0;
    return 0;
  }

  private saveItemToConfig(
    item: ClientFieldConfigSaveItem,
    index: number
  ): ClientFieldConfig {
    const catalogTipo = TIPO_DATOS.find((t) => t.id === item.tipo_dato_id);
    return {
      id: item.id,
      tipo_dato_id: item.tipo_dato_id,
      descripcion: item.descripcion,
      requerido: item.requerido,
      show_column: item.show_column ? 1 : 0,
      position: item.position ?? index + 1,
      options: item.options,
      roles: item.roles.map((name, roleIndex) => ({ id: roleIndex + 1, name })),
      tipo_dato: catalogTipo,
    };
  }

  private customFieldToConfig(field: CustomField): ClientFieldConfig {
    const tipoDatoId =
      TIPO_DATOS.find((t) => t.descripcion.startsWith(field.dataType))?.id ?? 1;

    return {
      id: field.id ? Number(field.id) : null,
      tipo_dato_id: tipoDatoId,
      descripcion: field.description,
      requerido: field.required,
      show_column: field.columnNumber <= 1 ? field.columnNumber : 0,
      position: field.order,
      options: [],
      roles: [],
      tipo_dato: TIPO_DATOS.find((t) => t.id === tipoDatoId),
    };
  }

  private applyLocalFieldConfig(items: ClientFieldConfigSaveItem[]): void {
    const parsed = items.map((item, index) => this.saveItemToConfig(item, index));
    this.syncCustomFieldsFromConfig(parsed);
  }

  private syncCustomFieldsFromConfig(config: ClientFieldConfig[]): void {
    this.customFields = config.map((field) => ({
      id: field.id != null ? String(field.id) : Date.now().toString(),
      description: field.descripcion,
      dataType: this.mapFieldDataType(field.tipo_dato?.descripcion),
      role: field.roles[0]?.name ?? 'Todos',
      columnNumber: field.show_column,
      required: field.requerido,
      order: field.position,
    }));
    this.saveToStorage();
  }
}

