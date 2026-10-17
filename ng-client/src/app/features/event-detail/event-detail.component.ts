/**
 * features/event-detail/event-detail.component.ts
 * THE EVENT DETAILS PAGE
 *
 * Requirements covered:
 *   * "Use your updated API endpoint to dynamically retrieve and display a list
 *     of all recorded registrations for the specific event."
 *        -> GET /api/events/:id returns the event AND its registrations in one
 *           request, so the page needs a single call.
 *   * "sorted by the latest date when the tickets were purchased"
 *        -> the API orders by registration_date DESC (the page also lets the
 *           user flip to oldest-first, which proves the ordering is real).
 *   * "Update the existing Register button so that it now correctly links to
 *     the new Event Registration Page"
 *        -> the button navigates to /register?eventId=:id.
 *   * "Must call your APIs."
 *   * Optional Part 6: the Open-Meteo forecast for the venue.
 *
 * The :id route parameter is received as a component input thanks to
 * `withComponentInputBinding()` in app.config.ts.
 *
 */
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EventService } from '../../core/services/event.service';
import {
  formatCurrency,
  formatCurrencyWhole,
  formatDate,
  formatDateTime,
  formatPrice,
  formatTime,
  goalPercent,
  resolveImage,
  statusClass,
} from '../../core/utils/format';

@Component({
  selector: 'app-event-detail',
  imports: [RouterLink],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss',
})
export class EventDetailComponent {
  private readonly events = inject(EventService);

  /** Bound from the ':id' route parameter. */
  readonly id = input.required<string>();

  protected readonly order = signal<'desc' | 'asc'>('desc');

  private readonly reload = signal(0);

  /** The event plus its registration list. */
  protected readonly eventResource = resource({
    params: () => ({ id: this.id(), order: this.order(), reload: this.reload() }),
    loader: async ({ params }) => {
      const event = await firstValueFrom(this.events.getEvent(Number(params.id)));
      // Re-fetch the registration ordering if the user flipped the toggle.
      if (params.order === 'asc' && event.registrations?.length) {
        event.registrations = await firstValueFrom(
          this.events.getRegistrations(Number(params.id), 'asc'),
        );
      }
      return event;
    },
  });

  /** Optional external API - a failure here must not break the page. */
  protected readonly weather = resource({
    params: () => ({ id: this.id(), reload: this.reload() }),
    loader: async ({ params }) => {
      try {
        return await firstValueFrom(this.events.getEventWeather(Number(params.id), 7));
      } catch {
        return null;
      }
    },
  });

  // ---- derived values ------------------------------------------------------

  protected readonly event = computed(() => this.eventResource.value() ?? null);

  protected readonly registrations = computed(() => this.event()?.registrations ?? []);

  protected readonly imageSrc = computed(() => resolveImage(this.event()?.imageUrl ?? null));

  private readonly imageBroken = signal(false);
  protected readonly showImage = computed(() => Boolean(this.imageSrc()) && !this.imageBroken());

  protected readonly statusClassValue = computed(() => statusClass(this.event()?.status));

  protected readonly statusLabel = computed(() => {
    const status = this.event()?.status ?? '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  });

  protected readonly priceText = computed(() => formatPrice(this.event()?.ticketPrice));

  protected readonly raisedText = computed(() => formatCurrencyWhole(this.event()?.currentAmount));

  protected readonly goalText = computed(() => formatCurrencyWhole(this.event()?.goalAmount));

  protected readonly progress = computed(() =>
    goalPercent(this.event()?.currentAmount ?? 0, this.event()?.goalAmount ?? null),
  );

  /** Totals for the registrations table footer. */
  protected readonly totalTickets = computed(() =>
    this.registrations().reduce((sum, r) => sum + r.ticketsPurchased, 0),
  );

  protected readonly totalValue = computed(() =>
    this.registrations().reduce((sum, r) => sum + r.totalAmount, 0),
  );

  /** Can this event still be registered for? */
  protected readonly canRegister = computed(() => {
    const status = this.event()?.status;
    return status === 'upcoming' || status === 'active';
  });

  protected readonly registrationClosedReason = computed(() => {
    switch (this.event()?.status) {
      case 'suspended':
        return 'This event is currently suspended and is not accepting new registrations.';
      case 'past':
        return 'This event has already taken place. Registrations are closed.';
      default:
        return '';
    }
  });

  // ---- actions -------------------------------------------------------------

  protected toggleOrder(): void {
    this.order.update((current) => (current === 'desc' ? 'asc' : 'desc'));
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected onImageError(): void {
    this.imageBroken.set(true);
  }

  /** Exposed for the template (kept as a field so `this` is not needed there). */
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly formatCurrency = formatCurrency;
}
