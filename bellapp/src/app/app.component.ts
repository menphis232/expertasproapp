import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/angular/standalone';
import { ToastModule } from 'primeng/toast';

import { AppMenuComponent } from './components/app-menu/app-menu.component';
import { OverlayService } from './core/ui/overlay.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, IonSpinner, AppMenuComponent, ToastModule],
  template: `
    <ion-app>
      <app-menu />
      <ion-router-outlet id="main-content"></ion-router-outlet>
      <p-toast position="top-center" [baseZIndex]="999999" />

      @if (overlay.isSwitchingTenant()) {
        <div class="tenant-switch-overlay">
          <div class="tso-card">
            <div class="tso-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <ion-spinner name="crescent" class="tso-spinner"></ion-spinner>
            <h2 class="tso-title">Cambiando de Negocio</h2>
            <p class="tso-subtitle">Preparando tu nueva sesión...</p>
          </div>
        </div>
      }
    </ion-app>
  `,
  styles: [`
    .tenant-switch-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: tso-fade-in 0.2s ease;
    }

    @keyframes tso-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .tso-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2.5rem 2rem;
      text-align: center;
    }

    .tso-icon-wrap {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, #6d28d9 0%, #9333ea 100%);
      box-shadow: 0 8px 24px rgba(109, 40, 217, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.25rem;

      svg {
        width: 36px;
        height: 36px;
        color: #fff;
        stroke: #fff;
      }
    }

    .tso-spinner {
      width: 40px;
      height: 40px;
      color: #7c3aed;
    }

    .tso-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: 0.01em;
    }

    .tso-subtitle {
      margin: 0;
      font-size: 0.9rem;
      color: #94a3b8;
      font-weight: 400;
    }
  `],
})
export class AppComponent {
  readonly overlay = inject(OverlayService);
}
