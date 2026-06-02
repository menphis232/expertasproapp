import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/calendar/calendar.page').then((m) => m.CalendarPage),
  },
  {
    path: 'clients',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/clients/clients.page').then((m) => m.ClientsPage),
  },
  {
    path: 'professionals',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/professionals/professionals.page').then(
        (m) => m.ProfessionalsPage
      ),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/users/users.page').then((m) => m.UsersPage),
  },
  {
    path: 'services',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/services/services.page').then((m) => m.ServicesPage),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
