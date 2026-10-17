/**
 * The root component of the client website - the application shell.
 *
 * It holds the three page segments that must be common to every page - the
 * Header, the Nav and the Footer - around a `<router-outlet />` that supplies
 * the per-page Body segment. See `app.html` for the marked-up segment
 * boundaries and `src/index.html` for the document skeleton that explains the
 * segmentation.
 *
 * It renders once for the lifetime of the application: Angular swaps only the
 * routed page into the outlet, so the header, menu and footer are never
 * re-created. That is what keeps them identical on every page.
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
  /** Site name shown in the header and footer. @type {string} */
  protected readonly siteName = environment.siteName;

  /** Link to the admin website, opened in a new tab. @type {string} */
  protected readonly adminUrl = environment.adminUrl;

  /** Team identifier shown in the footer. @type {string} */
  protected readonly teamId = environment.teamId;

  /** Current year for the copyright line, evaluated once. @type {number} */
  protected readonly year = new Date().getFullYear();

  /**
   * Whether the mobile navigation menu is expanded.
   *
   * Held in a signal so the template (and therefore Angular's zoneless change
   * detection) reacts to the toggle without any manual subscription.
   *
   * @type {import('@angular/core').WritableSignal<boolean>}
   */
  protected readonly menuOpen = signal(false);

  /**
   * Open or close the mobile navigation menu.
   *
   * @returns {void}
   */
  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /**
   * Close the mobile navigation menu.
   *
   * Called when a navigation link is followed, so the menu does not stay open
   * over the newly loaded page on a small screen.
   *
   * @returns {void}
   */
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
