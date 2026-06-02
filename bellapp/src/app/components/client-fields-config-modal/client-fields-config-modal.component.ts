import {
  ChangeDetectorRef,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent,
  IonFooter,
  IonIcon,
  IonModal,
  IonReorder,
  IonReorderGroup,
  IonSpinner,
  ItemReorderEventDetail,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  checkmarkOutline,
  chevronDownOutline,
  closeOutline,
  reorderThreeOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  ClientFieldConfig,
  ClientFieldConfigSaveItem,
  COLUMN_OPTIONS,
  FIELD_ROLE_OPTIONS,
  FieldRoleKey,
  TIPO_DATOS,
} from '../../models/client-field-config.model';
import { ClientsService } from '../../services/clients.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-client-fields-config-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonModal,
    IonContent,
    IonFooter,
    IonIcon,
    IonSpinner,
    IonReorderGroup,
    IonReorder,
  ],
  templateUrl: './client-fields-config-modal.component.html',
  styleUrl: './client-fields-config-modal.component.scss',
})
export class ClientFieldsConfigModalComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isOpen = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly fieldCount = signal(0);

  readonly tipoDatos = TIPO_DATOS;
  readonly columnOptions = COLUMN_OPTIONS;
  readonly roleOptions = FIELD_ROLE_OPTIONS;

  readonly form = this.fb.group({
    fields: this.fb.array<FormGroup>([]),
  });

  get fieldsArray(): FormArray<FormGroup> {
    return this.form.get('fields') as FormArray<FormGroup>;
  }

  constructor() {
    addIcons({
      reorderThreeOutline,
      chevronDownOutline,
      addOutline,
      trashOutline,
      checkmarkOutline,
      closeOutline,
    });
  }

  getFieldGroup(index: number): FormGroup {
    return this.fieldsArray.at(index);
  }

  trackField(index: number): number {
    return index;
  }

  onModalPresent(): void {
    void this.loadFields();
  }

  private async loadFields(): Promise<void> {
    this.loading.set(true);
    this.clearFields();

    try {
      const remote = await this.clientsService.fetchFieldConfiguration();
      remote
        .sort((a, b) => a.position - b.position)
        .forEach((field) => this.fieldsArray.push(this.buildFieldGroup(field)));

      this.fieldCount.set(this.fieldsArray.length);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('[ClientFieldsConfigModal] Error cargando campos', error);
      this.toast.error('No se pudo cargar la configuración de campos');
    } finally {
      this.loading.set(false);
      this.cdr.detectChanges();
    }
  }

  private buildFieldGroup(field: ClientFieldConfig): FormGroup {
    return this.fb.group({
      id: [field.id],
      descripcion: [field.descripcion, Validators.required],
      tipo_dato_id: [field.tipo_dato_id, Validators.required],
      requerido: [field.requerido],
      show_column: [field.show_column ?? 0],
      roleKey: [this.resolveRoleKey(field.roles)],
      optionsText: [field.options.join('\n')],
    });
  }

  private resolveRoleKey(roles: ClientFieldConfig['roles']): FieldRoleKey {
    if (!roles.length) return 'todos';

    const names = roles
      .map((r) => r.name?.toLowerCase() ?? '')
      .filter(Boolean);

    if (names.some((n) => n.includes('admin'))) return 'admin';
    if (names.some((n) => n.includes('cliente') || n.includes('usuario'))) {
      return 'usuario';
    }

    const ids = roles.map((r) => r.id).sort();
    if (ids.includes(1)) return 'admin';
    if (ids.includes(2)) return 'usuario';
    return 'todos';
  }

  addField(): void {
    this.fieldsArray.push(
      this.buildFieldGroup({
        id: null,
        tipo_dato_id: 1,
        descripcion: '',
        requerido: false,
        show_column: 0,
        position: this.fieldsArray.length + 1,
        options: [],
        roles: [],
      })
    );
    this.fieldCount.set(this.fieldsArray.length);
  }

  removeField(index: number): void {
    this.fieldsArray.removeAt(index);
    this.fieldCount.set(this.fieldsArray.length);
  }

  onReorderEnd(ev: Event): void {
    const { from, to, complete } = (ev as CustomEvent<ItemReorderEventDetail>).detail;
    const control = this.fieldsArray.at(from);
    this.fieldsArray.removeAt(from);
    this.fieldsArray.insert(to, control);
    complete();
    this.fieldCount.set(this.fieldsArray.length);
  }

  dismiss(): void {
    this.closed.emit();
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Complete la descripción de todos los campos');
      return;
    }

    const payload = this.buildPayload();
    this.saving.set(true);

    try {
      await this.clientsService.saveFieldConfiguration(payload);
      this.toast.success('Configuración guardada');
      this.saved.emit();
      this.closed.emit();
    } catch (error) {
      console.error('[ClientFieldsConfigModal] Error guardando campos', error);
      this.toast.error('No se pudo guardar la configuración');
    } finally {
      this.saving.set(false);
    }
  }

  private buildPayload(): ClientFieldConfigSaveItem[] {
    const raw = this.fieldsArray.getRawValue() as {
      id: number | null;
      descripcion: string;
      tipo_dato_id: number;
      requerido: boolean;
      show_column: number;
      roleKey: FieldRoleKey;
      optionsText: string;
    }[];

    return raw.map((field, index) => {
      const roleOption = FIELD_ROLE_OPTIONS.find((r) => r.value === field.roleKey);
      const options = field.optionsText
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);

      return {
        id: field.id,
        tipo_dato_id: Number(field.tipo_dato_id),
        descripcion: field.descripcion.trim(),
        requerido: !!field.requerido,
        position: index + 1,
        options,
        show_column: Number(field.show_column) !== 0,
        roles: roleOption?.roleNames ?? [],
      };
    });
  }

  showOptionsFor(index: number): boolean {
    const tipoId = Number(this.getFieldGroup(index).get('tipo_dato_id')?.value);
    return tipoId === 6 || tipoId === 10;
  }

  private clearFields(): void {
    while (this.fieldsArray.length) {
      this.fieldsArray.removeAt(0);
    }
    this.fieldCount.set(0);
  }
}
