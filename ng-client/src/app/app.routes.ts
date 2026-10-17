/**
 * app.routes.ts
 * Client-side website routes.
 *
 *  /                    Home          - hero, featured events, charities
 *  /events              All events    - the complete event listing
 *  /events/:id          Event details - full information + registration list
 *                                        + Open-Meteo weather forecast
 *  /register            Registration  - pick an event (query string ?eventId=)
 *  /about               About         - team, tech stack, project notes
 *  **                   Not found
 *
 */
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Charity Events | Home',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'events',
    title: 'Charity Events | Browse events',
    loadComponent: () => import('./features/event-list/event-list.component').then((m) => m.EventListComponent),
  },
  {
    // The Event Details page, with its registration list.
    path: 'events/:id',
    title: 'Charity Events | Event details',
    loadComponent: () => import('./features/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
  },
  {
    path: 'register',
    title: 'Charity Events | Register',
    loadComponent: () => import('./features/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'about',
    title: 'Charity Events | About',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: '**',
    title: 'Charity Events | Page not found',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
