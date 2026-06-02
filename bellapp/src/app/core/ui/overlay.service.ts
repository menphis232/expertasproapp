import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OverlayService {
  readonly isSwitchingTenant = signal(false);

  showTenantSwitch(): void {
    this.isSwitchingTenant.set(true);
  }

  hideTenantSwitch(): void {
    this.isSwitchingTenant.set(false);
  }
}
