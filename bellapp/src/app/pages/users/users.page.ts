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
  checkmarkOutline,
  chevronDownOutline,
  closeOutline,
  createOutline,
  eyeOffOutline,
  eyeOutline,
  peopleOutline,
  personAddOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import { Role, User, UserPayload, UsersService } from '../../services/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-users',
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
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
})
export class UsersPage implements ViewWillEnter {
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly alertCtrl = inject(AlertController);

  readonly list = signal<User[]>([]);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly loadingUser = signal(false);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly roleSearch = signal('');
  readonly roleDropdownOpen = signal(false);

  readonly roles = signal<Role[]>([]);

  readonly form = this.fb.nonNullable.group({
    nombreApellido: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.minLength(6)],
    confirmarPassword: [''],
    rol: ['', Validators.required],
  });

  get filteredRoles(): Role[] {
    const q = this.roleSearch().toLowerCase().trim();
    const all = this.roles();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }

  getRoleLabel(): string {
    const v = this.form.controls.rol.value;
    return v || 'seleccionar roles';
  }

  isRoleSelected(role: Role): boolean {
    return this.form.controls.rol.value === role.name;
  }

  selectRole(role: Role): void {
    this.form.controls.rol.setValue(role.name);
    this.roleDropdownOpen.set(false);
    this.roleSearch.set('');
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  toggleRoleDropdown(): void {
    this.roleDropdownOpen.update((v) => !v);
  }

  closeRoleDropdown(): void {
    this.roleDropdownOpen.set(false);
    this.roleSearch.set('');
  }

  constructor() {
    addIcons({
      personAddOutline,
      peopleOutline,
      createOutline,
      trashOutline,
      eyeOutline,
      eyeOffOutline,
      chevronDownOutline,
      searchOutline,
      addOutline,
      checkmarkOutline,
      closeOutline,
    });
  }

  async ionViewWillEnter(): Promise<void> {
    await Promise.all([
      this.usersService.refreshRoles(),
      this.usersService.refresh(),
    ]);
    this.roles.set([...this.usersService.getRoles()]);
    this.load();
  }

  load(): void {
    this.list.set([...this.usersService.getUsers()]);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.loadingUser.set(false);
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.roleSearch.set('');
    this.roleDropdownOpen.set(false);
    this.form.reset({
      nombreApellido: '',
      correo: '',
      password: '',
      confirmarPassword: '',
      rol: '',
    });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  async openEdit(user: User): Promise<void> {
    this.editingId.set(user.id);
    this.loadingUser.set(true);
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.roleSearch.set('');
    this.roleDropdownOpen.set(false);
    this.modalOpen.set(true);

    const detail = (await this.usersService.fetchUserById(user.id)) ?? user;
    this.form.patchValue({
      nombreApellido: detail.nombreApellido,
      correo: detail.correo,
      password: '',
      confirmarPassword: '',
      rol: detail.rol,
    });
    this.form.controls.password.setValidators([Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.loadingUser.set(false);
  }

  closeModal(): void {
    this.roleDropdownOpen.set(false);
    this.modalOpen.set(false);
  }

  private buildPayload(v: {
    nombreApellido: string;
    correo: string;
    password: string;
    confirmarPassword: string;
    rol: string;
  }): UserPayload | null {
    const role = this.roles().find((r) => r.name === v.rol);
    if (!role) {
      this.toast.error('Selecciona un rol válido');
      return null;
    }

    return {
      name: v.nombreApellido,
      email: v.correo,
      password: v.password,
      password_confirm: v.confirmarPassword,
      roles: [role.id],
    };
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    if (v.password && v.password !== v.confirmarPassword) {
      this.toast.error('Las contraseñas no coinciden');
      return;
    }

    const editId = this.editingId();
    if (!editId && !v.password) {
      this.toast.error('La contraseña es obligatoria');
      return;
    }

    const payload = this.buildPayload(v);
    if (!payload) {
      return;
    }

    try {
      if (editId) {
        await this.usersService.updateUser(editId, payload);
        this.toast.success('Usuario actualizado');
      } else {
        await this.usersService.addUser(payload);
        this.toast.success('Usuario creado');
      }
      this.closeModal();
      this.load();
    } catch {
      this.toast.error(
        editId ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario'
      );
    }
  }

  async confirmDelete(user: User): Promise<void> {
    if (user.id === this.auth.currentUser()?.userId) {
      this.toast.error('No puedes eliminar tu propio usuario');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: `¿Eliminar a ${user.nombreApellido}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              const ok = await this.usersService.deleteUser(user.id);
              if (ok) {
                this.toast.success('Usuario eliminado');
                this.load();
              } else {
                this.toast.error('No se pudo eliminar el usuario');
              }
            } catch {
              this.toast.error('No se pudo eliminar el usuario');
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
