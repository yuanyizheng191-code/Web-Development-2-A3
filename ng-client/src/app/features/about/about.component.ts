/**
 * features/about/about.component.ts
 * Project information page: the team, the technology stack and the API
 * endpoints the site consumes.
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  protected readonly members = [
    { name: 'Yizheng Yuan', studentId: '24833044', role: 'Backend & database (Parts 1-2), deployment' },
    { name: 'Mu Li', studentId: '224832355', role: 'Client site & admin site (Parts 3-4), testing' },
  ];

  protected readonly endpoints = [
    { method: 'GET', path: '/api/events', used: 'Home page, Events & Search page' },
    { method: 'GET', path: '/api/events/:id', used: 'Event Details page (event + registrations)' },
    { method: 'GET', path: '/api/events/:id/registrations', used: 'Registration list ordering' },
    { method: 'POST', path: '/api/events/:id/registrations', used: 'Registration page' },
    { method: 'GET', path: '/api/categories', used: 'Category filter' },
    { method: 'GET', path: '/api/organisations', used: 'Home page charity partners' },
    { method: 'GET', path: '/api/events/:id/weather', used: 'Weather forecast panel (Open-Meteo)' },
    { method: 'GET', path: '/api/health', used: 'Deployment verification' },
  ];
}
