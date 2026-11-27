import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EventBusService } from './core/services/event-bus.service';
import { NavigationEventsService } from './core/services/navigation-events.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor() {
    inject(NavigationEventsService);
    inject(EventBusService).completeBoot(); // AsyncSubject: "application ready" one-shot signal
  }
}
