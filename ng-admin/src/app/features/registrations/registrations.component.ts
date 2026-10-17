/**
 * features/registrations/registrations.component.ts
 * The registration viewer for one event (admin side).
 *
 * Requirement: the Update feature "should also retrieve and display any
 * associated registration data for that specific event, providing the staff
 * member with useful information."  This page gives the staff member the full
 * booking list for an event, with totals, and the ability to cancel a booking
 * (which also frees the event for deletion).
 *
 * Data:
 *   GET /api/events/:id                   -> the event header
 *   GET /api/events/:id/registrations     -> the booking list, latest first
 *   DELETE /api/registrations/:id         -> cancel one booking
 *
 */
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminEventService } from '../../core/services/admin-event.service';
import { ApiError } from '../../core/services/api.service';
import { EventRegistration } from '../../core/models/event.model';
import { formatCurrency, formatDateTime, statusClass } from '../../core/utils/format';

@Component({
  selector: 'app-admin-registrations',
  imports: [RouterLink],
  templateUrl: './registrations.component.html',
  styleUrl: './registrations.component.scss',
})
export class RegistrationsComponent {
  private readonly admin = inject(AdminEventService);

  /** Bound from the ':id' route parameter. */
  readonly id = input.required<string>();

  private readonly reload = signal(0);

  protected readonly deletingId = signal<number | null>(null);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  /** The event header (name, date, venue, status). */
  protected readonly eventResource = resource({
    params: () => ({ id: this.id(), reload: this.reload() }),
    loader: async ({ params }) =>
      firstValueFrom(this.admin.getEvent(Number(params.id), false)),
  });

  /** The booking list - the API returns the most recent purchase first. */
  protected readonly registrationsResource = resource({
    params: () => ({ id: this.id(), reload: this.reload() }),
    loader: async ({ params }) =>
      firstValueFrom(this.admin.getRegistrations(Number(params.id))),
  });

  protected readonly event = computed(() => this.eventResource.value() ?? null);

  protected readonly registrations = computed<EventRegistration[]>(
    () => this.registrationsResource.value() ?? [],
  );

  protected readonly totalTickets = computed(() =>
    this.registrations().reduce((sum, r) => sum + r.ticketsPurchased, 0),
  );

  protected readonly totalValue = computed(() =>
    this.registrations().reduce((sum, r) => sum + r.totalAmount, 0),
  );

  /** True when the event can now be deleted (no bookings left). */
  protected readonly deletable = computed(() => this.registrations().length === 0);

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected dismissFeedback(): void {
    this.feedback.set(null);
  }

  /** Cancel one booking, then refresh the list. */
  protected async cancelRegistration(registration: EventRegistration): Promise<void> {
    const confirmed = window.confirm(
      `Cancel the registration for ${registration.attendeeName} (${registration.ticketsPurchased} ticket(s))?\n\n` +
        'The booking is removed from the database and the event total is recalculated.',
    );
    if (!confirmed) return;

    this.deletingId.set(registration.registrationId);
    this.feedback.set(null);
    try {
      const result = await firstValueFrom(this.admin.deleteRegistration(registration.registrationId));
      this.feedback.set({ type: 'success', message: result.message });
      this.reload.update((n) => n + 1);
    } catch (error) {
      this.feedback.set({
        type: 'error',
        message: error instanceof ApiError ? error.message : 'The booking could not be cancelled.',
      });
    } finally {
      this.deletingId.set(null);
    }
  }

  // Exposed for the template.
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDateTime = formatDateTime;
  protected readonly statusClass = statusClass;
}
