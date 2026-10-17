/**
 * features/about/about.component.ts
 * Documentation page for the admin console: what it does, which endpoints it
 * calls and the database rules it respects.
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-about',
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AdminAboutComponent {
  protected readonly endpoints = [
    { method: 'GET', path: '/api/dashboard', purpose: 'Summary cards and recent events' },
    { method: 'GET', path: '/api/events', purpose: 'The event list (all statuses)' },
    { method: 'GET', path: '/api/events/:id', purpose: 'Load an event and its registrations into the update form' },
    { method: 'POST', path: '/api/events', purpose: 'Create a new event' },
    { method: 'PUT', path: '/api/events/:id', purpose: 'Update an existing event' },
    { method: 'DELETE', path: '/api/events/:id', purpose: 'Delete an event (blocked with 409 when booked)' },
    { method: 'GET', path: '/api/events/:id/registrations', purpose: 'Registrations viewer' },
    { method: 'DELETE', path: '/api/registrations/:id', purpose: 'Cancel a booking' },
    { method: 'GET', path: '/api/categories', purpose: 'Category dropdown' },
    { method: 'GET', path: '/api/organisations', purpose: 'Charity dropdown' },
    { method: 'GET', path: '/api/geocode?name=', purpose: 'Find coordinates for a venue (Open-Meteo)' },
  ];

  protected readonly rules = [
    'An event that already has registrations cannot be deleted (HTTP 409) - enforced by the API and by the ON DELETE RESTRICT foreign key.',
    'One attendee e-mail address may register for an event only once (UNIQUE KEY uq_event_email).',
    'The number of tickets must be at least 1 (CHECK constraint).',
    'The amount paid is calculated by the server as ticket price x tickets purchased.',
    'events.current_amount is recalculated from the registrations inside the same transaction.',
  ];
}
