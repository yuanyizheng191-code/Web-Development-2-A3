/**
 * app.routes.ts - ADMIN website routes
 *  /                        Dashboard   - summary cards + recent events
 *  /events                  Event list  - every event, any status, with
 *                                         Edit / Registrations / Delete actions
 *  /events/new              New event   - create form + validation
 *  /events/:id/edit         Update      - edit form + associated registrations
 *  /events/:id/registrations Registration viewer for one event
 *  /about                   About       - admin site documentation
 *  **                       Not found
 *
 * Note: static route segments ('new') are matched before parameterised ones
 * (':id'), so /events/new never collides with /events/:id.
 *
 */
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Admin | Dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'events',
    title: 'Admin | Events',
    loadComponent: () => import('./features/event-list/event-list.component').then((m) => m.AdminEventListComponent),
  },
  {
    path: 'events/new',
    title: 'Admin | New event',
    loadComponent: () => import('./features/event-form/event-form.component').then((m) => m.EventFormComponent),
  },
  {
    path: 'events/:id/edit',
    title: 'Admin | Update event',
    loadComponent: () => import('./features/event-form/event-form.component').then((m) => m.EventFormComponent),
  },
  {
    path: 'events/:id/registrations',
    title: 'Admin | Registrations',
    loadComponent: () =>
      import('./features/registrations/registrations.component').then((m) => m.RegistrationsComponent),
  },
  {
    path: 'about',
    title: 'Admin | About',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AdminAboutComponent),
  },
  {
    path: '**',
    title: 'Admin | Page not found',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.AdminNotFoundComponent),
  },
];
