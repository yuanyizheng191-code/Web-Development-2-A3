/**
 * @module event_db
 * @description
 * The database entry point named by the assessment brief:
 * "Update your Node.js file (event_db.js) to reflect the changes in your
 * database schema."
 *
 * HOW TO CONFIGURE THE DATABASE
 * The connection details are written directly in the DB_CONFIG block below,
 * exactly like Assessment 2 did - there is no .env file to create and no
 * dotenv package to install. To use the project on another computer, or on
 * SCU cPanel, edit the values in that one block and nothing else.
 *
 * WHY THIS FILE NOW EXPORTS A POOL INSTEAD OF A SINGLE CONNECTION
 * Assessment 2 opened one connection and exported it:
 *
 *     const connection = mysql.createConnection({ ... });
 *     module.exports = connection;
 *
 * That design cannot support Assessment 3 for two reasons:
 *   1. one shared connection is not safe for the concurrent requests that the
 *      new write endpoints (create / update / delete) produce;
 *   2. the registration insert must run inside a TRANSACTION together with the
 *      recalculation of `events.current_amount`, which needs a dedicated
 *      connection that can be committed or rolled back.
 *
 * So the connection became a pool (defined in db/pool.js), and this file stays
 * the single place where the database is configured, and the entry point that
 * the rest of the application requires.
 *
 * The schema change itself - the new `registrations` table - is in
 * sql/charityevents_db.sql, and the SQL that uses it is in
 * db/registrations.repo.js.
 *
 */
'use strict';

// The configuration lives in config/env.js and is re-exported here so that this
// file is the single documented place described as ("update your
// Node.js file, event_db.js"). Importing rather than redefining also prevents
// the connection details from drifting out of step in two files.
const { db: DB_CONFIG } = require('./config/env');
const pool = require('./db/pool');

/**
 * The result of a connectivity check.
 *
 * Declared as a typedef rather than an inline object type because JSDoc's type
 * parser does not accept optional-property markers inside a `@returns`
 * expression - it fails with "Invalid type expression".
 *
 * @typedef {object} ConnectionStatus
 * @property {boolean} ok         True when MySQL answered the test query.
 * @property {string} [database]  The connected schema name, when ok is true.
 * @property {string} [version]   The MySQL server version, when ok is true.
 * @property {string} [error]     The failure message, when ok is false.
 */

module.exports = {
  /**
   * The database connection settings currently in use.
   *
   * Exported so that `db/pool.js` and `config/env.js` read the configuration
   * from this single place instead of repeating it: change a value here and the
   * whole application follows.
   *
   * @type {{host: string, port: number, user: string, password: string, database: string}}
   */
  DB_CONFIG,

  /**
   * The shared mysql2 connection pool.
   *
   * Typed as `external:Pool` rather than TypeScript's `import('mysql2/promise').Pool`
   * because JSDoc's type-expression parser does not accept the `import(...)` form
   * and reports "Invalid type expression".
   *
   * @type {external:Pool}
   */
  pool: null,

  /**
   * Run a parameterised SQL statement.
   *
   * @param {string} sql SQL text using `?` placeholders. Never build this string
   *   from user input - pass the values through `params` instead.
   * @param {Array<*>} [params=[]] Values bound to the placeholders.
   * @returns {Promise<Array<object>>} The result rows.
   * @throws {Error} When MySQL rejects the statement.
   * @example
   * const events = await db.query('SELECT * FROM events WHERE status = ?', ['upcoming']);
   */
  query: null,

  /**
   * Run several statements inside one transaction.
   *
   * @param {function(external:PoolConnection): Promise<*>} work Callback that
   *   receives a dedicated connection and returns its result.
   * @returns {Promise<*>} Whatever the callback returned, once committed.
   * @throws {Error} After rolling back, if the callback throws.
   */
  withTransaction: null,

  /**
   * Verify the database is reachable.
   *
   * @returns {Promise<ConnectionStatus>} Whether the connection succeeded, plus
   *   the schema name and server version, or the failure message.
   */
  testConnection: null,

  /**
   * Whether a live connection has been proven this run.
   *
   * @returns {boolean} True once a query has succeeded against MySQL.
   */
  isLive: null,
};

// The real implementations come from the db package. They are assigned after the
// object literal so that the documentation above stays readable and in one block.
module.exports.pool = pool.pool;
module.exports.query = pool.query;
module.exports.withTransaction = pool.withTransaction;
module.exports.testConnection = pool.testConnection;
module.exports.isLive = pool.isLive;
