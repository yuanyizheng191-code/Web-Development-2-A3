/**
 * features/event-card/event-card.component.ts
 * ---------------------------------------------------------------------------
 * A reusable summary card for one charity event.
 *
 * Used by the Home page, the Events listing page and the Search page, so the
 * event presentation is written once.  It also demonstrates the extra external
 * API integration: for an upcoming event the card fetches the Open-Meteo
 * forecast for the venue and shows a small weather chip.
 *
 * Angular v22 features on show here:
 *   * `input.required()`  - signal based component input
 *   * `computed()`        - derived display values, recalculated only when the
 *                           event actually changes
 *   * `resource()`        - async data (the weather call) tied to a signal,
 *                           with built-in loading / error states
 *   * `@if` / `@for`      - the built-in control flow syntax
 *
 * PROG2002 A3 - team40 - Yizheng Yuan (24833044), Mu Li (224832355)
 */
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CharityEvent } from '../../core/models/event.model';
import { EventService } from '../../core/services/event.service';
import {
  formatCurrencyWhole,
  formatDate,
  formatPrice,
  formatTime,
  goalPercent,
  resolveImage,
  statusClass,
} from '../../core/utils/format';

@Component({
  selector: 'app-event-card',
  imports: [RouterLink],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss',
})
export class EventCardComponent {
  private readonly events = inject(EventService);

  /** The event to display - supplied by the parent page. */
  readonly event = input.required<CharityEvent>();

  /** Hide the weather chip where it would be noise. */
  readonly showWeather = input(true);

  // ---- derived display values ---------------------------------------------

  readonly statusLabel = computed(() => {
    const status = this.event().status;
    return status.charAt(0).toUpperCase() + status.slice(1);
  });

  readonly statusClass = computed(() => statusClass(this.event().status));

  readonly dateText = computed(() => formatDate(this.event().eventDate));
  readonly timeText = computed(() => formatTime(this.event().eventDate));
  readonly priceText = computed(() => formatPrice(this.event().ticketPrice));

  readonly progress = computed(() => goalPercent(this.event().currentAmount, this.event().goalAmount));

  /** '$15,000' style totals for the fundraising progress line. */
  readonly raisedText = computed(() => formatCurrencyWhole(this.event().currentAmount));
  readonly goalText = computed(() => formatCurrencyWhole(this.event().goalAmount));

  /** Resolved image path, or null when the event has no image. */
  readonly imageSrc = computed(() => resolveImage(this.event().imageUrl));

  /** Flipped by the <img> error handler when the A2 image file is missing. */
  private readonly broken = signal(false);
  readonly imageBroken = computed(() => this.broken() || !this.imageSrc());

  /** Fallback gradient keyed on the event id, so each card looks different. */
  readonly accent = computed(() => (this.event().eventId % 5) + 1);

  protected onImageError(): void {
    this.broken.set(true);
  }

  /**
   * The weather forecast for this event's venue.
   *
   * `resource()` re-runs whenever the parameters below change.  It only calls
   * the API for events that are still ahead of us, because a forecast for
   * something that has already happened is meaningless - the loader returns
   * null and the chip is simply not rendered.
   */
  protected readonly weather = resource({
    params: () => ({
      id: this.event().eventId,
      status: this.event().status,
      show: this.showWeather(),
      coords: this.event().latitude !== null && this.event().longitude !== null,
    }),
    loader: async ({ params }) => {
      if (!params.show || !params.coords) return null;
      if (params.status !== 'upcoming' && params.status !== 'active') return null;
      try {
        return await firstValueFrom(this.events.getEventWeather(params.id, 1));
      } catch {
        // The external service is optional - never break the page because of it.
        return null;
      }
    },
  });

  /** Today's forecast entry. */
  readonly firstForecastDay = computed(() => this.weather.value()?.forecast?.[0] ?? null);
}
