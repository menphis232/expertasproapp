export interface ClientFieldValue {
  id: string;
  description: string;
  tipo: string;
  valor: string | null;
  position: number;
}

export interface ClientAppointmentRecord {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  servicio: string;
}

export interface ClientDetail {
  id: string;
  nombreCompleto: string;
  nombres: string;
  apellidos: string;
  rut?: string;
  fechaNacimiento?: Date;
  edad?: number;
  userAssigned?: string;
  createdAt: Date;
  citas: ClientAppointmentRecord[];
  enfermedades: { id: string; description: string; comment: string }[];
  medicamentos: { id: string; description: string; comment: string }[];
  camposValores: ClientFieldValue[];
}

export interface ClientFileSection {
  title: string;
  fields: { label: string; value: string }[];
}
