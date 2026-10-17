/**
 * features/not-found/not-found.component.ts
 * Shown for any unknown URL (the '**' route).
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container">
        <div class="state">
          <p class="not-found__code" aria-hidden="true">404</p>
          <h1>We could not find that page</h1>
          <p>
            The address you followed does not match any page on the charity events website.
            It may have been an event that no longer exists.
          </p>
          <div class="btn-row">
            <a class="btn" routerLink="/">Back to the home page</a>
            <a class="btn btn--secondary" routerLink="/events">Browse all events</a>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .not-found__code {
        margin: 0;
        font-size: 4.5rem;
        font-weight: 800;
        line-height: 1;
        color: var(--c-primary);
        opacity: 0.35;
      }
    `,
  ],
})
export class NotFoundComponent {}
