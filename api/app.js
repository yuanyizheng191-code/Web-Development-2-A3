/**
 * app.js - the file cPanel's "Setup Node.js App" expects
 *
 * cPanel's Node.js selector (Phusion Passenger) asks for an "Application startup
 * file" and, from the directory listing it shows, `app.js` is the conventional
 * choice. The real application lives in server.js, so this file exists purely to
 * start it. That keeps a single source of truth: running `node server.js` on a
 * laptop and running this file through Passenger execute exactly the same code.
 *
 * Passenger details handled here:
 *   * Passenger injects the port through the PORT environment variable (or uses a
 *     unix socket via PASSENGER_SOCKET) - server.js already honours PORT.
 *   * Passenger calls `require()` on this file, which is why server.js only
 *     starts listening when it is run directly OR when `start()` is called.
 */
'use strict';

// Passenger sets NODE_ENV=production for a Node.js application.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('PROG2002 A3 API - starting through app.js (cPanel / Passenger entry point)');

const { start } = require('./server');

start().catch((err) => {
  console.error('The API failed to start:', err);
  process.exit(1);
});
