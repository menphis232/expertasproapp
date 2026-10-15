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
  IonInfiniteScroll,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonModal,
  IonSpinner,
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
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import { ClientFieldsConfigModalComponent } from '../../components/client-fields-config-modal/client-fields-config-modal.component';
import { ClientFieldConfig } from '../../models/client-field-config.model';
import { ClientFieldValue } from '../../models/client-detail.model';
import { Client, ClientsService, ClientWritePayload } from '../../services/clients.service';
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
    IonInfiniteScroll,
    IonModal,
    IonButton,
    IonSpinner,
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
  readonly totalClients = signal(0);
  readonly hasMore = signal(false);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly modalOpen = signal(false);
  readonly configModalOpen = signal(false);
  readonly fieldsLoading = signal(false);
  readonly visibleConfigs = signal<ClientFieldConfig[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly sortDesc = signal(true);
  readonly searchQuery = signal('');

  readonly form = this.fb.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    fechaNacimiento: [''],
    rut: [''],
    referidoPor: [''],
    credenciales: ['no_crear'],
    campos: this.fb.array([]),
    enfermedades: this.fb.array([]),
    medicamentos: this.fb.array([]),
  });

  get enfermedadesArray(): FormArray {
    return this.form.get('enfermedades') as FormArray;
  }

  get medicamentosArray(): FormArray {
    return this.form.get('medicamentos') as FormArray;
  }

  get camposArray(): FormArray {
    return this.form.get('campos') as FormArray;
  }

  campoGroup(index: number): FormGroup {
    return this.camposArray.at(index) as FormGroup;
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
      searchOutline,
    });
  }

  private listLoadId = 0;

  async ionViewWillEnter(): Promise<void> {
    this.clientsService.setClientListSort(this.sortDesc() ? 'desc' : 'asc');
    await this.reloadList();
  }

  load(): void {
    const sorted = [...this.clientsService.getClients()].sort((a, b) => {
      const cmp = `${a.nombres}`.localeCompare(`${b.nombres}`, 'es');
      return this.sortDesc() ? -cmp : cmp;
    });
    this.clients.set(sorted);
    this.totalClients.set(this.clientsService.clientsTotal());
    this.hasMore.set(this.clientsService.hasMoreClients());
    this.applySearch();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.applySearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.applySearch();
  }

  private applySearch(): void {
    const query = this.normalizeSearch(this.searchQuery());
    if (!query) {
      this.filtered.set(this.clients());
      return;
    }

    this.filtered.set(
      this.clients().filter((client) => {
        const fullName = this.normalizeSearch(`${client.nombres} ${client.apellidos}`);
        const rut = this.normalizeSearch(client.rut ?? '');
        return fullName.includes(query) || rut.includes(query);
      })
    );
  }

  private normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  async toggleSort(): Promise<void> {
    this.sortDesc.update((v) => !v);
    this.clientsService.setClientListSort(this.sortDesc() ? 'desc' : 'asc');
    await this.reloadList();
  }

  private async reloadList(): Promise<void> {
    const loadId = ++this.listLoadId;
    this.loadingMore.set(false);
    this.loading.set(true);
    try {
      await this.clientsService.refresh();
    } catch (error) {
      console.error('[ClientsPage] Error cargando clientes', error);
      this.toast.error('No se pudo cargar la lista de clientes');
    }
    if (loadId !== this.listLoadId) {
      return;
    }
    this.load();
    this.loading.set(false);
  }

  async loadMore(event: Event): Promise<void> {
    const scroll = event.target as HTMLIonInfiniteScrollElement;
    if (!this.clientsService.hasMoreClients() || this.loadingMore()) {
      await scroll.complete();
      return;
    }

    this.loadingMore.set(true);
    try {
      await this.clientsService.loadMoreClients();
      this.load();
    } catch (error) {
      console.error('[ClientsPage] Error cargando la página siguiente', error);
      this.toast.error('No se pudieron cargar más clientes');
    } finally {
      this.loadingMore.set(false);
      await scroll.complete();
    }
  }

  openConfig(): void {
    this.configModalOpen.set(true);
  }

  closeConfigModal(): void {
    this.configModalOpen.set(false);
  }

  async openCreate(): Promise<void> {
    this.editingId.set(null);
    this.clearArrays();
    this.form.reset({ nombres: '', apellidos: '', fechaNacimiento: '', rut: '', referidoPor: '', credenciales: 'no_crear' });
    this.modalOpen.set(true);
    await this.loadCustomFields([]);
  }

  async openEdit(client: Client): Promise<void> {
    this.editingId.set(client.id);
    this.clearArrays();

    const detail = await this.clientsService.fetchClientDetail(client.id);
    const enfermedades = detail?.enfermedades ?? client.enfermedades ?? [];
    const medicamentos = detail?.medicamentos ?? client.medicamentos ?? [];

    enfermedades.forEach((e) =>
      this.enfermedadesArray.push(this.fb.group({ descripcion: [e.description, Validators.required], comentario: [e.comment ?? ''] }))
    );
    medicamentos.forEach((m) =>
      this.medicamentosArray.push(this.fb.group({ descripcion: [m.description, Validators.required], comentario: [m.comment ?? ''] }))
    );

    const fecha = detail?.fechaNacimiento ?? client.fechaNacimiento;

    this.form.patchValue({
      nombres: detail?.nombres || client.nombres,
      apellidos: detail?.apellidos || client.apellidos,
      fechaNacimiento: fecha ? fecha.toISOString().split('T')[0] : '',
      rut: detail?.rut ?? client.rut ?? '',
      referidoPor: client.referidoPor ?? '',
      credenciales: client.credenciales ?? 'no_crear',
    });

    this.modalOpen.set(true);
    await this.loadCustomFields(detail?.camposValores ?? []);
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

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const editId = this.editingId();
    const payload = this.buildPayload(v);

    try {
      await this.clientsService.saveClient(editId, payload);
      this.toast.success(editId ? 'Cliente actualizado' : 'Cliente creado');
      this.closeModal();
      await this.reloadList();
    } catch (error) {
      console.error('[ClientsPage] Error guardando cliente', error);
      this.toast.error(editId ? 'No se pudo actualizar el cliente' : 'No se pudo crear el cliente');
    }
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
    while (this.camposArray.length) this.camposArray.removeAt(0);
    this.visibleConfigs.set([]);
  }

  private async loadCustomFields(values: ClientFieldValue[]): Promise<void> {
    this.fieldsLoading.set(true);
    try {
      const configs = await this.clientsService.fetchFieldConfiguration();
      const sorted = [...configs].sort((a, b) => a.position - b.position);
      this.visibleConfigs.set(sorted);
      while (this.camposArray.length) this.camposArray.removeAt(0);
      sorted.forEach((cfg) => this.camposArray.push(this.buildCampoGroup(cfg, values)));
    } catch (error) {
      console.error('[ClientsPage] Error cargando campos del cliente', error);
      this.toast.error('No se pudieron cargar los campos configurados');
    } finally {
      this.fieldsLoading.set(false);
    }
  }

  private buildCampoGroup(cfg: ClientFieldConfig, values: ClientFieldValue[]): FormGroup {
    const tipo = cfg.tipo_dato?.tipo ?? 'string';
    const match = this.matchFieldValue(cfg, values);
    const parsed = this.parseStoredValor(tipo, match?.valor ?? '');
    const group = this.fb.group({
      configId: [cfg.id],
      tipo: [tipo],
      descripcion: [cfg.descripcion],
      valor: [parsed.valor, cfg.requerido && tipo !== 'section' ? Validators.required : []],
      cuales: [parsed.cuales],
    });

    if (tipo === 'yes_no_which' && cfg.requerido) {
      group.setValidators((control) => {
        const valor = control.get('valor')?.value;
        const cuales = String(control.get('cuales')?.value ?? '').trim();
        if (!valor) return { required: true };
        if (valor === 'si' && !cuales) return { cuales: true };
        return null;
      });
    }

    return group;
  }

  private matchFieldValue(cfg: ClientFieldConfig, values: ClientFieldValue[]): ClientFieldValue | undefined {
    const desc = cfg.descripcion.trim().toLowerCase();
    return (
      values.find((v) => v.id === String(cfg.id)) ??
      values.find((v) => v.description.trim().toLowerCase() === desc) ??
      values.find((v) => v.position === cfg.position)
    );
  }

  private parseStoredValor(tipo: string, raw: string | null): { valor: string; cuales: string } {
    const value = (raw ?? '').trim();
    if (tipo !== 'yes_no' && tipo !== 'yes_no_which') {
      return { valor: value, cuales: '' };
    }

    if (!value || /^(no|0|false)$/i.test(value)) {
      return { valor: value ? 'no' : '', cuales: '' };
    }
    if (/^(s[ií]|1|true)$/i.test(value)) {
      return { valor: 'si', cuales: '' };
    }

    const lines = value.split(/\r?\n/);
    if (/^s[ií]$/i.test(lines[0] ?? '') && lines.length > 1) {
      return { valor: 'si', cuales: lines.slice(1).join('\n').trim() };
    }

    const labeled = value.match(/^s[ií]\s*[:\-]\s*(.*)$/i);
    if (labeled) {
      return { valor: 'si', cuales: labeled[1].trim() };
    }

    if (tipo === 'yes_no_which') {
      return { valor: 'si', cuales: value };
    }

    return { valor: 'si', cuales: '' };
  }

  private storedValor(tipo: string, valor: string, cuales: string): string | null {
    if (tipo === 'section') return null;
    if (tipo === 'yes_no') {
      if (valor === 'si') return 'Sí';
      if (valor === 'no') return 'No';
      return null;
    }
    if (tipo === 'yes_no_which') {
      if (valor === 'no') return 'No';
      if (valor === 'si') {
        const extra = cuales.trim();
        return extra ? `Sí\n${extra}` : 'Sí';
      }
      return null;
    }
    const text = (valor ?? '').trim();
    return text || null;
  }

  private buildPayload(v: ReturnType<ClientsPage['form']['getRawValue']>): ClientWritePayload {
    const campos = v.campos as { configId: number | null; tipo: string; descripcion: string; valor: string; cuales: string }[];

    return {
      nombres: v.nombres ?? '',
      apellidos: v.apellidos ?? '',
      fecha_nacimiento: v.fechaNacimiento || null,
      rut: v.rut || null,
      referido_por: v.referidoPor || null,
      credenciales: v.credenciales || null,
      enfermedades: (v.enfermedades as { descripcion: string; comentario: string }[]).map((e) => ({
        description: e.descripcion,
        comment: e.comentario ?? '',
      })),
      medicamentos: (v.medicamentos as { descripcion: string; comentario: string }[]).map((m) => ({
        description: m.descripcion,
        comment: m.comentario ?? '',
      })),
      campos_valores: campos
        .filter((c) => c.tipo !== 'section' && c.configId != null)
        .map((c) => ({
          id: c.configId as number,
          descripcion: c.descripcion,
          valor: this.storedValor(c.tipo, c.valor ?? '', c.cuales ?? ''),
        })),
    };
  }
}
