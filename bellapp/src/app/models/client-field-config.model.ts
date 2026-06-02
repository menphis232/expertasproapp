export interface TipoDato {
  id: number;
  descripcion: string;
  tipo: string;
}

export interface FieldRoleRef {
  id: number;
  name?: string;
}

export interface ClientFieldConfig {
  id: number | null;
  tipo_dato_id: number;
  descripcion: string;
  requerido: boolean;
  show_column: number;
  position: number;
  options: string[];
  roles: FieldRoleRef[];
  tipo_dato?: TipoDato;
}

export interface ClientFieldConfigSaveItem {
  id: number | null;
  tipo_dato_id: number;
  descripcion: string;
  requerido: boolean;
  position: number;
  options: string[];
  show_column: boolean;
  roles: string[];
}

export interface ClientFieldConfigPayload {
  config_clientes: ClientFieldConfigSaveItem[];
}

/** Catálogo de tipos de dato soportados por la API */
export const TIPO_DATOS: TipoDato[] = [
  { id: 1, descripcion: 'Texto corto', tipo: 'string' },
  { id: 5, descripcion: 'Texto largo', tipo: 'large_text' },
  { id: 2, descripcion: 'Número', tipo: 'number' },
  { id: 3, descripcion: 'Fecha', tipo: 'date' },
  { id: 6, descripcion: 'Lista', tipo: 'list' },
  { id: 4, descripcion: 'Moneda', tipo: 'currency' },
  { id: 10, descripcion: 'Checkboxes', tipo: 'checkboxes' },
  { id: 7, descripcion: 'Sección', tipo: 'section' },
  { id: 8, descripcion: 'Sí/No', tipo: 'yes_no' },
  { id: 9, descripcion: 'Sí/No ¿Cuáles?', tipo: 'yes_no_which' },
];

export const COLUMN_OPTIONS = [
  { value: 0, label: 'Columna 1' },
  { value: 1, label: 'Columna 2' },
] as const;

export type FieldRoleKey = 'todos' | 'admin' | 'usuario';

export const FIELD_ROLE_OPTIONS: {
  value: FieldRoleKey;
  label: string;
  roleIds: number[];
  roleNames: string[];
}[] = [
  { value: 'todos', label: 'Todos', roleIds: [], roleNames: [] },
  { value: 'admin', label: 'Admin', roleIds: [1], roleNames: ['Administrador'] },
  { value: 'usuario', label: 'Usuario', roleIds: [2], roleNames: ['Cliente'] },
];
