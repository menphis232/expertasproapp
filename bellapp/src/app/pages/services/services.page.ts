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
  addCircleOutline,
  addOutline,
  arrowDownOutline,
  arrowUpOutline,
  checkmarkOutline,
  closeOutline,
  constructOutline,
  createOutline,
  reorderThreeOutline,
  trashOutline,
} from 'ionicons/icons';

import { Service, ServiceField, ServicePayload, ServicesService } from '../../services/services.service';
import { ToastService } from '../../core/ui/toast.service';

const DATA_TYPES: ServiceField['dataType'][] = ['Texto', 'Número', 'Fecha', 'Lista', 'Moneda'];

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [
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
  templateUrl: './services.page.html',
  styleUrl: './services.page.scss',
})
export class ServicesPage implements ViewWillEnter {
  private readonly servicesService = inject(ServicesService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly alertCtrl = inject(AlertController);

  readonly list = signal<Service[]>([]);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly sortDesc = signal(true);
  readonly dataTypes = DATA_TYPES;

  readonly form = this.fb.group({
    description: ['', Validators.required],
    campos: this.fb.array([]),
  });

  get camposArray(): FormArray {
    return this.form.get('campos') as FormArray;
  }

  getCampoGroup(index: number): FormGroup {
    return this.camposArray.at(index) as FormGroup;
  }

  constructor() {
    addIcons({
      addCircleOutline,
      constructOutline,
      arrowDownOutline,
      arrowUpOutline,
      createOutline,
      trashOutline,
      reorderThreeOutline,
      addOutline,
      checkmarkOutline,
      closeOutline,
    });
  }

  async ionViewWillEnter(): Promise<void> {
    await this.servicesService.refresh();
    this.load();
  }

  load(): void {
    const sorted = [...this.servicesService.getServices()].sort((a, b) => {
      const cmp = a.description.localeCompare(b.description);
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
    this.clearCampos();
    this.form.reset({ description: '' });
    this.modalOpen.set(true);
  }

  async openEdit(s: Service): Promise<void> {
    this.editingId.set(s.id);
    this.clearCampos();
    this.modalOpen.set(true);

    const detail = (await this.servicesService.fetchServiceDetail(s.id)) ?? s;
    (detail.fields ?? [])
      .sort((a, b) => a.order - b.order)
      .forEach((f) =>
        this.camposArray.push(
          this.fb.group({
            id: [this.parseFieldId(f.id)],
            descripcion: [f.description],
            requerido: [f.required],
            tipoDato: [f.dataType],
            options: [f.options ?? []],
          })
        )
      );
    this.form.patchValue({ description: detail.description });
  }

  private parseFieldId(id: string): number | null {
    return /^\d+$/.test(id) ? Number(id) : null;
  }

  addCampo(): void {
    this.camposArray.push(
      this.fb.group({
        id: [null as number | null],
        descripcion: [''],
        requerido: [false],
        tipoDato: ['Texto'],
        options: [[] as string[]],
      })
    );
  }

  removeCampo(index: number): void {
    this.camposArray.removeAt(index);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = this.buildPayload(
      v.description ?? '',
      v.campos as {
        id: number | null;
        descripcion: string;
        requerido: boolean;
        tipoDato: string;
        options: string[];
      }[]
    );

    const editId = this.editingId();

    try {
      if (editId) {
        await this.servicesService.updateService(editId, payload);
        this.toast.success('Servicio actualizado');
      } else {
        await this.servicesService.addService(payload);
        this.toast.success('Servicio creado');
      }
      this.closeModal();
      this.load();
    } catch {
      this.toast.error(
        editId ? 'No se pudo actualizar el servicio' : 'No se pudo crear el servicio'
      );
    }
  }

  private buildPayload(
    description: string,
    campos: {
      id: number | null;
      descripcion: string;
      requerido: boolean;
      tipoDato: string;
      options: string[];
    }[]
  ): ServicePayload {
    return {
      descripcion: description,
      config_servicios: campos.map((c, i) => {
        const field: ServicePayload['config_servicios'][number] = {
          descripcion: c.descripcion,
          tipo_dato_id: this.servicesService.mapDataTypeToId(
            c.tipoDato as ServiceField['dataType']
          ),
          requerido: c.requerido,
          options: c.options ?? [],
          position: i + 1,
        };
        if (c.id != null) {
          field.id = c.id;
        }
        return field;
      }),
    };
  }

  async confirmDelete(s: Service): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar servicio',
      message: `¿Eliminar "${s.description}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              const ok = await this.servicesService.deleteService(s.id);
              if (ok) {
                this.toast.success('Servicio eliminado');
                this.load();
              } else {
                this.toast.error('No se pudo eliminar el servicio');
              }
            } catch {
              this.toast.error('No se pudo eliminar el servicio');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private clearCampos(): void {
    while (this.camposArray.length) this.camposArray.removeAt(0);
  }
}
