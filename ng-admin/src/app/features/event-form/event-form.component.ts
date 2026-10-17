/**
 * features/event-form/event-form.component.ts
 * The NEW EVENT and UPDATE EVENT form.
 *
 * One component serves both routes, which keeps the validation, the field list
 * and the API payload in a single place:
 *
 *   /events/new        -> create mode  -> POST /api/events
 *   /events/:id/edit   -> update mode  -> PUT  /api/events/:id
 *
 * Requirements covered:
 *   * "New feature: ... an intuitive form that allows staff to create and submit
 *     new charity events to the database. Ensure a 'Save/Submit' button on this
 *     form calls the endpoint created in Part 2. Implement proper validation to
 *     ensure staff members fill in all the essential required fields before the
 *     data is sent to the API."
 *   * "Update feature: ... select and update the details of an existing event.
 *     This interface should also retrieve and display any associated registration
 *     data for that specific event, providing the staff member with useful
 *     information. Ensure a 'Save' button calls the endpoint created in Part 2.
 *     Implement necessary validation before submission."
 *        -> in update mode GET /api/events/:id?registrations=include is loaded and
 *           the registrations are shown in a side panel.
 *
 */
import { Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminEventService } from '../../core/services/admin-event.service';
import { ApiError } from '../../core/services/api.service';
import { EventPayload, EventRegistration, GeocodeResult } from '../../core/models/event.model';
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/utils/datetime';
import { formatCurrency, formatDateTime, statusClass } from '../../core/utils/format';

@Component({
  selector: 'app-event-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent {
  private readonly admin = inject(AdminEventService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /**
   * Route parameter. Present on /events/:id/edit, absent on /events/new, which
   * is how the component knows which mode it is in.
   */
  readonly id = input<string | undefined>(undefined);

  protected readonly isEditMode = computed(() => Boolean(this.id()));

  // ---- state ---------------------------------------------------------------

  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  protected readonly validationAlert = signal<string | null>(null);
  protected readonly loadingEvent = signal(false);
  protected readonly loadError = signal<string | null>(null);

  /** Coordinates found by the Open-Meteo geocoder. */
  protected readonly geocoding = signal(false);
  protected readonly geocodeResults = signal<GeocodeResult[]>([]);
  protected readonly geocodeError = signal<string | null>(null);

  /** Registrations of the event being edited (read-only, for context). */
  protected readonly associatedRegistrations = signal<EventRegistration[]>([]);

  /**
   * The event form.
   *
   * Validators mirror api/utils/validate.js: the same rules are enforced here
   * for a good user experience and again on the server for safety.
   */
  protected readonly form = this.fb.nonNullable.group({
    eventName: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(150),
    ]),
    description: this.fb.nonNullable.control('', [Validators.maxLength(255)]),
    fullDescription: this.fb.nonNullable.control('', [Validators.maxLength(5000)]),
    eventDate: this.fb.nonNullable.control('', [Validators.required]),
    location: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    purpose: this.fb.nonNullable.control('', [Validators.maxLength(255)]),
    ticketPrice: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0), Validators.max(100000)]),
    goalAmount: this.fb.nonNullable.control<number | null>(null, [Validators.min(0)]),
    imageUrl: this.fb.nonNullable.control('', [Validators.maxLength(300)]),
    status: this.fb.nonNullable.control<'active' | 'suspended' | 'past' | 'upcoming'>('upcoming', [
      Validators.required,
    ]),
    orgId: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    categoryId: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    latitude: this.fb.nonNullable.control<number | null>(null, [Validators.min(-90), Validators.max(90)]),
    longitude: this.fb.nonNullable.control<number | null>(null, [Validators.min(-180), Validators.max(180)]),
  });

  /** Watch location/coordinates so the geocode hint can react. */
  protected readonly hasCoordinates = signal(false);

  constructor() {
    this.form.controls.latitude.valueChanges.subscribe(() => this.syncHasCoordinates());
    this.form.controls.longitude.valueChanges.subscribe(() => this.syncHasCoordinates());

    // Load the event when the :id parameter becomes available (edit mode).
    effect(() => {
      const eventId = this.id();
      if (!eventId) {
        this.associatedRegistrations.set([]);
        return;
      }
      void this.loadEvent(Number(eventId));
    });
  }

  // ---- lookups -------------------------------------------------------------

  /** GET /api/categories - the category dropdown. */
  protected readonly categories = resource({
    loader: async () => firstValueFrom(this.admin.getCategories()),
  });

  /** GET /api/organisations - the charity dropdown. */
  protected readonly organisations = resource({
    loader: async () => firstValueFrom(this.admin.getOrganisations()),
  });

  // ---- loading (edit mode) -------------------------------------------------

  private async loadEvent(eventId: number): Promise<void> {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      this.loadError.set('The event id in the address is not valid.');
      return;
    }

    this.loadingEvent.set(true);
    this.loadError.set(null);
    try {
      // registrations=include gives us the event AND its bookings in one call.
      const event = await firstValueFrom(this.admin.getEvent(eventId, true));

      this.form.patchValue({
        eventName: event.eventName,
        description: event.description ?? '',
        fullDescription: event.fullDescription ?? '',
        // <input type="datetime-local"> needs 'YYYY-MM-DDTHH:MM'
        eventDate: toDateTimeLocal(event.eventDate),
        location: event.location,
        purpose: event.purpose ?? '',
        ticketPrice: Number(event.ticketPrice ?? 0),
        goalAmount: event.goalAmount === null ? null : Number(event.goalAmount),
        imageUrl: event.imageUrl ?? '',
        status: event.status,
        orgId: event.orgId,
        categoryId: event.categoryId,
        latitude: event.latitude,
        longitude: event.longitude,
      });

      this.associatedRegistrations.set(event.registrations ?? []);
      this.syncHasCoordinates();
      this.form.markAsPristine();
    } catch (error) {
      this.loadError.set(
        error instanceof ApiError ? error.message : 'The event could not be loaded.',
      );
    } finally {
      this.loadingEvent.set(false);
    }
  }

  private syncHasCoordinates(): void {
    const lat = this.form.controls.latitude.value;
    const lon = this.form.controls.longitude.value;
    this.hasCoordinates.set(lat !== null && lon !== null);
  }

  // ---- validation helpers --------------------------------------------------

  protected showError(controlName: string): boolean {
    const control = this.control(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected errorFor(controlName: string): string {
    const control = this.control(controlName);
    if (!control?.errors) return '';
    const errors = control.errors as Record<string, { requiredLength?: number; min?: number; max?: number }>;

    if (errors['required']) return 'This field is required.';
    if (errors['minlength']) return `Please enter at least ${errors['minlength'].requiredLength} characters.`;
    if (errors['maxlength']) return `Please use no more than ${errors['maxlength'].requiredLength} characters.`;
    if (errors['min']) return `The value must be at least ${errors['min'].min}.`;
    if (errors['max']) return `The value must be at most ${errors['max'].max}.`;
    return 'Please check this field.';
  }

  private control(name: string): import('@angular/forms').AbstractControl | null {
    const controls = this.form.controls as unknown as Record<string, import('@angular/forms').AbstractControl>;
    return controls[name] ?? null;
  }

  // ---- geocoding (external Open-Meteo API) --------------------------------

  /** Look up the typed venue name and fill latitude/longitude. */
  protected async findCoordinates(): Promise<void> {
    const place = this.form.controls.location.value.trim();
    if (place.length < 2) {
      this.geocodeError.set('Enter the venue or city name first, then search for its coordinates.');
      return;
    }

    this.geocoding.set(true);
    this.geocodeError.set(null);
    this.geocodeResults.set([]);
    try {
      const response = await firstValueFrom(this.admin.geocode(place));
      if (!response.results.length) {
        this.geocodeError.set(
          `No coordinates found for "${place}". Open-Meteo matches place names rather than ` +
            'street addresses, so try a shorter name such as the suburb or city.',
        );
        return;
      }
      this.geocodeResults.set(response.results);
      // Pre-select the best match.
      this.applyCoordinates(response.results[0]);
    } catch (error) {
      this.geocodeError.set(
        error instanceof ApiError ? error.message : 'The geocoding service is unavailable.',
      );
    } finally {
      this.geocoding.set(false);
    }
  }

  protected applyCoordinates(result: GeocodeResult): void {
    this.form.controls.latitude.setValue(result.latitude);
    this.form.controls.longitude.setValue(result.longitude);
    this.form.controls.latitude.markAsDirty();
    this.form.controls.longitude.markAsDirty();
    this.syncHasCoordinates();
  }

  // ---- submit --------------------------------------------------------------

  /**
   * Save the event.
   *   create mode -> POST /api/events      -> redirect to the list on success
   *   update mode -> PUT  /api/events/:id  -> stay on the form with a message
   */
  protected async submit(): Promise<void> {
    this.validationAlert.set(null);
    this.feedback.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.validationAlert.set(
        'Please complete every required field before saving. The event name, date, venue, ' +
          'ticket price, status, charity and category are mandatory.',
      );
      const host = document.querySelector<HTMLElement>('form .is-invalid');
      host?.focus();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: EventPayload = {
      eventName: raw.eventName.trim(),
      description: raw.description?.trim() || null,
      fullDescription: raw.fullDescription?.trim() || null,
      // The input gives 'YYYY-MM-DDTHH:MM'; the API expects 'YYYY-MM-DD HH:MM:SS'.
      eventDate: fromDateTimeLocal(raw.eventDate),
      location: raw.location.trim(),
      purpose: raw.purpose?.trim() || null,
      ticketPrice: Number(raw.ticketPrice ?? 0),
      goalAmount: raw.goalAmount === null || raw.goalAmount === undefined ? null : Number(raw.goalAmount),
      imageUrl: raw.imageUrl?.trim() || null,
      status: raw.status,
      orgId: raw.orgId === null ? null : Number(raw.orgId),
      categoryId: raw.categoryId === null ? null : Number(raw.categoryId),
      latitude: raw.latitude === null ? null : Number(raw.latitude),
      longitude: raw.longitude === null ? null : Number(raw.longitude),
    };

    this.saving.set(true);
    try {
      if (this.isEditMode()) {
        const updated = await firstValueFrom(this.admin.updateEvent(Number(this.id()), payload));
        this.feedback.set({
          type: 'success',
          message: `"${updated.eventName}" was updated successfully.`,
        });
        this.form.markAsPristine();
        // Refresh the registration panel (and any recalculated totals).
        await this.loadEvent(Number(this.id()));
      } else {
        const created = await firstValueFrom(this.admin.createEvent(payload));
        // Navigate to the new event's update page so staff can add more details.
        await this.router.navigate(['/events', created.data.eventId, 'edit'], {
          state: { createdMessage: created.message },
        });
      }
    } catch (error) {
      this.feedback.set({
        type: 'error',
        message:
          error instanceof ApiError ? error.message : 'The event could not be saved. Please try again.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.saving.set(false);
    }
  }

  protected resetForm(): void {
    if (this.isEditMode()) {
      void this.loadEvent(Number(this.id()));
    } else {
      this.form.reset({ ticketPrice: 0, status: 'upcoming' });
      this.geocodeResults.set([]);
      this.validationAlert.set(null);
      this.feedback.set(null);
    }
  }

  protected dismissFeedback(): void {
    this.feedback.set(null);
  }

  // Exposed for the template.
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDateTime = formatDateTime;
  protected readonly statusClass = statusClass;
}
