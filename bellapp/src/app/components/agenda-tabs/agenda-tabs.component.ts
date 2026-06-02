import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, homeOutline } from 'ionicons/icons';

export type AgendaTab = 'dashboard' | 'calendar';

@Component({
  selector: 'app-agenda-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IonIcon],
  templateUrl: './agenda-tabs.component.html',
  styleUrl: './agenda-tabs.component.scss',
})
export class AgendaTabsComponent {
  @Input({ required: true }) active: AgendaTab = 'dashboard';

  constructor() {
    addIcons({ homeOutline, calendarOutline });
  }
}
