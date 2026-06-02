import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  businessOutline,
  calendarOutline,
  chevronForwardOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';

import { AuthService, TenantOption } from '../../core/auth/auth.service';
import { DataSyncService } from '../../core/sync/data-sync.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly dataSync = inject(DataSyncService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly showPassword = signal(false);

  /** Tenant selector state */
  readonly showTenantSelector = signal(false);
  readonly tenantOptions = signal<TenantOption[]>([]);
  private pendingEmail = '';
  private pendingTenantDomain = '';
  private pendingAccessToken = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    addIcons({
      calendarOutline,
      mailOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      businessOutline,
      arrowBackOutline,
      chevronForwardOutline,
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  capitalizeTenant(id: string): string {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  backToLogin(): void {
    this.showTenantSelector.set(false);
    this.tenantOptions.set([]);
    this.pendingEmail = '';
    this.pendingTenantDomain = '';
    this.pendingAccessToken = '';
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { email, password } = this.form.getRawValue();

    const result = await this.auth.login(email, password);
    this.loading.set(false);

    if (!result.ok) {
      this.toast.error(
        'Credenciales inválidas',
        'Revisa tu correo y contraseña.'
      );
      return;
    }

    if (result.requiresTenantSelection && result.tenants?.length) {
      this.pendingEmail = result.pendingEmail ?? email;
      this.pendingTenantDomain = result.pendingTenantDomain ?? '';
      this.pendingAccessToken = result.pendingAccessToken ?? '';
      this.tenantOptions.set(result.tenants);
      this.showTenantSelector.set(true);
      return;
    }

    await this.afterLogin(result.apiMode === 'remote');
  }

  async pickTenant(option: TenantOption): Promise<void> {
    this.loading.set(true);
    const result = await this.auth.selectTenant(
      option.id,
      this.pendingEmail,
      this.pendingTenantDomain,
      this.pendingAccessToken,
      this.tenantOptions()
    );
    this.loading.set(false);

    if (!result.ok) {
      this.toast.error('Error al conectar', 'No se pudo acceder al tenant seleccionado.');
      return;
    }

    await this.afterLogin(true);
  }

  private async afterLogin(isRemote: boolean): Promise<void> {
    await this.dataSync.syncAll();
    if (isRemote) {
      this.toast.success('Bienvenido', 'Sesión conectada al servidor');
    } else {
      this.toast.success('Bienvenido');
    }
    await this.router.navigateByUrl('/dashboard');
  }
}
