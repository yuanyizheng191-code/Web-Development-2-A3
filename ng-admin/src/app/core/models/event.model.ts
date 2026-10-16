/**
 * app/core/models/event.model.ts
 * TypeScript interfaces matching the JSON produced by the REST API.
 * Shared (copied) between the client and admin applications so both halves of
 * the project agree on the data contract.
 *
 */

export type EventStatus = 'active' | 'suspended' | 'past' | 'upcoming';

export interface CharityEvent {
  eventId: number;
  eventName: string;
  description: string | null;
  fullDescription: string | null;
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
  registrationCount: number;
  ticketsSold: number;
  registrations?: EventRegistration[];
}

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

/**
 * Payload for POST /api/events and PUT /api/events/:id.
 * The API validates every field again on the server.
 */
export interface EventPayload {
  eventName: string;
  description: string | null;
  fullDescription: string | null;
  eventDate: string;
  location: string;
  purpose: string | null;
  ticketPrice: number | null;
  goalAmount: number | null;
  currentAmount?: number | null;
  imageUrl: string | null;
  status: EventStatus;
  orgId: number | null;
  categoryId: number | null;
  latitude: number | null;
  longitude: number | null;
}

/** Summary numbers for the admin dashboard cards. */
export interface DashboardSummary {
  totalEvents: number;
  upcomingEvents: number;
  activeEvents: number;
  suspendedEvents: number;
  pastEvents: number;
  totalRegistrations: number;
  totalTickets: number;
  totalRevenue: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentEvents: CharityEvent[];
  storage: string;
}

/** Geocoding result used to fill latitude/longitude automatically. */
export interface GeocodeResult {
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  count?: number;
  message?: string;
  data: T;
}
