import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

import { extractApiErrorMessage } from '../api/api-normalizers';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private readonly messages: MessageService) {}

  success(summary: string, detail?: string): void {
    this.messages.add({ severity: 'success', summary, detail, life: 3000 });
  }

  error(summary: string, detail?: string): void {
    this.messages.add({ severity: 'error', summary, detail, life: 5000 });
  }

  apiError(error: unknown, fallback: string): void {
    this.error(extractApiErrorMessage(error, fallback));
  }

  info(summary: string, detail?: string): void {
    this.messages.add({ severity: 'info', summary, detail, life: 3000 });
  }
}
