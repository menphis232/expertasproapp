import { Injectable, inject } from '@angular/core';

import { AgendaService } from '../../services/agenda.service';
import { ClientsService } from '../../services/clients.service';
import { ProfessionalsService } from '../../services/professionals.service';
import { ServicesService } from '../../services/services.service';
import { UsersService } from '../../services/users.service';

@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private readonly agenda = inject(AgendaService);
  private readonly clients = inject(ClientsService);
  private readonly professionals = inject(ProfessionalsService);
  private readonly users = inject(UsersService);
  private readonly services = inject(ServicesService);

  async syncAll(): Promise<void> {
    await Promise.all([
      this.agenda.refresh(),
      this.clients.refresh(),
      this.professionals.refresh(),
      this.users.refresh(),
      this.services.refresh(),
    ]);
  }
}
