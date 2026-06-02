import { Component, computed, inject, signal } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowUpOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  pieChartOutline,
} from 'ionicons/icons';

import { AgendaTabsComponent } from '../../components/agenda-tabs/agenda-tabs.component';
import { AgendaEstado, AgendaItem, AgendaService } from '../../services/agenda.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonMenuButton,
    IonIcon,
    IonButton,
    AgendaTabsComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements ViewWillEnter {
  private static readonly PAGE_SIZE = 8;

  private readonly agendaService = inject(AgendaService);
  private readonly router = inject(Router);

  readonly visibleCount = signal(DashboardPage.PAGE_SIZE);

  readonly stats = computed(() => this.agendaService.stats());

  readonly monthTitle = computed(() => {
    const formatted = new Intl.DateTimeFormat('es-CL', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return formatted
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  readonly monthAppointments = computed(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return this.agendaService
      .items()
      .filter((item) => {
        const d = new Date(item.fecha);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .sort(
        (a, b) =>
          new Date(`${b.fecha}T${b.hora}`).getTime() -
          new Date(`${a.fecha}T${a.hora}`).getTime()
      );
  });

  readonly visibleAppointments = computed(() =>
    this.monthAppointments().slice(0, this.visibleCount())
  );

  readonly hasMoreActivities = computed(
    () => this.visibleCount() < this.monthAppointments().length
  );

  constructor() {
    addIcons({
      arrowUpOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      pieChartOutline,
    });
  }

  async ionViewWillEnter(): Promise<void> {
    await this.agendaService.refresh();
    this.visibleCount.set(DashboardPage.PAGE_SIZE);
  }

  onActivityScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const nearBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 24;

    if (nearBottom && this.hasMoreActivities()) {
      this.visibleCount.update(
        (count) => count + DashboardPage.PAGE_SIZE
      );
    }
  }

  openAddAppointment(): void {
    void this.router.navigate(['/calendar'], {
      queryParams: { action: 'new' },
    });
  }

  statusLabel(estado: AgendaEstado): string {
    const map: Record<AgendaEstado, string> = {
      pendiente: 'Pendiente',
      realizado: 'Realizada',
      cancelado: 'Cancelada',
    };
    return map[estado];
  }

  trackById(_: number, item: AgendaItem): number {
    return item.id;
  }
}
