import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  calendarOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  closeCircleOutline,
  closeOutline,
  createOutline,
  documentTextOutline,
  personOutline,
  saveOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  AgendaCompleteDetalle,
  AgendaEstado,
  AgendaItem,
  AgendaService,
} from '../../services/agenda.service';
import {
  Appointment,
  AppointmentsService,
} from '../../services/appointments.service';
import { ClientsService } from '../../services/clients.service';
import { ProfessionalsService } from '../../services/professionals.service';
import { Service, ServicesService } from '../../services/services.service';
import { ToastService } from '../../core/ui/toast.service';
import { environment } from '../../../environments/environment';
import { ClientDetail } from '../../models/client-detail.model';
import { CompleteAppointmentField } from '../../models/complete-appointment.model';
import { AgendaTabsComponent } from '../../components/agenda-tabs/agenda-tabs.component';
import { AppointmentDetailModalComponent } from '../../components/appointment-detail-modal/appointment-detail-modal.component';
import { ClientFileModalComponent } from '../../components/client-file-modal/client-file-modal.component';
import { CancelAppointmentModalComponent } from '../../components/cancel-appointment-modal/cancel-appointment-modal.component';
import { CompleteAppointmentModalComponent } from '../../components/complete-appointment-modal/complete-appointment-modal.component';
import { DeleteAppointmentModalComponent } from '../../components/delete-appointment-modal/delete-appointment-modal.component';

export interface CalendarDay {
  day: number;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  appointments: AgendaItem[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButtons,
    IonMenuButton,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    IonButton,
    AgendaTabsComponent,
    AppointmentDetailModalComponent,
    ClientFileModalComponent,
    CompleteAppointmentModalComponent,
    CancelAppointmentModalComponent,
    DeleteAppointmentModalComponent,
  ],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export class CalendarPage implements ViewWillEnter {
  private readonly agendaService = inject(AgendaService);
  private readonly appointmentsService = inject(AppointmentsService);
  readonly clientsService = inject(ClientsService);
  private readonly professionalsService = inject(ProfessionalsService);
  private readonly servicesService = inject(ServicesService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly alertCtrl = inject(AlertController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  readonly viewMonth = signal({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  readonly selectedDate = signal(this.todayIso());
  readonly modalOpen = signal(false);
  readonly optionsModalOpen = signal(false);
  readonly clientFileOpen = signal(false);
  readonly clientFileId = signal<string | null>(null);
  readonly clientFileDetail = signal<ClientDetail | null>(null);
  readonly clientFileLoading = signal(false);
  readonly appointmentDetailOpen = signal(false);
  readonly appointmentDetail = signal<AgendaItem | null>(null);
  readonly completeModalOpen = signal(false);
  readonly completeLoading = signal(false);
  readonly completeSubmitting = signal(false);
  readonly completeClientName = signal('');
  readonly completeServiceName = signal('');
  readonly completeFields = signal<CompleteAppointmentField[]>([]);
  readonly deleteConfirmOpen = signal(false);
  readonly deleteConfirmClient = signal('');
  readonly deleteConfirmLoading = signal(false);
  readonly cancelConfirmOpen = signal(false);
  readonly cancelConfirmClient = signal('');
  readonly cancelConfirmLoading = signal(false);
  private deleteConfirmAppointment: AgendaItem | null = null;
  private cancelConfirmAppointment: AgendaItem | null = null;
  private completeAppointmentId: number | null = null;
  private pendingClientFileId: string | null = null;
  private pendingAppointmentDetail: AgendaItem | null = null;
  private pendingEditAppointment: AgendaItem | null = null;
  private pendingCompleteAppointment: AgendaItem | null = null;
  private pendingDeleteAppointment: AgendaItem | null = null;
  private pendingCancelAppointment: AgendaItem | null = null;
  readonly selectedAppointment = signal<AgendaItem | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly selectedServiceIds = signal<string[]>([]);
  readonly serviceDropdownOpen = signal(false);
  readonly serviceSearch = signal('');

  readonly clientDropdownOpen = signal(false);
  readonly clientSearch = signal('');

  readonly professionalDropdownOpen = signal(false);
  readonly professionalSearch = signal('');

  readonly optionsModalTitle = computed(() => {
    const apt = this.selectedAppointment();
    if (!apt) return 'Opciones de cita';
    return `Opciones de cita - ${apt.clienteNombre} | ${this.formatDisplayDate(apt.fecha)}`;
  });

  readonly monthTitle = computed(() => {
    const { year, month } = this.viewMonth();
    const label = new Intl.DateTimeFormat('es-CL', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly appointmentsByDate = computed(() => {
    const map = new Map<string, AgendaItem[]>();

    for (const item of this.agendaService.items()) {
      const key = item.fecha;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.hora.localeCompare(b.hora));
    }

    return map;
  });

  readonly calendarWeeks = computed(() => {
    const { year, month } = this.viewMonth();
    const selected = this.selectedDate();
    const today = this.todayIso();
    const byDate = this.appointmentsByDate();

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const weeks: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, month - 1, day);
      const iso = this.toIso(date);
      currentWeek.push(this.buildDay(day, iso, false, today, selected, byDate));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = this.toIso(new Date(year, month, day));
      currentWeek.push(this.buildDay(day, iso, true, today, selected, byDate));

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        const date = new Date(year, month + 1, nextDay);
        const iso = this.toIso(date);
        currentWeek.push(
          this.buildDay(nextDay, iso, false, today, selected, byDate)
        );
        nextDay++;
      }
      weeks.push(currentWeek);
    }

    return weeks;
  });

  readonly selectedDayAppointments = computed(() => {
    return this.appointmentsByDate().get(this.selectedDate()) ?? [];
  });

  readonly selectedDayLabel = computed(() => {
    const [y, m, d] = this.selectedDate().split('-').map(Number);
    const label = new Intl.DateTimeFormat('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(y, m - 1, d));
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly form = this.fb.nonNullable.group({
    patientName: [''],
    clientId: ['', Validators.required],
    professionalId: [''],
    time: ['', Validators.required],
    dateStr: [this.todayIso(), Validators.required],
    status: ['pending' as Appointment['status'], Validators.required],
    comment: [''],
  });

  constructor() {
    addIcons({
      addOutline,
      calendarOutline,
      checkmarkCircleOutline,
      checkmarkOutline,
      chevronBackOutline,
      chevronDownOutline,
      chevronForwardOutline,
      closeCircleOutline,
      closeOutline,
      createOutline,
      documentTextOutline,
      personOutline,
      saveOutline,
      searchOutline,
      trashOutline,
    });
  }

  get filteredServices(): Service[] {
    const q = this.serviceSearch().toLowerCase().trim();
    const all = this.servicesService.getServices();
    return q ? all.filter((s) => s.description.toLowerCase().includes(q)) : all;
  }

  get filteredClients() {
    const q = this.clientSearch().toLowerCase().trim();
    const all = this.clientsService.getClients();
    return q
      ? all.filter((c) =>
          `${c.nombres} ${c.apellidos}`.toLowerCase().includes(q)
        )
      : all;
  }

  get filteredProfessionals() {
    const q = this.professionalSearch().toLowerCase().trim();
    const all = this.professionalsService.getProfessionals();
    return q
      ? all.filter((p) => p.nombreApellido.toLowerCase().includes(q))
      : all;
  }

  toggleServiceDropdown(): void {
    this.serviceDropdownOpen.update((v) => !v);
    if (this.serviceDropdownOpen()) {
      this.clientDropdownOpen.set(false);
      this.professionalDropdownOpen.set(false);
    }
  }

  toggleService(id: string): void {
    this.selectedServiceIds.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  }

  isServiceSelected(id: string): boolean {
    return this.selectedServiceIds().includes(id);
  }

  getServicesLabel(): string {
    const ids = this.selectedServiceIds();
    if (ids.length === 0) return 'Seleccionar uno o más servicios';
    const services = this.servicesService.getServices();
    return ids
      .map((id) => services.find((s) => s.id === id)?.description ?? '')
      .filter(Boolean)
      .join(', ');
  }

  toggleClientDropdown(): void {
    this.clientDropdownOpen.update((v) => !v);
    if (this.clientDropdownOpen()) {
      this.serviceDropdownOpen.set(false);
      this.professionalDropdownOpen.set(false);
    }
  }

  selectClient(id: string): void {
    this.form.patchValue({ clientId: id });
    const client = this.clientsService.getClientById(id);
    if (client) {
      this.form.patchValue({
        patientName: `${client.nombres} ${client.apellidos}`.trim(),
      });
    }
    this.clientDropdownOpen.set(false);
    this.clientSearch.set('');
  }

  getClientLabel(): string {
    const clientId = this.form.controls.clientId.value;
    if (clientId) {
      const client = this.clientsService.getClientById(clientId);
      if (client) {
        return `${client.nombres} ${client.apellidos}`;
      }
    }
    const patientName = this.form.controls.patientName.value?.trim();
    return patientName || 'Seleccionar';
  }

  toggleProfessionalDropdown(): void {
    this.professionalDropdownOpen.update((v) => !v);
    if (this.professionalDropdownOpen()) {
      this.serviceDropdownOpen.set(false);
      this.clientDropdownOpen.set(false);
    }
  }

  selectProfessional(id: string): void {
    this.form.patchValue({ professionalId: id });
    this.professionalDropdownOpen.set(false);
    this.professionalSearch.set('');
  }

  clearProfessional(): void {
    this.form.patchValue({ professionalId: '' });
    this.professionalDropdownOpen.set(false);
    this.professionalSearch.set('');
  }

  getProfessionalLabel(): string {
    const profId = this.form.controls.professionalId.value;
    if (!profId) return 'Seleccionar profesional';
    const prof = this.professionalsService.getProfessionalById(profId);
    return prof ? prof.nombreApellido : 'Seleccionar profesional';
  }

  closeAllDropdowns(): void {
    this.serviceDropdownOpen.set(false);
    this.clientDropdownOpen.set(false);
    this.professionalDropdownOpen.set(false);
  }

  async ionViewWillEnter(): Promise<void> {
    await Promise.all([
      this.loadAgendaForView(),
      this.clientsService.refresh(),
      this.professionalsService.refresh(),
      this.servicesService.refresh(),
    ]);

    if (this.route.snapshot.queryParamMap.get('action') === 'new') {
      this.openCreate();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { action: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  async goToday(): Promise<void> {
    const now = new Date();
    this.viewMonth.set({ year: now.getFullYear(), month: now.getMonth() });
    this.selectedDate.set(this.todayIso());
    await this.loadAgendaForView();
  }

  async prevMonth(): Promise<void> {
    const { year, month } = this.viewMonth();
    const date = new Date(year, month - 1, 1);
    this.viewMonth.set({ year: date.getFullYear(), month: date.getMonth() });
    await this.loadAgendaForView();
  }

  async nextMonth(): Promise<void> {
    const { year, month } = this.viewMonth();
    const date = new Date(year, month + 1, 1);
    this.viewMonth.set({ year: date.getFullYear(), month: date.getMonth() });
    await this.loadAgendaForView();
  }

  selectDay(iso: string): void {
    this.selectedDate.set(iso);
  }

  openCreate(dateIso?: string): void {
    this.editingId.set(null);
    this.selectedServiceIds.set([]);
    this.serviceSearch.set('');
    this.clientSearch.set('');
    this.professionalSearch.set('');
    this.closeAllDropdowns();
    this.form.reset({
      patientName: '',
      clientId: '',
      professionalId: '',
      time: '',
      dateStr: dateIso ?? this.selectedDate(),
      status: 'pending',
      comment: '',
    });
    this.modalOpen.set(true);
  }

  openEdit(apt: AgendaItem): void {
    this.editingId.set(String(apt.id));
    const allServices = this.servicesService.getServices();
    const existingService = allServices.find(
      (s) =>
        (apt.servicioId != null && s.id === String(apt.servicioId)) ||
        s.description === apt.servicio
    );
    this.selectedServiceIds.set(existingService ? [existingService.id] : []);
    this.serviceSearch.set('');
    this.clientSearch.set('');
    this.professionalSearch.set('');
    this.closeAllDropdowns();

    const professional = this.professionalsService
      .getProfessionals()
      .find(
        (p) =>
          (apt.profesionalId != null && p.id === String(apt.profesionalId)) ||
          p.nombreApellido === apt.profesionalNombre
      );

    const client = this.clientsService.findClientForAppointment(
      apt.clienteId,
      apt.clienteNombre
    );

    this.form.patchValue({
      patientName: apt.clienteNombre,
      clientId: client?.id ?? (apt.clienteId != null ? String(apt.clienteId) : ''),
      professionalId: professional?.id ?? '',
      time: apt.hora,
      dateStr: apt.fecha,
      status: this.estadoToFormStatus(apt.estado),
      comment: '',
    });
    this.modalOpen.set(true);
  }

  openOptions(apt: AgendaItem): void {
    this.selectedAppointment.set(apt);
    this.optionsModalOpen.set(true);
  }

  closeOptionsModal(): void {
    this.optionsModalOpen.set(false);
  }

  onOptionsModalDismiss(): void {
    const pendingId = this.pendingClientFileId;
    this.pendingClientFileId = null;
    const pendingDetail = this.pendingAppointmentDetail;
    this.pendingAppointmentDetail = null;
    const pendingEdit = this.pendingEditAppointment;
    this.pendingEditAppointment = null;
    const pendingComplete = this.pendingCompleteAppointment;
    this.pendingCompleteAppointment = null;
    const pendingDelete = this.pendingDeleteAppointment;
    this.pendingDeleteAppointment = null;
    const pendingCancel = this.pendingCancelAppointment;
    this.pendingCancelAppointment = null;
    this.selectedAppointment.set(null);

    if (pendingId) {
      this.clientFileId.set(pendingId);
      this.clientFileOpen.set(true);
      void this.loadClientFile(pendingId);
    } else if (pendingDetail) {
      this.appointmentDetail.set(pendingDetail);
      this.appointmentDetailOpen.set(true);
    } else if (pendingEdit) {
      this.openEdit(pendingEdit);
    } else if (pendingComplete) {
      void this.openCompleteModal(pendingComplete);
    } else if (pendingDelete) {
      this.openDeleteConfirm(pendingDelete);
    } else if (pendingCancel) {
      this.openCancelConfirm(pendingCancel);
    }
  }

  private async loadClientFile(id: string): Promise<void> {
    this.clientFileLoading.set(true);
    this.clientFileDetail.set(null);
    try {
      const data = await this.clientsService.fetchClientDetail(id);
      this.clientFileDetail.set(data);
      if (!data) {
        this.toast.error('No se pudo cargar la ficha del paciente');
      }
    } catch {
      this.clientFileDetail.set(null);
      this.toast.error('No se pudo cargar la ficha del paciente');
    } finally {
      this.clientFileLoading.set(false);
    }
  }

  openEditFromOptions(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;

    this.pendingEditAppointment = apt;
    this.optionsModalOpen.set(false);
  }

  goToClientFile(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;

    const client = this.clientsService.findClientForAppointment(
      apt.clienteId,
      apt.clienteNombre
    );
    const clientId =
      client?.id ??
      (apt.clienteId != null ? String(apt.clienteId) : null);

    if (!clientId) {
      this.toast.error('No se encontró el cliente');
      return;
    }

    this.pendingClientFileId = clientId;
    this.optionsModalOpen.set(false);
  }

  closeClientFile(): void {
    this.clientFileOpen.set(false);
    this.clientFileId.set(null);
    this.clientFileDetail.set(null);
    this.clientFileLoading.set(false);
  }

  onClientFileEdit(clientId: string): void {
    this.closeClientFile();
    void this.router.navigate(['/clients']);
  }

  showAppointmentDetails(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;

    this.pendingAppointmentDetail = apt;
    this.optionsModalOpen.set(false);
  }

  closeAppointmentDetail(): void {
    this.appointmentDetailOpen.set(false);
    this.appointmentDetail.set(null);
  }

  completeAppointment(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;

    this.pendingCompleteAppointment = apt;
    this.optionsModalOpen.set(false);
  }

  private async openCompleteModal(apt: AgendaItem): Promise<void> {
    this.completeAppointmentId = apt.id;
    this.completeClientName.set(apt.clienteNombre);
    this.completeServiceName.set(apt.servicio);
    this.completeFields.set([]);
    this.completeLoading.set(true);
    this.completeModalOpen.set(true);

    try {
      const servicioId = this.resolveServicioId(apt);
      if (!servicioId) {
        this.toast.error('No se encontró el servicio de la cita');
        this.closeCompleteModal();
        return;
      }

      const service = await this.servicesService.fetchServiceDetail(
        String(servicioId)
      );
      if (!service || service.fields.length === 0) {
        this.toast.error('No se pudieron cargar los detalles del servicio');
        this.closeCompleteModal();
        return;
      }

      this.completeServiceName.set(service.description);
      this.completeFields.set(
        [...service.fields]
          .sort((a, b) => a.order - b.order)
          .map((field) => ({
            configServicioId: Number(field.id),
            description: field.description,
            required: field.required,
            valor: '',
            comentario: '',
          }))
      );
    } catch {
      this.toast.error('No se pudieron cargar los detalles del servicio');
      this.closeCompleteModal();
    } finally {
      this.completeLoading.set(false);
    }
  }

  closeCompleteModal(): void {
    this.completeModalOpen.set(false);
    this.completeLoading.set(false);
    this.completeSubmitting.set(false);
    this.completeClientName.set('');
    this.completeServiceName.set('');
    this.completeFields.set([]);
    this.completeAppointmentId = null;
  }

  async onCompleteConfirmed(detalles: AgendaCompleteDetalle[]): Promise<void> {
    const agendaId = this.completeAppointmentId;
    if (agendaId == null) return;

    this.completeSubmitting.set(true);
    try {
      if (this.agendaService.canUseApi()) {
        await this.agendaService.complete(agendaId, detalles);
      } else {
        await this.appointmentsService.updateAppointment(String(agendaId), {
          status: 'completed',
        });
      }
      this.toast.success('Cita completada');
      this.closeCompleteModal();
      await this.loadAgendaForView();
    } catch (error) {
      this.toast.apiError(error, 'No se pudo completar la cita');
    } finally {
      this.completeSubmitting.set(false);
    }
  }

  private resolveServicioId(apt: AgendaItem): number | undefined {
    if (apt.servicioId != null) return apt.servicioId;

    const byName = this.servicesService
      .getServices()
      .find((s) => s.description === apt.servicio);
    return byName ? Number(byName.id) : undefined;
  }

  cancelAppointment(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;

    this.pendingCancelAppointment = apt;
    this.optionsModalOpen.set(false);
  }

  openCancelConfirm(apt: AgendaItem): void {
    this.cancelConfirmAppointment = apt;
    this.cancelConfirmClient.set(apt.clienteNombre);
    this.cancelConfirmOpen.set(true);
  }

  closeCancelConfirm(): void {
    this.cancelConfirmOpen.set(false);
    this.cancelConfirmClient.set('');
    this.cancelConfirmLoading.set(false);
    this.cancelConfirmAppointment = null;
  }

  async onCancelConfirmed(): Promise<void> {
    const apt = this.cancelConfirmAppointment;
    if (!apt) return;

    this.cancelConfirmLoading.set(true);
    try {
      if (this.agendaService.canUseApi()) {
        await this.agendaService.cancel(apt.id);
      } else {
        await this.appointmentsService.updateAppointment(String(apt.id), {
          status: 'cancelled',
        });
      }
      this.toast.success('Cita cancelada');
      this.closeCancelConfirm();
      await this.loadAgendaForView();
    } catch (error) {
      this.toast.apiError(error, 'No se pudo cancelar la cita');
    } finally {
      this.cancelConfirmLoading.set(false);
    }
  }

  deleteFromOptions(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;

    this.pendingDeleteAppointment = apt;
    this.optionsModalOpen.set(false);
  }

  openDeleteConfirm(apt: AgendaItem): void {
    this.deleteConfirmAppointment = apt;
    this.deleteConfirmClient.set(apt.clienteNombre);
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    this.deleteConfirmOpen.set(false);
    this.deleteConfirmClient.set('');
    this.deleteConfirmLoading.set(false);
    this.deleteConfirmAppointment = null;
  }

  async onDeleteConfirmed(): Promise<void> {
    const apt = this.deleteConfirmAppointment;
    if (!apt) return;

    this.deleteConfirmLoading.set(true);
    try {
      if (environment.apiEnabled) {
        // DELETE /v1/agenda/{id}
        await this.agendaService.delete(apt.id);
      } else {
        await this.appointmentsService.deleteAppointment(String(apt.id));
      }
      this.toast.success('Cita eliminada');
      this.closeDeleteConfirm();
      await this.loadAgendaForView();
    } catch (error) {
      this.toast.apiError(error, 'No se pudo eliminar la cita');
    } finally {
      this.deleteConfirmLoading.set(false);
    }
  }

  formatDisplayDate(iso?: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  closeModal(): void {
    this.closeAllDropdowns();
    this.editingId.set(null);
    this.modalOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const services = this.selectedServiceIds();
    if (services.length === 0) {
      this.toast.error('Selecciona al menos un servicio');
      return;
    }

    const v = this.form.getRawValue();
    const editId = this.editingId();

    try {
      if (this.agendaService.canUseApi()) {
        const clienteId = Number(v.clientId);
        if (!clienteId) {
          this.toast.error('Selecciona un cliente válido');
          return;
        }

        const serviciosId = services
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id));

        if (serviciosId.length === 0) {
          this.toast.error('Selecciona al menos un servicio válido');
          return;
        }

        const payloadBase = {
          clienteId,
          serviciosId,
          profesionalId: v.professionalId
            ? Number(v.professionalId)
            : undefined,
          fecha: v.dateStr,
          hora: v.time,
          comentario: v.comment || undefined,
        };

        if (editId) {
          await this.agendaService.update(Number(editId), payloadBase);
          this.toast.success('Cita actualizada');
        } else {
          await this.agendaService.create(payloadBase);
          this.toast.success('Cita creada');
        }
      } else {
        const professional = this.professionalsService.getProfessionalById(
          v.professionalId
        );
        const allServices = this.servicesService.getServices();
        const serviceDescriptions = services
          .map((id) => allServices.find((s) => s.id === id)?.description ?? '')
          .filter(Boolean);

        if (editId) {
          const payload = {
            patientName: v.patientName || this.getClientLabel(),
            clientId: v.clientId || undefined,
            service: serviceDescriptions[0],
            professionalId: v.professionalId || undefined,
            professionalName: professional?.nombreApellido,
            time: v.time,
            date: new Date(`${v.dateStr}T${v.time}:00`),
            status: v.status,
            comment: v.comment,
          };
          await this.appointmentsService.updateAppointment(editId, payload);
          this.toast.success('Cita actualizada');
        } else {
          for (const serviceDesc of serviceDescriptions) {
            const payload = {
              patientName: v.patientName || this.getClientLabel(),
              clientId: v.clientId || undefined,
              service: serviceDesc,
              professionalId: v.professionalId || undefined,
              professionalName: professional?.nombreApellido,
              time: v.time,
              date: new Date(`${v.dateStr}T${v.time}:00`),
              status: v.status,
              comment: v.comment,
            };
            await this.appointmentsService.addAppointment(payload);
          }
          const msg =
            serviceDescriptions.length > 1
              ? `${serviceDescriptions.length} citas creadas`
              : 'Cita creada';
          this.toast.success(msg);
        }
      }

      this.closeModal();
      await this.loadAgendaForView();
    } catch (error) {
      this.toast.apiError(
        error,
        editId ? 'No se pudo actualizar la cita' : 'No se pudo crear la cita'
      );
    }
  }

  statusLabel(status: AgendaEstado): string {
    const map: Record<AgendaEstado, string> = {
      pendiente: 'Pendiente',
      realizado: 'Realizada',
      cancelado: 'Cancelada',
    };
    return map[status];
  }

  private async loadAgendaForView(): Promise<void> {
    const { year, month } = this.viewMonth();
    await this.agendaService.refresh(month + 1, year);
  }

  private buildDay(
    day: number,
    iso: string,
    inMonth: boolean,
    today: string,
    selected: string,
    byDate: Map<string, AgendaItem[]>
  ): CalendarDay {
    return {
      day,
      iso,
      inMonth,
      isToday: iso === today,
      isSelected: iso === selected,
      appointments: byDate.get(iso) ?? [],
    };
  }

  private todayIso(): string {
    return this.toIso(new Date());
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private estadoToFormStatus(
    estado: AgendaEstado
  ): Appointment['status'] {
    if (estado === 'realizado') return 'completed';
    if (estado === 'cancelado') return 'cancelled';
    return 'pending';
  }

  private formStatusToEstado(status: Appointment['status']): AgendaEstado {
    if (status === 'completed') return 'realizado';
    if (status === 'cancelled') return 'cancelado';
    return 'pendiente';
  }

  private buildAgendaFecha(dateStr: string, time: string): string {
    const normalizedTime =
      time.length === 5 && time.includes(':') ? `${time}:00` : time;
    return `${dateStr} ${normalizedTime}`;
  }
}
