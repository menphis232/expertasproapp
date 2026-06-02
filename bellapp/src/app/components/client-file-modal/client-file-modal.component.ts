import {
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import {
  IonContent,
  IonFooter,
  IonIcon,
  IonModal,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  closeOutline,
  createOutline,
  cubeOutline,
} from 'ionicons/icons';

import { ClientDetail } from '../../models/client-detail.model';

@Component({
  selector: 'app-client-file-modal',
  standalone: true,
  imports: [IonModal, IonContent, IonFooter, IonIcon, IonSpinner],
  templateUrl: './client-file-modal.component.html',
  styleUrl: './client-file-modal.component.scss',
})
export class ClientFileModalComponent {
  readonly isOpen = input(false);
  readonly loading = input(false);
  readonly detail = input<ClientDetail | null>(null);

  readonly closed = output<void>();
  readonly editRequested = output<string>();

  readonly initials = computed(() => {
    const d = this.detail();
    if (!d) return '?';
    const a = d.nombres?.[0] ?? '';
    const b = d.apellidos?.[0] ?? '';
    return `${a}${b}`.toUpperCase() || '?';
  });

  readonly generalFields = computed(() => {
    const d = this.detail();
    if (!d) return [];

    const fields: { label: string; value: string }[] = [];

    if (d.rut) fields.push({ label: 'RUT', value: d.rut });
    if (d.fechaNacimiento) {
      fields.push({
        label: 'Fecha de nacimiento',
        value: new Intl.DateTimeFormat('es-CL', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d.fechaNacimiento),
      });
    }
    if (d.edad != null) {
      fields.push({ label: 'Edad', value: `${d.edad} años` });
    }

    const earlyFields = d.camposValores
      .filter(
        (f) =>
          f.tipo !== 'section' &&
          f.position < 7 &&
          f.valor?.trim()
      )
      .sort((a, b) => a.position - b.position);

    for (const f of earlyFields) {
      fields.push({ label: f.description, value: f.valor!.trim() });
    }

    return fields;
  });

  readonly anamnesisFields = computed(() => {
    const d = this.detail();
    if (!d) return [];

    return d.camposValores
      .filter(
        (f) => f.position > 7 && f.tipo !== 'section' && f.valor?.trim()
      )
      .sort((a, b) => a.position - b.position)
      .map((f) => ({
        label: f.description,
        value: f.valor!.trim().replace(/\r\n/g, '\n'),
      }));
  });

  readonly hasAnamnesis = computed(() => this.anamnesisFields().length > 0);

  constructor() {
    addIcons({
      calendarOutline,
      closeOutline,
      createOutline,
      cubeOutline,
    });
  }

  onDismiss(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  onEdit(): void {
    const id = this.detail()?.id;
    if (id) this.editRequested.emit(id);
  }

  citaStatusLabel(estado: string): string {
    if (estado === 'realizado' || estado === 'completed') return 'REALIZADA';
    if (estado === 'cancelado' || estado === 'cancelled') return 'CANCELADA';
    return 'PENDIENTE';
  }

  citaStatusClass(estado: string): string {
    if (estado === 'realizado' || estado === 'completed') return 'realizado';
    if (estado === 'cancelado' || estado === 'cancelled') return 'cancelado';
    return 'pendiente';
  }

  formatCitaDate(fecha: string): string {
    const [y, m, d] = fecha.split('-').map(Number);
    if (!y || !m || !d) return fecha;
    return new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
  }

  formatCreatedAt(date?: Date): string {
    if (!date) return '--';
    return new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}
