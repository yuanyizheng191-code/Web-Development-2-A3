/**
 * features/event-list/event-list.component.ts
 * THE ADMIN EVENT LIST
 *
 * Requirements covered:
 *   * "List feature: ... displays a complete list of all registered events,
 *     regardless of their status (Active, Past, Suspended). This data must be
 *     retrieved by calling the appropriate API endpoint. The list should include
 *     key details necessary for administrative purposes."
 *        -> GET /api/events with no status filter, showing name, date, venue,
 *           category, charity, status, ticket price, registrations, tickets and
 *           the amount raised.
 *   * "Delete feature: Implement a 'Delete' button or link next to each event in
 *     the main listing. Ensure this button triggers the call to the endpoint
 *     created in Part 2. Provide clear user feedback, especially if the deletion
 *     is blocked due to existing registrations."
 *        -> deleteEvent() + a confirmation dialog + the API's 409 message shown
 *           in a dismissible alert.
 *
 */
import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminEventService } from '../../core/services/admin-event.service';
import { ApiError } from '../../core/services/api.service';
import { CharityEvent } from '../../core/models/event.model';
import { formatCurrency, formatDateTime, statusClass, formatPrice } from '../../core/utils/format';

@Component({
  selector: 'app-admin-event-list',
  imports: [RouterLink],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss',
})
export class AdminEventListComponent {
  private readonly admin = inject(AdminEventService);

  // ---- filter state --------------------------------------------------------

  protected readonly searchTerm = signal('');
  private readonly appliedSearch = signal('');
  protected readonly statusFilter = signal<string>('');
  protected readonly sortOrder = signal<string>('date');

  private readonly reload = signal(0);
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  /** The event currently being deleted (shows a spinner on its row). */
  protected readonly deletingId = signal<number | null>(null);

  /** Result of the last create/update/delete attempt. */
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // ---- data ----------------------------------------------------------------

  protected readonly eventsResource = resource({
    params: () => ({
      search: this.appliedSearch(),
      status: this.statusFilter(),
      sort: this.sortOrder(),
      reload: this.reload(),
    }),
    loader: async ({ params }) =>
      firstValueFrom(
        this.admin.listEvents({
          search: params.search || undefined,
          status: params.status || undefined,
          sort: params.sort,
        }),
      ),
  });

  protected readonly events = computed<CharityEvent[]>(() => this.eventsResource.value() ?? []);

  protected readonly count = computed(() => this.events().length);

  /** How many of the listed events can never be deleted (they have bookings). */
  protected readonly protectedCount = computed(
    () => this.events().filter((event) => event.registrationCount > 0).length,
  );

  // ---- actions -------------------------------------------------------------

  protected onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => this.appliedSearch.set(value.trim()), 300);
  }

  protected onStatusChange(value: string): void {
    this.statusFilter.set(value);
  }

  protected onSortChange(value: string): void {
    this.sortOrder.set(value);
  }

  protected resetFilters(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.searchTerm.set('');
    this.appliedSearch.set('');
    this.statusFilter.set('');
    this.sortOrder.set('date');
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected dismissFeedback(): void {
    this.feedback.set(null);
  }

  /**
   * Delete one event.
   *
   * A confirmation dialog is shown first because this is destructive.
   * The API then decides: it returns 200 when the event has no registrations, or
   * 409 with an explanation when it does - and that explanation is displayed
   * verbatim so the staff member knows exactly why the delete was blocked.
   */
  protected async deleteEvent(event: CharityEvent): Promise<void> {
    if (event.registrationCount > 0) {
      // Save a round trip: the table already knows this event is protected.
      this.feedback.set({
        type: 'error',
        message:
          `"${event.eventName}" has ${event.registrationCount} registration` +
          `${event.registrationCount === 1 ? '' : 's'} and cannot be deleted. ` +
          'Set its status to "suspended" instead, or open the registrations and cancel them first.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const confirmed = window.confirm(
      `Delete "${event.eventName}"?\n\n` +
        'This permanently removes the event from the database. ' +
        'This action cannot be undone.',
    );
    if (!confirmed) return;

    this.deletingId.set(event.eventId);
    this.feedback.set(null);

    try {
      const result = await firstValueFrom(this.admin.deleteEvent(event.eventId));
      this.feedback.set({ type: 'success', message: result.message });
      this.reload.update((n) => n + 1);
    } catch (error) {
      this.feedback.set({
        type: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'The event could not be deleted. Please try again.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.deletingId.set(null);
    }
  }

  // Exposed for the template.
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatPrice = formatPrice;
  protected readonly statusClass = statusClass;
}
