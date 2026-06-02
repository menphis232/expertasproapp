import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  checkmarkOutline,
  chevronDownOutline,
  closeOutline,
  createOutline,
  peopleOutline,
  personAddOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  CreateProfessionalPayload,
  Professional,
  ProfessionalsService,
  UpdateProfessionalPayload,
} from '../../services/professionals.service';
import { Service, ServicesService } from '../../services/services.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-professionals',
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
  ],
  templateUrl: './professionals.page.html',
  styleUrl: './professionals.page.scss',
})
export class ProfessionalsPage implements ViewWillEnter {
  private readonly professionalsService = inject(ProfessionalsService);
  private readonly servicesService = inject(ServicesService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly alertCtrl = inject(AlertController);

  readonly list = signal<Professional[]>([]);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly sortDesc = signal(true);

  // Multi-select services
  readonly selectedServiceIds = signal<string[]>([]);
  readonly serviceSearch = signal('');
  readonly serviceDropdownOpen = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombreApellido: ['', Validators.required],
    rut: ['', Validators.required],
    credenciales: ['no_crear'],
    email: ['', Validators.email],
    password: [''],
    passwordConfirm: [''],
  });

  get showUserCredentials(): boolean {
    return this.form.controls.credenciales.value === 'crear';
  }

  get filteredServices(): Service[] {
    const q = this.serviceSearch().toLowerCase().trim();
    const all = this.servicesService.getServices();
    return q ? all.filter((s) => s.description.toLowerCase().includes(q)) : all;
  }

  getServicesLabel(): string {
    const ids = this.selectedServiceIds();
    if (!ids.length) return 'Seleccionar servicios';
    return ids
      .map((id) => this.servicesService.getServiceById(id)?.description ?? '')
      .filter(Boolean)
      .join(', ');
  }

  isServiceSelected(id: string): boolean {
    return this.selectedServiceIds().includes(id);
  }

  toggleService(id: string): void {
    const current = this.selectedServiceIds();
    this.selectedServiceIds.set(
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
    );
  }

  toggleServiceDropdown(): void {
    this.serviceDropdownOpen.update((v) => !v);
  }

  closeServiceDropdown(): void {
    this.serviceDropdownOpen.set(false);
    this.serviceSearch.set('');
  }

  constructor() {
    addIcons({
      personAddOutline,
      arrowDownOutline,
      arrowUpOutline,
      peopleOutline,
      createOutline,
      trashOutline,
      chevronDownOutline,
      searchOutline,
      addOutline,
      checkmarkOutline,
      closeOutline,
    });
  }

  async ionViewWillEnter(): Promise<void> {
    await Promise.all([
      this.professionalsService.refresh(),
      this.servicesService.refresh(),
    ]);
    this.load();
  }

  load(): void {
    const sorted = [...this.professionalsService.getProfessionals()].sort((a, b) => {
      const cmp = a.nombreApellido.localeCompare(b.nombreApellido);
      return this.sortDesc() ? -cmp : cmp;
    });
    this.list.set(sorted);
  }

  toggleSort(): void {
    this.sortDesc.update((v) => !v);
    this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.selectedServiceIds.set([]);
    this.serviceSearch.set('');
    this.serviceDropdownOpen.set(false);
    this.form.reset({
      nombreApellido: '',
      rut: '',
      credenciales: 'no_crear',
      email: '',
      password: '',
      passwordConfirm: '',
    });
    this.setCredentialValidators(false);
    this.modalOpen.set(true);
  }

  openEdit(p: Professional): void {
    this.editingId.set(p.id);
    const ids = (p.servicios ?? [])
      .map((desc) => this.servicesService.getServices().find((s) => s.description === desc)?.id ?? '')
      .filter(Boolean);
    this.selectedServiceIds.set(ids);
    this.serviceSearch.set('');
    this.serviceDropdownOpen.set(false);
    this.form.patchValue({
      nombreApellido: p.nombreApellido,
      rut: p.rut,
      credenciales: p.credenciales === 'crear' ? 'crear' : 'no_crear',
      email: '',
      password: '',
      passwordConfirm: '',
    });
    this.setCredentialValidators(false);
    this.modalOpen.set(true);
  }

  onCredencialesChange(): void {
    this.setCredentialValidators(this.showUserCredentials);
  }

  private setCredentialValidators(createUser: boolean): void {
    const email = this.form.controls.email;
    const password = this.form.controls.password;
    const confirm = this.form.controls.passwordConfirm;

    if (createUser) {
      email.setValidators([Validators.required, Validators.email]);
      password.setValidators([Validators.required, Validators.minLength(6)]);
      confirm.setValidators([Validators.required]);
    } else {
      email.setValidators([Validators.email]);
      password.clearValidators();
      confirm.clearValidators();
    }

    email.updateValueAndValidity();
    password.updateValueAndValidity();
    confirm.updateValueAndValidity();
  }

  closeModal(): void {
    this.serviceDropdownOpen.set(false);
    this.modalOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const serviceIds = this.selectedServiceIds();
    if (!serviceIds.length) {
      this.toast.error('Selecciona al menos un servicio');
      return;
    }

    const servicioIds = serviceIds
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));

    if (v.credenciales === 'crear' && v.password !== v.passwordConfirm) {
      this.toast.error('Las contraseñas no coinciden');
      return;
    }

    const apiPayload = this.buildApiPayload(v, servicioIds);
    const editId = this.editingId();

    try {
      if (editId) {
        await this.professionalsService.updateProfessional(
          editId,
          apiPayload as UpdateProfessionalPayload
        );
        this.toast.success('Profesional actualizado');
      } else {
        await this.professionalsService.addProfessional(
          apiPayload as CreateProfessionalPayload
        );
        this.toast.success('Profesional creado');
      }
      this.closeModal();
      this.load();
    } catch {
      this.toast.error(
        editId ? 'No se pudo actualizar el profesional' : 'No se pudo crear el profesional'
      );
    }
  }

  private buildApiPayload(
    v: {
      nombreApellido: string;
      rut: string;
      credenciales: string;
      email: string;
      password: string;
      passwordConfirm: string;
    },
    servicioIds: number[]
  ): CreateProfessionalPayload {
    const payload: CreateProfessionalPayload = {
      rut: v.rut,
      name: v.nombreApellido,
      servicios: servicioIds,
      user_option: v.credenciales === 'crear' ? 'create_user' : 'no_user',
    };

    if (payload.user_option === 'create_user') {
      payload.email = v.email;
      if (v.password) {
        payload.password = v.password;
        payload.password_confirm = v.passwordConfirm;
      }
    }

    return payload;
  }

  async confirmDelete(p: Professional): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar profesional',
      message: `¿Eliminar a ${p.nombreApellido}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              const ok = await this.professionalsService.deleteProfessional(p.id);
              if (ok) {
                this.toast.success('Profesional eliminado');
                this.load();
              } else {
                this.toast.error('No se pudo eliminar el profesional');
              }
            } catch {
              this.toast.error('No se pudo eliminar el profesional');
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
