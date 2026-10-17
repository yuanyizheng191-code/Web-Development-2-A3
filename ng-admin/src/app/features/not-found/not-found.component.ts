/**
 * features/not-found/not-found.component.ts
 * Shown for any unknown admin URL (the '**' route).
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-not-found',
  imports: [RouterLink],
  template: `
    <div class="state card">
      <p class="code" aria-hidden="true">404</p>
      <h1>That admin page does not exist</h1>
      <p>The address you followed is not part of the admin console.</p>
      <div class="btn-row">
        <a class="btn" routerLink="/dashboard">Go to the dashboard</a>
        <a class="btn btn--secondary" routerLink="/events">Manage events</a>
      </div>
    </div>
  `,
  styles: [
    `
      .code {
        margin: 0;
        font-size: 4rem;
        font-weight: 800;
        line-height: 1;
        color: var(--c-primary);
        opacity: 0.3;
      }
    `,
  ],
})
export class AdminNotFoundComponent {}
