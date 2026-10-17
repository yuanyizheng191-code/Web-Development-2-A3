/**
 * environment.ts - development settings for the ADMIN website
 * The admin app runs on http://localhost:4300 during development while the API
 * listens on http://localhost:3000.
 *
 */
export const environment = {
  production: false,

  /** Base URL of the Express REST API (no trailing slash). */
  apiBase: 'http://localhost:3000/api',

  /** Where the public client website lives - linked from the admin header. */
  clientUrl: 'http://localhost:4200',

  siteName: 'Charity Events Admin',
  teamId: 'team40',
};
