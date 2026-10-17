/**
 * environment.production.ts - SCU cPanel settings for the ADMIN website
 * A relative API path is used so the deployed host is resolved automatically.
 * See DEPLOYMENT.md for the .htaccess rules and the /admin sub-path setup.
 *
 */
export const environment = {
  production: true,

  /** Relative path - resolves against the deployed host automatically. */
  apiBase: '/api',

  /** The public client website deployed on the same account. */
  clientUrl: '/',

  siteName: 'Charity Events Admin',
  teamId: 'team40',
};
