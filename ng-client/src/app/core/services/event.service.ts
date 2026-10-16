/**
 * app/core/services/event.service.ts
 * Everything the client-side website needs from the charity events API.
 *
 * Components never build URLs themselves - they call these typed methods, which
 * keeps the REST paths in exactly one place.
 *
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService, QueryValue } from './api.service';
import {
  CharityEvent,
  EventCategory,
  EventRegistration,
  Organisation,
  RegistrationRequest,
  WeatherForecast,
} from '../models/event.model';

/** Filters accepted by the Search page. */
export interface EventFilters {
  search?: string;
  categoryId?: number | null;
  orgId?: number | null;
  status?: string | null;
  sort?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = inject(ApiService);

  /**
   * GET /api/events - the Home page uses it for the featured list and the
   * Search page uses it with filters.
   */
  listEvents(filters: EventFilters = {}): Observable<CharityEvent[]> {
    const query: Record<string, QueryValue> = {
      search: filters.search,
      categoryId: filters.categoryId ?? null,
      orgId: filters.orgId ?? null,
      status: filters.status ?? null,
      sort: filters.sort,
      limit: filters.limit,
    };
    return this.api.get<CharityEvent[]>('/events', query);
  }

  /** GET /api/events/:id - includes the complete registration list. */
  getEvent(eventId: number): Observable<CharityEvent> {
    return this.api.get<CharityEvent>(`/events/${eventId}`);
  }

  /**
   * GET /api/events/:id/registrations
   * `order: 'desc'` (the default) returns the most recent purchase first, which
   */
  getRegistrations(eventId: number, order: 'asc' | 'desc' = 'desc'): Observable<EventRegistration[]> {
    return this.api.get<EventRegistration[]>(`/events/${eventId}/registrations`, { order });
  }

  /** POST /api/events/:id/registrations - the registration form. */
  registerForEvent(
    eventId: number,
    registration: RegistrationRequest,
  ): Observable<{ data: EventRegistration; message: string }> {
    return this.api.post<EventRegistration>(`/events/${eventId}/registrations`, registration);
  }

  /** GET /api/categories - used to build the category filter and dropdowns. */
  getCategories(): Observable<EventCategory[]> {
    return this.api.get<EventCategory[]>('/categories');
  }

  /** GET /api/organisations */
  getOrganisations(): Observable<Organisation[]> {
    return this.api.get<Organisation[]>('/organisations');
  }

  /**
   * GET /api/events/:id/weather  (external Open-Meteo API, Part 6)
   * Fails gracefully: the Event Detail page simply hides the panel when the
   * external service is unavailable.
   */
  getEventWeather(eventId: number, days = 7): Observable<WeatherForecast> {
    return this.api.get<WeatherForecast>(`/events/${eventId}/weather`, { days });
  }
}
