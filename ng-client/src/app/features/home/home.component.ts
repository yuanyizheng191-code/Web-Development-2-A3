/**
 * features/home/home.component.ts
 * The Home page.
 *
 * Everything on this page is loaded from the REST API:
 *   GET /api/events?status=upcoming&sort=date   -> the featured events
 *   GET /api/organisations                      -> the charity partners
 * The statistics strip is computed from the events that were returned, so no
 * extra endpoint is needed.
 *
 */
import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EventService } from '../../core/services/event.service';
import { EventCardComponent } from '../event-card/event-card.component';
import { formatCurrencyWhole, formatDate } from '../../core/utils/format';

@Component({
  selector: 'app-home',
  imports: [RouterLink, EventCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly events = inject(EventService);

  /**
   * The featured events - the three soonest upcoming events.
   * `resource()` handles loading / error state for us and re-runs when the
   * reload counter changes (the "Try again" button).
   */
  private readonly reload = signal(0);

  protected readonly featured = resource({
    params: () => ({ reload: this.reload() }),
    loader: async () =>
      firstValueFrom(this.events.listEvents({ status: 'upcoming', sort: 'date', limit: 3 })),
  });

  /** The charities behind the events. */
  protected readonly organisations = resource({
    params: () => ({ reload: this.reload() }),
    loader: async () => firstValueFrom(this.events.getOrganisations()),
  });

  /** All events, used only to build the statistics strip. */
  private readonly allEvents = resource({
    params: () => ({ reload: this.reload() }),
    loader: async () => firstValueFrom(this.events.listEvents({ sort: 'date' })),
  });

  // ---- derived statistics --------------------------------------------------

  protected readonly totalEvents = computed(() => this.allEvents.value()?.length ?? 0);

  protected readonly totalCharities = computed(() => this.organisations.value()?.length ?? 0);

  protected readonly totalRegistrations = computed(() =>
    (this.allEvents.value() ?? []).reduce((sum, event) => sum + event.registrationCount, 0),
  );

  protected readonly totalRaised = computed(() =>
    formatCurrencyWhole((this.allEvents.value() ?? []).reduce((sum, event) => sum + event.currentAmount, 0)),
  );

  /** Next event, used by the hero call-to-action. */
  protected readonly nextEvent = computed(() => this.featured.value()?.[0] ?? null);

  protected readonly nextEventDate = computed(() =>
    this.nextEvent() ? formatDate(this.nextEvent()!.eventDate) : '',
  );

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }
}
