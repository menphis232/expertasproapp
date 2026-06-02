import { Component, input, output } from '@angular/core';
import {
  IonIcon,
  IonModal,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  closeOutline,
  informationCircleOutline,
  personCircleOutline,
  personOutline,
  sparklesOutline,
  timeOutline,
} from 'ionicons/icons';

import { AgendaEstado, AgendaItem } from '../../services/agenda.service';

@Component({
  selector: 'app-appointment-detail-modal',
  standalone: true,
  imports: [IonModal, IonIcon],
  templateUrl: './appointment-detail-modal.component.html',
  styleUrl: './appointment-detail-modal.component.scss',
})
export class AppointmentDetailModalComponent {
  readonly isOpen = input(false);
  readonly appointment = input<AgendaItem | null>(null);

  readonly closed = output<void>();

  constructor() {
    addIcons({
      calendarOutline,
      closeOutline,
      informationCircleOutline,
      personCircleOutline,
      personOutline,
      sparklesOutline,
      timeOutline,
    });
  }

  onDismiss(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  formatFecha(iso?: string): string {
    if (!iso) return '--';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
    }).format(date);
    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
    return `${weekday}, ${d} de ${month} de ${y}`;
  }

  formatHora(hora?: string): string {
    if (!hora) return '--';
    return hora.slice(0, 5);
  }

  statusLabel(estado: AgendaEstado): string {
    if (estado === 'realizado') return 'REALIZADA';
    if (estado === 'cancelado') return 'CANCELADA';
    return 'PENDIENTE';
  }

  statusClass(estado: AgendaEstado): string {
    return estado;
  }
}
