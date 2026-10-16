/**
 * @module config/env
 * @description
 * All configuration for the API, written as plain JavaScript constants.
 *
 * There is deliberately NO .env file and NO dotenv package in this project.
 * Assessment 2 configured the database by writing the connection details
 * straight into event_db.js, and Assessment 3 keeps that approach: the values
 * live here (and in event_db.js's DB_CONFIG block, which re-exports the same
 * object) so that deploying to SCU cPanel means editing this one file.
 *
 * Configuration is split into three sections:
 *   SERVER   - the HTTP port and which front-end origins may call the API
 *   DATABASE - the MySQL connection details (also exposed by event_db.js)
 *   FEATURES - behaviour switches and the external weather API
 *
 */
'use strict';

// SERVER

/**
 * The TCP port the API listens on.
 *
 * Locally 3000 is used. On SCU cPanel, Phusion Passenger supplies its own port
 * through the PORT environment variable, which is why `server.js` prefers
 * `process.env.PORT` and falls back to this value.
 *
 * @constant {number}
 */
const PORT = 3000;

/**
 * Front-end origins allowed to call this API from a browser.
 *
 * The two Angular development servers run on 4200 and 4300. In production both
 * websites are served from the SAME origin as the API, so they appear in this
 * list only if you host them separately. Add your cPanel URL, for example
 * 'https://tomsy-scm-01.scu.edu.au'.
 *
 * @constant {Array<string>}
 */
const CORS_ORIGINS = ['http://localhost:4200', 'http://localhost:4300'];

/**
 * True when the application is running on the server rather than a laptop.
 * Passenger sets NODE_ENV=production, which the error handler uses to decide
 * whether to reveal internal error messages to the client.
 *
 * @constant {boolean}
 */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// DATABASE  --  EDIT THE VALUES IN THIS BLOCK
/**
 * MySQL connection details.
 *
 * Local MySQL / XAMPP default: user 'root', password empty or your own.
 * SCU cPanel: the database name AND the user are prefixed with your account
 *             name, for example  youruser_charitydb  and  youruser_a3user.
 *
 * @constant {{host: string, port: number, user: string, password: string,
 *             database: string, connectionLimit: number}}
 */
const DB_CONFIG = {
  host: 'localhost', // MySQL server address
  port: 3306, // MySQL port
  user: 'root', // MySQL username
  password: '2004yyzdlxx', // MySQL password (change for your own machine)
  database: 'charityevents_db', // database name

  /**
   * How many connections the pool keeps open. Express serves many requests at
   * once, so a pool is used instead of a single connection.
   */
  connectionLimit: 10,
};

// FEATURES

/**
 * Serve the bundled sample dataset when MySQL cannot be reached.
 *
 * The website is a genuinely dynamic MySQL application - that is what gets
 * marked - so this is only a safety net that lets the front ends be browsed
 * before the database has been imported. Writes are refused while it is active,
 * and the API prints a loud warning on start-up. Set to false to disable it.
 *
 * @constant {boolean}
 */
const USE_DEMO_FALLBACK = true;

/**
 * Base URL of the Open-Meteo forecast API (optional).
 * The service is free and needs no API key.
 *
 * @constant {string}
 */
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * How long to wait for Open-Meteo before giving up, in milliseconds.
 * @constant {number}
 */
const WEATHER_TIMEOUT_MS = 8000;

module.exports = {
  port: PORT,
  isProduction: IS_PRODUCTION,

  /** @type {Array<string>} */
  corsOrigins: CORS_ORIGINS,

  /** Referenced by db/pool.js and re-exported by event_db.js. */
  db: DB_CONFIG,

  useDemoFallback: USE_DEMO_FALLBACK,
  openMeteoBase: OPEN_METEO_BASE,
  weatherTimeoutMs: WEATHER_TIMEOUT_MS,
};
