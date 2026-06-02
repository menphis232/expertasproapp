import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ViewWillEnter } from '@ionic/angular';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  arrowDownOutline,
  arrowUpOutline,
  calendarOutline,
  checkmarkOutline,
  chevronDownOutline,
  closeOutline,
  createOutline,
  peopleOutline,
  personAddOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';

import { ClientFieldsConfigModalComponent } from '../../components/client-fields-config-modal/client-fields-config-modal.component';
import { Client, ClientsService, Illness, Medication } from '../../services/clients.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonFooter,
    IonContent,
    IonButtons,
    IonMenuButton,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonModal,
    IonButton,
    ClientFieldsConfigModalComponent,
  ],
  templateUrl: './clients.page.html',
  styleUrl: './clients.page.scss',
})
export class ClientsPage implements ViewWillEnter {
  private readonly clientsService = inject(ClientsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly alertCtrl = inject(AlertController);

  readonly clients = signal<Client[]>([]);
  readonly filtered = signal<Client[]>([]);
  readonly modalOpen = signal(false);
  readonly configModalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly sortDesc = signal(true);

  readonly form = this.fb.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    fechaNacimiento: [''],
    rut: [''],
    referidoPor: [''],
    credenciales: ['no_crear'],
    enfermedades: this.fb.array([]),
    medicamentos: this.fb.array([]),
  });

  get enfermedadesArray(): FormArray {
    return this.form.get('enfermedades') as FormArray;
  }

  get medicamentosArray(): FormArray {
    return this.form.get('medicamentos') as FormArray;
  }

  get otherClients(): Client[] {
    const editId = this.editingId();
    return this.clients().filter((c) => c.id !== editId);
  }

  constructor() {
    addIcons({
      personAddOutline,
      settingsOutline,
      arrowDownOutline,
      arrowUpOutline,
      peopleOutline,
      createOutline,
      trashOutline,
      calendarOutline,
      chevronDownOutline,
      addOutline,
      checkmarkOutline,
      closeOutline,
    });
  }

  async ionViewWillEnter(): Promise<void> {
    await this.clientsService.refresh();
    this.load();
  }

  load(): void {
    const sorted = [...this.clientsService.getClients()].sort((a, b) => {
      const cmp = `${a.apellidos}`.localeCompare(`${b.apellidos}`);
      return this.sortDesc() ? -cmp : cmp;
    });
    this.clients.set(sorted);
    this.filtered.set(sorted);
  }

  toggleSort(): void {
    this.sortDesc.update((v) => !v);
    this.load();
  }

  openConfig(): void {
    this.configModalOpen.set(true);
  }

  closeConfigModal(): void {
    this.configModalOpen.set(false);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.clearArrays();
    this.form.reset({ nombres: '', apellidos: '', fechaNacimiento: '', rut: '', referidoPor: '', credenciales: 'no_crear' });
    this.modalOpen.set(true);
  }

  openEdit(client: Client): void {
    this.editingId.set(client.id);
    this.clearArrays();

    (client.enfermedades ?? []).forEach((e) =>
      this.enfermedadesArray.push(this.fb.group({ descripcion: [e.description, Validators.required], comentario: [e.comment ?? ''] }))
    );
    (client.medicamentos ?? []).forEach((m) =>
      this.medicamentosArray.push(this.fb.group({ descripcion: [m.description, Validators.required], comentario: [m.comment ?? ''] }))
    );

    this.form.patchValue({
      nombres: client.nombres,
      apellidos: client.apellidos,
      fechaNacimiento: client.fechaNacimiento ? client.fechaNacimiento.toISOString().split('T')[0] : '',
      rut: client.rut ?? '',
      referidoPor: client.referidoPor ?? '',
      credenciales: client.credenciales ?? 'no_crear',
    });

    this.modalOpen.set(true);
  }

  addEnfermedad(): void {
    this.enfermedadesArray.push(this.fb.group({ descripcion: ['', Validators.required], comentario: [''] }));
  }

  removeEnfermedad(index: number): void {
    this.enfermedadesArray.removeAt(index);
  }

  addMedicamento(): void {
    this.medicamentosArray.push(this.fb.group({ descripcion: ['', Validators.required], comentario: [''] }));
  }

  removeMedicamento(index: number): void {
    this.medicamentosArray.removeAt(index);
  }

  getEnfermedadGroup(index: number): FormGroup {
    return this.enfermedadesArray.at(index) as FormGroup;
  }

  getMedicamentoGroup(index: number): FormGroup {
    return this.medicamentosArray.at(index) as FormGroup;
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const editId = this.editingId();

    const enfermedades: Illness[] = (v.enfermedades as { descripcion: string; comentario: string }[]).map((e, i) => ({
      id: `${Date.now()}_${i}`,
      description: e.descripcion,
      comment: e.comentario ?? '',
    }));

    const medicamentos: Medication[] = (v.medicamentos as { descripcion: string; comentario: string }[]).map((m, i) => ({
      id: `${Date.now()}_${i}`,
      description: m.descripcion,
      comment: m.comentario ?? '',
    }));

    const clientData = {
      nombres: v.nombres ?? '',
      apellidos: v.apellidos ?? '',
      fechaNacimiento: v.fechaNacimiento ? new Date(v.fechaNacimiento) : undefined,
      rut: v.rut || undefined,
      referidoPor: v.referidoPor || undefined,
      credenciales: v.credenciales || undefined,
      enfermedades,
      medicamentos,
    };

    if (editId) {
      const existing = this.clientsService.getClientById(editId);
      this.clientsService.updateClient(editId, { ...clientData, customFields: existing?.customFields });
      this.toast.success('Cliente actualizado');
    } else {
      this.clientsService.addClient(clientData);
      this.toast.success('Cliente creado');
    }

    this.closeModal();
    this.load();
  }

  async confirmDelete(client: Client): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar cliente',
      message: `¿Eliminar a ${client.nombres} ${client.apellidos}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.clientsService.deleteClient(client.id);
            this.toast.success('Cliente eliminado');
            this.load();
          },
        },
      ],
    });
    await alert.present();
  }

  private clearArrays(): void {
    while (this.enfermedadesArray.length) this.enfermedadesArray.removeAt(0);
    while (this.medicamentosArray.length) this.medicamentosArray.removeAt(0);
  }
}
