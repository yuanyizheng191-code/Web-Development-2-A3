/**
 * environment.production.ts - SCU cPanel settings
 * On cPanel everything is served from the same account, so a RELATIVE API path
 * is used: the browser resolves '/api/...' against whatever host and subfolder
 * the site was deployed to, which means no URL has to be edited after upload.
 *
 * If the Node application is registered under a sub-path (for example the
 * cPanel "Application root" is `a3api` and the URL is
 * https://host/~user/a3api), then change apiBase to that prefix, e.g.
 *   apiBase: '/~username/a3api/api'
 *
 */
export const environment = {
  production: true,

  /** Relative path - resolves against the deployed host automatically. */
  apiBase: '/api',

  /** Same host, /admin path (see DEPLOYMENT.md). */
  adminUrl: '/admin',

  siteName: 'Charity Events',
  teamId: 'team40',
};
