import { UpperCasePipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import {
  IonContent,
  IonFooter,
  IonIcon,
  IonModal,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleOutline,
  checkmarkCircleOutline,
  closeOutline,
} from 'ionicons/icons';

import { CompleteAppointmentField } from '../../models/complete-appointment.model';
import { AgendaCompleteDetalle } from '../../services/agenda.service';

@Component({
  selector: 'app-complete-appointment-modal',
  standalone: true,
  imports: [UpperCasePipe, IonModal, IonContent, IonFooter, IonIcon, IonSpinner],
  templateUrl: './complete-appointment-modal.component.html',
  styleUrl: './complete-appointment-modal.component.scss',
})
export class CompleteAppointmentModalComponent {
  readonly isOpen = input(false);
  readonly loading = input(false);
  readonly submitting = input(false);
  readonly clientName = input('');
  readonly serviceName = input('');
  readonly fields = input<CompleteAppointmentField[]>([]);

  readonly closed = output<void>();
  readonly confirmed = output<AgendaCompleteDetalle[]>();

  readonly fieldErrors = signal<Record<number, boolean>>({});

  constructor() {
    addIcons({
      chatbubbleOutline,
      checkmarkCircleOutline,
      closeOutline,
    });
  }

  onDismiss(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  updateValor(configServicioId: number, valor: string): void {
    const field = this.fields().find((f) => f.configServicioId === configServicioId);
    if (field) field.valor = valor;
    this.clearError(configServicioId);
  }

  updateComentario(configServicioId: number, comentario: string): void {
    const field = this.fields().find((f) => f.configServicioId === configServicioId);
    if (field) field.comentario = comentario;
  }

  confirm(): void {
    const errors: Record<number, boolean> = {};
    let hasError = false;

    for (const field of this.fields()) {
      if (field.required && !field.valor.trim()) {
        errors[field.configServicioId] = true;
        hasError = true;
      }
    }

    this.fieldErrors.set(errors);
    if (hasError) return;

    this.confirmed.emit(
      this.fields().map((field) => ({
        config_servicio_id: field.configServicioId,
        valor: field.valor.trim(),
        comentario: field.comentario.trim() || undefined,
      }))
    );
  }

  hasError(configServicioId: number): boolean {
    return !!this.fieldErrors()[configServicioId];
  }

  private clearError(configServicioId: number): void {
    const current = this.fieldErrors();
    if (!current[configServicioId]) return;
    const next = { ...current };
    delete next[configServicioId];
    this.fieldErrors.set(next);
  }
}
