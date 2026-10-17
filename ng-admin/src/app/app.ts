/**
 * The root component of the admin console - the application shell.
 *
 * A sidebar layout that holds the three page segments common to every admin
 * page - Header (top bar), Nav (sidebar menu) and Footer - around a
 * `<router-outlet />` that supplies the per-page Body segment. See `app.html`
 * for the marked-up segment boundaries and `src/index.html` for the document
 * skeleton that explains the segmentation.
 *
 * because the sidebar lives here, outside the router outlet, it is rendered once
 * and never re-created as staff move between pages.
 *
 *
 * @module app
 */
import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Console title shown in the top bar. @type {string} */
  protected readonly siteName = environment.siteName;

  /** Link to the public website, opened in a new tab. @type {string} */
  protected readonly clientUrl = environment.clientUrl;

  /** Team identifier shown in the footer. @type {string} */
  protected readonly teamId = environment.teamId;

  /** Current year for the copyright line, evaluated once. @type {number} */
  protected readonly year = new Date().getFullYear();

  /**
   * Whether the sidebar is expanded on a small screen.
   * @type {import('@angular/core').WritableSignal<boolean>}
   */
  protected readonly sidebarOpen = signal(false);

  /**
   * Expand or collapse the sidebar.
   *
   * @returns {void}
   */
  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  /**
   * Collapse the sidebar.
   *
   * Called after a navigation link is followed so the menu does not cover the
   * page the user just opened.
   *
   * @returns {void}
   */
  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
