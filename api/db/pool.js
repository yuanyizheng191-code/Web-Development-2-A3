/**
 * @module db/pool
 * @description
 * Creates ONE shared MySQL connection pool for the whole API.
 *
 * A pool is used instead of a single connection because Express handles many
 * requests concurrently; mysql2 hands each query a free connection and puts it
 * back afterwards.  Every query in this project goes through `query()` below,
 * which guarantees parameterised SQL (?) and therefore blocks SQL injection.
 *
 */
'use strict';

const mysql = require('mysql2/promise');
const config = require('../config/env');

// `dateStrings: true` makes the driver return DATETIME as a plain
// 'YYYY-MM-DD HH:MM:SS' string instead of a JavaScript Date.  That removes all
// timezone shifting between the MySQL server, Node and the browser, which is
// exactly the behaviour we want for event dates and registration dates.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4_0900_ai_ci',
});

/** True once a connection to MySQL has been proven. */
let liveDatabaseReady = false;

/** Expose the current mode so routes can decide whether to fall back. */
const isLive = () => liveDatabaseReady;
const markLive = (value) => {
  liveDatabaseReady = value;
};

/**
 * Run a parameterised SQL statement.
 * @param {string} sql    SQL text using ? placeholders
 * @param {Array}  params values bound to the placeholders
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Run several statements inside a single transaction.
 * The callback receives a dedicated connection so the caller can commit or
 * roll back atomically (used when inserting a registration and updating the
 * event's running total).
 */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* the connection may already be gone - nothing useful to do */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Verify the database is reachable.  Called once at start-up so the console
 * clearly reports whether the API is running live or in demo fallback mode.
 */
async function testConnection() {
  try {
    const rows = await query('SELECT DATABASE() AS db, VERSION() AS version');
    liveDatabaseReady = true;
    return { ok: true, database: rows[0].db, version: rows[0].version };
  } catch (err) {
    liveDatabaseReady = false;
    return { ok: false, error: err.message };
  }
}

module.exports = { pool, query, withTransaction, testConnection, isLive, markLive };
