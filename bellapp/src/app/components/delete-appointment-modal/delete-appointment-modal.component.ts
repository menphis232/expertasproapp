import { Component, input, output } from '@angular/core';
import { IonIcon, IonModal, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';

@Component({
  selector: 'app-delete-appointment-modal',
  standalone: true,
  imports: [IonModal, IonIcon, IonSpinner],
  templateUrl: './delete-appointment-modal.component.html',
  styleUrl: './delete-appointment-modal.component.scss',
})
export class DeleteAppointmentModalComponent {
  readonly isOpen = input(false);
  readonly clientName = input('');
  readonly deleting = input(false);

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  constructor() {
    addIcons({ closeOutline, trashOutline });
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
