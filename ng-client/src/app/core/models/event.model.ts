/**
 * app/core/models/event.model.ts
 * TypeScript interfaces describing exactly what the REST API returns.
 * They mirror the camelCase JSON produced by api/db/events.repo.js, so the
 * compiler catches any mismatch between the front end and the back end.
 *
 */

/** The four values allowed by the events.status ENUM in MySQL. */
export type EventStatus = 'active' | 'suspended' | 'past' | 'upcoming';

/** A charity event, as returned by GET /api/events and GET /api/events/:id. */
export interface CharityEvent {
  eventId: number;
  eventName: string;
  description: string | null;
  fullDescription: string | null;
  /** 'YYYY-MM-DD HH:MM:SS' - the format MySQL DATETIME uses. */
  eventDate: string;
  location: string;
  purpose: string | null;
  ticketPrice: number | null;
  goalAmount: number | null;
  currentAmount: number;
  imageUrl: string | null;
  status: EventStatus;
  orgId: number | null;
  orgName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  latitude: number | null;
  longitude: number | null;
  /** How many registration records exist for this event. */
  registrationCount: number;
  /** Total tickets sold (a registration can buy several tickets). */
  ticketsSold: number;
  /** Only present on GET /api/events/:id. */
  registrations?: EventRegistration[];
}

/** One ticket purchase, from the registrations table. */
export interface EventRegistration {
  registrationId: number;
  eventId: number;
  attendeeName: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  ticketsPurchased: number;
  totalAmount: number;
  registrationDate: string;
  notes: string | null;
}

/** Lookup table values for the admin dropdowns. */
export interface EventCategory {
  categoryId: number;
  categoryName: string;
  description: string | null;
  eventCount: number;
}

export interface Organisation {
  orgId: number;
  orgName: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  eventCount: number;
}

/** Payload sent to POST /api/events/:id/registrations. */
export interface RegistrationRequest {
  attendeeName: string;
  email: string;
  phone?: string | null;
  organisation?: string | null;
  ticketsPurchased: number;
  registrationDate?: string | null;
  notes?: string | null;
}

/** One day of the Open-Meteo forecast, already translated by the API. */
export interface WeatherDay {
  date: string;
  weatherCode: number;
  description: string;
  icon: string;
  temperatureMax: number | null;
  temperatureMin: number | null;
}

/** The forecast block returned by GET /api/events/:id/weather. */
export interface WeatherForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  timezoneAbbreviation: string;
  elevation: number;
  forecast: WeatherDay[];
  source: string;
}

/** Every API response is wrapped in this envelope (see api/README.md). */
export interface ApiEnvelope<T> {
  success: boolean;
  count?: number;
  message?: string;
  data: T;
}
