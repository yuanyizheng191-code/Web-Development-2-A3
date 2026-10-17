/**
 * environment.ts - development settings
 * `ng serve` for the client app runs on http://localhost:4200 while the Express
 * API runs on http://localhost:3000, so the full URL is used during development.
 * The production values in environment.production.ts are swapped in
 * automatically by the fileReplacements rule in angular.json.
 *
 */
export const environment = {
  production: false,

  /** Base URL of the Express REST API (no trailing slash). */
  apiBase: 'http://localhost:3000/api',

  /** Where the admin website lives - linked from the client site footer. */
  adminUrl: 'http://localhost:4300',

  /** Shown in the page title and the footer. */
  siteName: 'Charity Events',
  teamId: 'team40',
};
