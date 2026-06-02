import { UpperCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonTitle,
  IonToolbar,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  briefcaseOutline,
  businessOutline,
  calendarOutline,
  checkmarkCircle,
  closeOutline,
  constructOutline,
  homeOutline,
  logOutOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';

import { AuthService } from '../../core/auth/auth.service';
import { SessionTenant } from '../../core/auth/auth.session';
import { DataSyncService } from '../../core/sync/data-sync.service';
import { OverlayService } from '../../core/ui/overlay.service';
import { MenuService } from '../../services/menu.service';
import { ToastService } from '../../core/ui/toast.service';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    UpperCasePipe,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle,
  ],
  templateUrl: './app-menu.component.html',
  styleUrl: './app-menu.component.scss',
})
export class AppMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly menuCtrl = inject(MenuController);
  private readonly menuService = inject(MenuService);
  private readonly dataSync = inject(DataSyncService);
  private readonly overlay = inject(OverlayService);
  private readonly toast = inject(ToastService);

  readonly userName = () => this.auth.currentUser()?.name ?? '';
  readonly tenantSlug = () => this.auth.currentUser()?.tenantSlug ?? '';
  readonly availableTenants = () =>
    this.auth.currentUser()?.availableTenants ?? [];
  readonly hasMultipleTenants = () => this.availableTenants().length > 1;

  readonly items: MenuItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'home-outline' },
    { label: 'Calendario', path: '/calendar', icon: 'calendar-outline' },
    { label: 'Clientes', path: '/clients', icon: 'people-outline' },
    { label: 'Profesionales', path: '/professionals', icon: 'briefcase-outline' },
    { label: 'Usuarios', path: '/users', icon: 'person-outline' },
    { label: 'Servicios', path: '/services', icon: 'construct-outline' },
  ];

  constructor() {
    addIcons({
      homeOutline,
      calendarOutline,
      peopleOutline,
      briefcaseOutline,
      personOutline,
      constructOutline,
      logOutOutline,
      closeOutline,
      businessOutline,
      checkmarkCircle,
    });

    this.menuService.toggleMenu$.subscribe(() => {
      void this.menuCtrl.toggle();
    });
  }

  get showMenu(): boolean {
    return !this.router.url.includes('/login');
  }

  isActiveTenant(tenant: SessionTenant): boolean {
    return tenant.id === this.tenantSlug();
  }

  capitalizeTenant(id: string): string {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  async switchTenant(tenant: SessionTenant): Promise<void> {
    if (this.isActiveTenant(tenant)) return;

    await this.menuCtrl.close();
    this.overlay.showTenantSwitch();

    try {
      const ok = await this.auth.switchTenant(tenant);
      if (!ok) {
        this.toast.error('Error', 'No se pudo cambiar de negocio.');
        return;
      }

      await this.dataSync.syncAll();

      // Force ionViewWillEnter even if already on /dashboard
      await this.router.navigateByUrl('/', { skipLocationChange: true });
      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.toast.error('Error', 'No se pudo cambiar de negocio.');
    } finally {
      this.overlay.hideTenantSwitch();
    }
  }

  async navigate(path: string): Promise<void> {
    await this.router.navigateByUrl(path);
    await this.menuCtrl.close();
  }

  async logout(): Promise<void> {
    this.auth.logout();
    await this.menuCtrl.close();
    await this.router.navigateByUrl('/login');
  }
}
