import { Component, input, output } from '@angular/core';
import { IonIcon, IonModal, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeCircleOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-cancel-appointment-modal',
  standalone: true,
  imports: [IonModal, IonIcon, IonSpinner],
  templateUrl: './cancel-appointment-modal.component.html',
  styleUrl: './cancel-appointment-modal.component.scss',
})
export class CancelAppointmentModalComponent {
  readonly isOpen = input(false);
  readonly clientName = input('');
  readonly cancelling = input(false);

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  constructor() {
    addIcons({ closeCircleOutline, closeOutline });
  }

  onDismiss(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  confirm(): void {
    this.confirmed.emit();
  }
}
