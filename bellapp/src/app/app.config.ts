import { ApplicationConfig } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { tenantApiInterceptor } from './core/http/tenant-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([tenantApiInterceptor])),
    provideAnimations(),
    provideIonicAngular({
      mode: 'ios',
      rippleEffect: true,
    }),
    MessageService,
  ],
};
