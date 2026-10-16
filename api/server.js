/**
 * server.js - the Express application entry point
 *
 * Charity Events API - Node.js + Express.js + MySQL
 *
 * Run locally:      npm install && npm start        (http://localhost:3000)
 * On SCU cPanel:    set the application startup file to server.js (Passenger)
 *
 * Everything the two Angular front ends need is served from /api:
 *   GET    /api/health
 *   GET    /api/dashboard
 *   GET    /api/categories
 *   GET    /api/organisations
 *   GET    /api/events                  ?status&categoryId&orgId&search&sort&limit
 *   GET    /api/events/:id                        (includes registrations)
 *   GET    /api/events/:id/registrations          ?order=asc|desc
 *   POST   /api/events/:id/registrations          (client-side registration)
 *   POST   /api/events                            (admin create)
 *   PUT    /api/events/:id                        (admin update, full)
 *   PATCH  /api/events/:id                        (admin update, partial)
 *   DELETE /api/events/:id                        (admin delete, 409 if booked)
 *   GET    /api/events/:id/weather                (Open-Meteo, Part 6)
 *   GET    /api/weather?latitude&longitude        (Open-Meteo, Part 6)
 *   GET    /api/weather?location=...              (geocode + forecast)
 *   GET    /api/geocode?name=...                  (coordinate lookup)
 *   GET    /api/registrations/:id
 *   DELETE /api/registrations/:id
 */
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const pool = require('./db/pool');
const data = require('./db/data');
const { HttpError } = require('./utils/http-error');

const eventsRouter = require('./routes/events.routes');
const weatherRoutes = require('./routes/weather.routes');
const registrationsRouter = require('./routes/registrations.routes');
const lookupsRouter = require('./routes/lookups.routes');

const app = express();

// Core middleware

// Behind cPanel/Passenger (and any reverse proxy) this makes req.protocol and
// req.ip reflect the real client instead of the proxy.
app.set('trust proxy', true);
app.disable('x-powered-by');

// Parse JSON bodies.  100kb is plenty for an event or registration payload.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

/**
 * CORS.
 * The Angular client app (4200) and admin app (4300) are served from different
 * origins than the API, so the browser needs explicit permission.  In
 * development every localhost port is accepted; in production only the origins
 * listed in CORS_ORIGINS (config/env.js) are.
 */
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests, curl and Postman send no Origin header.
      if (!origin) return callback(null, true);

      const allowed =
        config.corsOrigins.includes(origin) ||
        (!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

      return allowed
        ? callback(null, true)
        : callback(new HttpError(403, `Origin ${origin} is not allowed to call this API.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 86400,
  }),
);

// Tiny request logger - useful evidence in the demo video that the front end
// really is calling the API for every page.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api')) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`,
      );
    }
  });
  next();
});

// Static hosting
// On cPanel this single Node application serves the API AND both Angular builds,
// which keeps deployment to one "Setup Node.js App" entry (see DEPLOYMENT.md).
// The production builds are copied to public/client and public/admin by
// tools/build_all.ps1; while developing they can simply be absent, because the
// Angular dev servers are used instead.
//
// IMPORTANT: static hosting is mounted BEFORE the API routes so that
// express.static can never intercept an /api request.
const publicDir = path.join(__dirname, 'public');

// Mounted only when the folder exists, so a missing build cannot shadow an API
// route with a stray index.html lookup.
if (fs.existsSync(path.join(publicDir, 'admin'))) {
  app.use('/admin', express.static(path.join(publicDir, 'admin')));
}
if (fs.existsSync(path.join(publicDir, 'client'))) {
  app.use('/', express.static(path.join(publicDir, 'client')));
}

// API routes

// Anything under /api must never fall through to the static handler above.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Event sub-resource: /api/events/:id/weather
app.use('/api/events', weatherRoutes.eventWeatherRouter);

// Main event resource (list, detail, create, update, delete, registration POST)
app.use('/api/events', eventsRouter);

// Weather + geocoding.
// The weather router answers /api/weather (its own index and query endpoints).
// The geocode handler is mounted separately at /api/geocode - it is NOT mounted
// as a second copy of the whole router, because the weather router's "/" index
// handler would then answer GET /api as well.
app.use('/api/weather', weatherRoutes);
app.get('/api/geocode', weatherRoutes.geocodeHandler);

// Registrations, categories, organisations, dashboard, health
app.use('/api/registrations', registrationsRouter);
app.use('/api', lookupsRouter);

// API documentation page at the root of the API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    service: 'PROG2002 A3 - Charity Events API',
    team: 'team40',
    members: ['Yizheng Yuan (24833044)', 'Mu Li (224832355)'],
    stack: ['Node.js', 'Express.js', 'MySQL', 'Angular v22', 'Open-Meteo API'],
    storage: data.storageMode(),
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Service + database status' },
      { method: 'GET', path: '/api/dashboard', description: 'Admin dashboard summary' },
      { method: 'GET', path: '/api/categories', description: 'All event categories' },
      { method: 'GET', path: '/api/organisations', description: 'All charities' },
      { method: 'GET', path: '/api/events', description: 'List/filter/sort events' },
      { method: 'GET', path: '/api/events/:id', description: 'Event details + its registrations' },
      { method: 'GET', path: '/api/events/:id/registrations', description: 'Registrations, latest first' },
      { method: 'POST', path: '/api/events/:id/registrations', description: 'Register for an event' },
      { method: 'POST', path: '/api/events', description: 'Create an event (admin)' },
      { method: 'PUT', path: '/api/events/:id', description: 'Update an event (admin)' },
      { method: 'PATCH', path: '/api/events/:id', description: 'Partially update an event (admin)' },
      { method: 'DELETE', path: '/api/events/:id', description: 'Delete an event (blocked with 409 when booked)' },
      { method: 'GET', path: '/api/events/:id/weather', description: 'Open-Meteo forecast for the venue' },
      { method: 'GET', path: '/api/weather?location=Sydney', description: 'Forecast by place name' },
      { method: 'GET', path: '/api/geocode?name=Bondi%20Beach', description: 'Coordinates for a place' },
      { method: 'GET', path: '/api/registrations/:id', description: 'One registration' },
      { method: 'DELETE', path: '/api/registrations/:id', description: 'Cancel a registration' },
    ],
  });
});

// 404 for unknown API paths (kept away from the SPA fallback below)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      status: 404,
      message: `No API endpoint matches ${req.method} ${req.originalUrl}. See GET /api for the list of endpoints.`,
    },
  });
});

// Single Page Application fallback
// Angular uses client-side routing, so a deep link such as /events/3 or
// /admin/events/edit/5 must still return the matching index.html and let the
// Angular router take over.  express.static above already served every real
// file (main.js, styles.css ...), so the handler below only sees unmatched URLs.
//
// NOTE: Express 5 uses path-to-regexp v8, where a bare "*" is no longer valid -
// the splat must be named ("/*splat") and the SPA check is done with a RegExp,
// which is both clearer and version-independent.
function serveAdminIndex(req, res, next) {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'), (err) => (err ? next() : undefined));
}

function serveClientIndex(req, res, next) {
  const indexFile = path.join(publicDir, 'client', 'index.html');
  // While developing, no Angular build has been copied here yet - answer with a
  // helpful JSON message instead of an ugly ENOENT stack trace.
  if (!fs.existsSync(indexFile)) {
    if (req.path === '/') {
      return res.json({
        success: true,
        message:
          'Charity Events API is running. The Angular front ends are not hosted here yet - ' +
          'run "ng serve" for the client (http://localhost:4200) and the admin app (http://localhost:4300), ' +
          'or copy their dist output into api/public/client and api/public/admin.',
        api: '/api',
        health: '/api/health',
      });
    }
    return res.status(404).json({
      success: false,
      error: {
        status: 404,
        message: `No front-end build is hosted at ${req.path}. Start the Angular dev server, or check GET /api for the endpoint list.`,
      },
    });
  }
  return res.sendFile(indexFile, (err) => (err ? next() : undefined));
}

// Admin deep links first, so they are not swallowed by the client fallback.
app.get(/^\/admin(\/.*)?$/, serveAdminIndex);

// Any other non-API GET is a client-side route (/, /events/3, /search, /register...).
app.get(/^\/(?!api(\/|$))/, serveClientIndex);

// Central error handler
// Every route calls next(err), so all failures end up here and leave the API as
// one consistent JSON shape:
//   { success: false, error: { status, message, details? } }
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Malformed JSON body - express.json() throws a SyntaxError with .status 400.
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      error: { status: 400, message: 'The request body is not valid JSON.' },
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      error: { status: err.status, message: err.message, details: err.details },
    });
  }

  // MySQL error codes that reach this point are genuine server faults.
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    error: {
      status: 500,
      message: config.isProduction
        ? 'An unexpected server error occurred.'
        : `Server error: ${err.message}`,
    },
  });
});

// Start-up
async function start() {
  console.log('');
  console.log('  PROG2002 A3 - Charity Events API');
  console.log('  team40: Yizheng Yuan (24833044), Mu Li (224832355)');
  console.log('  ------------------------------------------------------------');

  const database = await pool.testConnection();
  if (database.ok) {
    console.log(`  Database : CONNECTED to "${database.database}" (MySQL ${database.version})`);
  } else if (config.useDemoFallback) {
    // Trigger the one-time warning and switch to the sample dataset.
    try {
      await data.listEvents({ limit: 1 });
    } catch {
      /* handled inside data.js */
    }
    console.log(`  Database : NOT reachable (${database.error})`);
  } else {
    console.log(`  Database : NOT reachable (${database.error})`);
    console.log('  USE_DEMO_FALLBACK is false, so every /api request will fail until MySQL is fixed.');
  }

  console.log(`  Storage  : ${data.storageMode()}`);
  console.log(`  CORS     : ${config.corsOrigins.join(', ')}`);
  console.log('');

  // PORT is injected by cPanel/Passenger; 3000 is the local default.
  const port = process.env.PORT || config.port;
  app.listen(port, () => {
    console.log(`  API listening on http://localhost:${port}`);
    console.log(`  Health check      http://localhost:${port}/api/health`);
    console.log(`  Endpoint index    http://localhost:${port}/api`);
    console.log('');
  });
}

// Only listen when this file is run directly, so the app can be imported by a
// test runner without opening a port.
if (require.main === module) {
  start();
}

module.exports = { app, start };
