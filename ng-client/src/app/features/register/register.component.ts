/**
 * features/register/register.component.ts
 * ---------------------------------------------------------------------------
 * THE REGISTRATION PAGE - the new page added in this version of the site.
 *
 * Requirements covered:
 *   * "Create a user-friendly form that collects the necessary details from the
 *     user to submit a new registration record (user details, the date of
 *     registration, contact details, the number of tickets purchased,
 *     following your database schema)."
 *   * "Display the event information about the selected charity event on this
 *     page (using your APIs) so the user is clear about the event they are
 *     registering for."
 *   * "Implement a button that finalises the registration."
 *        - validates the user input  (Angular Reactive Forms validators)
 *        - shows a client-side alert when validation fails
 *        - calls POST /api/events/:id/registrations
 *        - shows a confirmation message on success
 *   * "You may utilise appropriate methods (e.g., URL Query Strings or Local
 *     Storage) to pass the event ID between pages"
 *        -> the Event Details page links here with /register?eventId=3
 *
 * The event can also be chosen from a dropdown, so the page works standalone.
 *
 * PROG2002 A3 - team40 - Yizheng Yuan (24833044), Mu Li (224832355)
 */
import { Component, ElementRef, computed, inject, resource, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../core/services/api.service';
import { EventService } from '../../core/services/event.service';
import { EventRegistration } from '../../core/models/event.model';
import { formatCurrency, formatDate, formatTime, formatPrice, resolveImage } from '../../core/utils/format';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly eventService = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  // ---- state ---------------------------------------------------------------

  /** The event the user is registering for (drives the API call). */
  protected readonly selectedEventId = signal<number | null>(null);

  /** Bumped to re-run a failed request. */
  private readonly reload = signal(0);

  /** Set after a successful POST so the confirmation panel can be shown. */
  protected readonly confirmation = signal<EventRegistration | null>(null);

  /** Server-side error message (409 duplicate, 400 validation, 503 offline...). */
  protected readonly submitError = signal<string | null>(null);

  /** Client-side validation alert - set when the form is submitted while invalid. */
  protected readonly validationAlert = signal<string | null>(null);

  protected readonly submitting = signal(false);

  /** Reference to the <form> element, used to focus the first invalid field. */
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('registrationForm');

  /** True when ?eventId= was supplied, so the dropdown is locked. */
  protected readonly lockedToQueryString = signal(false);

  /**
   * The registration form.
   *
   * The validators here are the FRONT-END half of the validation story; the API
   * validates exactly the same rules again in api/utils/validate.js, because a
   * REST endpoint can never trust the browser.
   */
  protected readonly form = this.fb.nonNullable.group({
    eventId: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    attendeeName: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(100),
    ]),
    email: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/),
      Validators.maxLength(120),
    ]),
    phone: this.fb.nonNullable.control('', [Validators.pattern(/^[0-9+()\-\s]{8,20}$/)]),
    organisation: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    ticketsPurchased: this.fb.nonNullable.control(1, [
      Validators.required,
      Validators.min(1),
      Validators.max(100),
    ]),
    notes: this.fb.nonNullable.control('', [Validators.maxLength(255)]),
  });

  constructor() {
    // Read the event id from the query string (?eventId=3).
    const raw = this.route.snapshot.queryParamMap.get('eventId');
    const id = raw ? Number(raw) : null;
    if (id && Number.isInteger(id) && id > 0) {
      this.selectedEventId.set(id);
      this.form.controls.eventId.setValue(id);
      this.lockedToQueryString.set(true);
    }

    // Keep the signal in step when the dropdown is used.
    this.form.controls.eventId.valueChanges.subscribe((value) => {
      this.selectedEventId.set(value ? Number(value) : null);
      this.submitError.set(null);
    });

    // Keep the live total in step with the ticket quantity.
    this.form.controls.ticketsPurchased.valueChanges.subscribe((value) => {
      this.ticketCount.set(Number(value) || 0);
    });
    this.ticketCount.set(Number(this.form.controls.ticketsPurchased.value) || 0);
  }

  // ---- data ----------------------------------------------------------------

  /** GET /api/events - fills the "which event?" dropdown. */
  protected readonly events = resource({
    params: () => ({ reload: this.reload() }),
    loader: async () => firstValueFrom(this.eventService.listEvents({ sort: 'date' })),
  });

  /**
   * GET /api/events/:id - the full details of the chosen event, so the user can
   * see exactly what they are registering for.
   */
  protected readonly selectedEvent = resource({
    params: () => ({ id: this.selectedEventId(), reload: this.reload() }),
    loader: async ({ params }) => {
      if (!params.id) return null;
      try {
        return await firstValueFrom(this.eventService.getEvent(params.id));
      } catch {
        return null;
      }
    },
  });

  // ---- derived values ------------------------------------------------------

  protected readonly event = computed(() => this.selectedEvent.value() ?? null);

  protected readonly imageSrc = computed(() => resolveImage(this.event()?.imageUrl ?? null));

  private readonly imageBroken = signal(false);
  protected readonly showImage = computed(() => Boolean(this.imageSrc()) && !this.imageBroken());

  /** Live total: ticket price x the number of tickets in the form. */
  protected readonly ticketPrice = computed(() => Number(this.event()?.ticketPrice ?? 0));

  /**
   * The ticket quantity as a SIGNAL.
   *
   * A FormControl is not a signal, so a `computed()` that read
   * `form.controls.ticketsPurchased.value` directly would never recompute and the
   * live total would freeze at its first value.  Mirroring the control into a
   * signal through valueChanges keeps the template-driven total reactive, which
   * is the whole point of the signals-based change detection used here.
   */
  private readonly ticketCount = signal(1);

  protected readonly orderTotal = computed(() => {
    const tickets = this.ticketCount();
    return this.ticketPrice() * (Number.isFinite(tickets) ? tickets : 0);
  });

  protected readonly ticketCountLabel = computed(() => this.ticketCount());

  protected readonly priceText = computed(() => formatPrice(this.event()?.ticketPrice));

  /** The event must be open for registration. */
  protected readonly registrationOpen = computed(() => {
    const event = this.event();
    if (!event) return true; // no event chosen yet - do not disable the form
    return event.status === 'upcoming' || event.status === 'active';
  });

  protected readonly closedReason = computed(() => {
    switch (this.event()?.status) {
      case 'suspended':
        return 'This event is currently suspended, so registrations are not being accepted.';
      case 'past':
        return 'This event has already taken place, so registrations are closed.';
      default:
        return '';
    }
  });

  // ---- validation helpers used by the template ----------------------------

  /** Has a control been touched and is it invalid? */
  protected showError(controlName: string): boolean {
    const control = this.control(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  /** A readable message for the first failing validator on a control. */
  protected errorFor(controlName: string): string {
    const control = this.control(controlName);
    if (!control?.errors) return '';

    const errors = control.errors as Record<string, { requiredLength?: number; min?: number; max?: number }>;
    if (errors['required']) return 'This field is required.';
    if (errors['minlength']) {
      return `Please enter at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      return `Please use no more than ${errors['maxlength'].requiredLength} characters.`;
    }
    if (errors['min']) return `The value must be at least ${errors['min'].min}.`;
    if (errors['max']) return `The value must be at most ${errors['max'].max}.`;
    if (errors['pattern']) {
      return controlName === 'email'
        ? 'Please enter a valid e-mail address, for example name@example.com.'
        : 'Please enter a valid phone number (digits, spaces, +, -, brackets).';
    }
    return 'Please check this field.';
  }

  /** Look a control up by name without fighting TypeScript's key union. */
  private control(name: string): import('@angular/forms').AbstractControl | null {
    const controls = this.form.controls as unknown as Record<string, import('@angular/forms').AbstractControl>;
    return controls[name] ?? null;
  }

  // ---- actions -------------------------------------------------------------

  /**
   * Finalise the registration.
   *
   * 1. mark every control as touched so the inline errors appear
   * 2. stop and show a client-side alert when the form is invalid
   * 3. POST to /api/events/:id/registrations
   * 4. show the confirmation panel, or the server's error message
   */
  protected async submit(): Promise<void> {
    this.validationAlert.set(null);
    this.submitError.set(null);

    // (1) + (2) client-side validation
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.validationAlert.set(
        'Please fix the highlighted fields before submitting your registration. ' +
          'Your name, a valid e-mail address and at least one ticket are required.',
      );
      // Move focus to the first invalid control for accessibility.
      const host = this.formElement()?.nativeElement;
      const firstInvalid = host?.querySelector<HTMLElement>('.is-invalid');
      firstInvalid?.focus();
      return;
    }

    const eventId = Number(this.form.controls.eventId.value);
    if (!eventId) {
      this.validationAlert.set('Please choose the event you want to register for.');
      return;
    }

    const raw = this.form.getRawValue();
    this.submitting.set(true);

    try {
      // (3) the API call
      const result = await firstValueFrom(
        this.eventService.registerForEvent(eventId, {
          attendeeName: raw.attendeeName.trim(),
          email: raw.email.trim().toLowerCase(),
          phone: raw.phone?.trim() || null,
          organisation: raw.organisation?.trim() || null,
          ticketsPurchased: Number(raw.ticketsPurchased),
          notes: raw.notes?.trim() || null,
        }),
      );

      // (4) success
      this.confirmation.set(result.data);
      this.form.reset();
      this.form.controls.eventId.setValue(eventId);
      this.form.controls.ticketsPurchased.setValue(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      // The API's message is shown verbatim - it explains duplicates (409),
      // invalid data (400), closed events (409) and demo mode (503).
      const message =
        error instanceof ApiError
          ? error.message
          : 'The registration could not be saved. Please try again.';
      this.submitError.set(message);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Start another registration after a success. */
  protected registerAnother(): void {
    this.confirmation.set(null);
    this.form.reset();
    this.form.controls.ticketsPurchased.setValue(1);
    if (this.selectedEventId()) {
      this.form.controls.eventId.setValue(this.selectedEventId());
    }
    // `reset()` clears the touched flag, so re-mark for the next submission and
    // make sure the blank form does not show a wall of red errors immediately.
    this.form.markAsUntouched();
  }

  protected onImageError(): void {
    this.imageBroken.set(true);
  }

  // Exposed for the template.
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatPrice = formatPrice;
}
