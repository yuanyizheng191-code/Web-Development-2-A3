/**
 * app/core/services/admin-event.service.ts
 * The admin website's data layer.
 *
 * Every method maps to one REST endpoint.  The full CRUD cycle required by
 * it provides the full CRUD cycle:
 *   list     -> listEvents()          GET    /api/events
 *   create   -> createEvent()         POST   /api/events
 *   update   -> updateEvent()         PUT    /api/events/:id
 *   delete   -> deleteEvent()         DELETE /api/events/:id   (409 when booked)
 *
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService, QueryValue } from './api.service';
import {
  CharityEvent,
  DashboardData,
  EventCategory,
  EventPayload,
  EventRegistration,
  GeocodeResult,
  Organisation,
} from '../models/event.model';

/** Filters accepted by the admin event table. */
export interface AdminEventFilters {
  search?: string;
  status?: string;
  categoryId?: number | null;
  sort?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminEventService {
  private readonly api = inject(ApiService);

  // READ

  /**
   * GET /api/events
   * The admin list shows events of EVERY status (Active, Past, Suspended,
   * Upcoming) for administrative use, so no status filter is applied by default.
   */
  listEvents(filters: AdminEventFilters = {}): Observable<CharityEvent[]> {
    const query: Record<string, QueryValue> = {
      search: filters.search,
      status: filters.status ?? null,
      categoryId: filters.categoryId ?? null,
      sort: filters.sort ?? 'date',
    };
    return this.api.get<CharityEvent[]>('/events', query);
  }

  /**
   * GET /api/events/:id
   * `registrations=include` (the default on this endpoint) returns the event and
   * its associated registration data together, which is what the Update form and
   * the registration viewer need.
   */
  getEvent(eventId: number, includeRegistrations = true): Observable<CharityEvent> {
    return this.api.get<CharityEvent>(`/events/${eventId}`, {
      registrations: includeRegistrations ? 'include' : 'none',
    });
  }

  /** GET /api/dashboard - the summary cards on the admin home page. */
  getDashboard(): Observable<DashboardData> {
    return this.api.get<DashboardData>('/dashboard');
  }

  /** GET /api/categories */
  getCategories(): Observable<EventCategory[]> {
    return this.api.get<EventCategory[]>('/categories');
  }

  /** GET /api/organisations */
  getOrganisations(): Observable<Organisation[]> {
    return this.api.get<Organisation[]>('/organisations');
  }

  /** GET /api/events/:id/registrations - used by the registration viewer. */
  getRegistrations(eventId: number): Observable<EventRegistration[]> {
    return this.api.get<EventRegistration[]>(`/events/${eventId}/registrations`);
  }

  // CREATE / UPDATE / DELETE

  /** POST /api/events - the "Save" button of the New Event form. */
  createEvent(payload: EventPayload): Observable<{ data: CharityEvent; message: string }> {
    return this.api.post<CharityEvent>('/events', payload);
  }

  /** PUT /api/events/:id - the "Save" button of the Update Event form. */
  updateEvent(eventId: number, payload: EventPayload): Observable<CharityEvent> {
    return this.api.put<CharityEvent>(`/events/${eventId}`, payload);
  }

  /**
   * DELETE /api/events/:id
   * The API refuses (HTTP 409) when the event already has registrations; the
   * component surfaces that message directly to the staff member.
   */
  deleteEvent(eventId: number): Observable<{ data: { eventId: number; eventName: string }; message: string }> {
    return this.api.delete<{ eventId: number; eventName: string }>(`/events/${eventId}`);
  }

  /** DELETE /api/registrations/:id - cancel one booking. */
  deleteRegistration(registrationId: number): Observable<{ message: string }> {
    return this.api.delete<EventRegistration>(`/registrations/${registrationId}`);
  }

  // External API helpers

  /**
   * GET /api/geocode?name=...
   * Fills the latitude/longitude fields of the event form from a venue name.
   */
  geocode(name: string): Observable<{ results: GeocodeResult[] }> {
    return this.api.get<{ results: GeocodeResult[] }>('/geocode', { name });
  }
}
