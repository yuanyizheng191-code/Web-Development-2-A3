/**
 * @module db/events.repo
 * @description
 * Data access layer for the `events` table.
 *
 * All SQL for charity events lives here so the route handlers stay short and
 * readable.  Every statement is parameterised (?), never string-concatenated,
 * which is how this API defends itself against SQL injection.
 *
 */
'use strict';

const { query, withTransaction } = require('./pool');
const { notFound, conflict } = require('../utils/http-error');

// Shared SELECT projection
// The API returns camelCase JSON, which is what an Angular/TypeScript front end
// expects, while the database keeps its original A2 snake_case names.
// o.org_name / c.category_name are joined in so the client pages can show the
// charity and the category without making a second request.
const EVENT_SELECT = `
  SELECT
    e.event_id          AS eventId,
    e.event_name        AS eventName,
    e.description       AS description,
    e.full_description  AS fullDescription,
    e.event_date        AS eventDate,
    e.location          AS location,
    e.purpose           AS purpose,
    e.ticket_price      AS ticketPrice,
    e.goal_amount       AS goalAmount,
    e.current_amount    AS currentAmount,
    e.image_url         AS imageUrl,
    e.status            AS status,
    e.org_id            AS orgId,
    o.org_name          AS orgName,
    e.category_id       AS categoryId,
    c.category_name     AS categoryName,
    e.latitude          AS latitude,
    e.longitude         AS longitude,
    (SELECT COUNT(*)              FROM registrations r WHERE r.event_id = e.event_id) AS registrationCount,
    (SELECT COALESCE(SUM(r.tickets_purchased),0) FROM registrations r WHERE r.event_id = e.event_id) AS ticketsSold
  FROM events e
  LEFT JOIN organisations o ON o.org_id      = e.org_id
  LEFT JOIN categories    c ON c.category_id = e.category_id
`;

/**
 * Normalise one database row for JSON output.
 * Decimal columns arrive as strings from mysql2 (decimal(10,2)), so they are
 * converted to numbers to keep the Angular models type-safe.
 */
function mapEvent(row) {
  if (!row) return null;
  return {
    ...row,
    ticketPrice: row.ticketPrice === null ? null : Number(row.ticketPrice),
    goalAmount: row.goalAmount === null ? null : Number(row.goalAmount),
    currentAmount: row.currentAmount === null ? 0 : Number(row.currentAmount),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    registrationCount: Number(row.registrationCount ?? 0),
    ticketsSold: Number(row.ticketsSold ?? 0),
  };
}

// Sort options offered by GET /api/events?sort=...
const SORT_MAP = {
  date: 'e.event_date ASC',
  '-date': 'e.event_date DESC',
  name: 'e.event_name ASC',
  '-name': 'e.event_name DESC',
  price: 'e.ticket_price ASC',
  '-price': 'e.ticket_price DESC',
  created: 'e.event_id ASC',
  '-created': 'e.event_id DESC',
};

/**
 * GET /api/events
 * Returns every event, optionally filtered and sorted.
 *
 * @param {object} f filters coming from the query string
 * @param {string} [f.status]        active | suspended | past | upcoming
 * @param {number} [f.categoryId]
 * @param {number} [f.orgId]
 * @param {string} [f.search]        free text matched against name/description/location
 * @param {string} [f.date]          exact calendar date, 'YYYY-MM-DD'
 * @param {string} [f.location]      partial venue name
 * @param {string} [f.sort]          key of SORT_MAP
 * @param {number} [f.limit]
 */
async function listEvents(f = {}) {
  const where = [];
  const params = [];

  if (f.status) {
    // A status filter may be a single value or a comma separated list, which is
    // how the A2 behaviour ("only active and upcoming events") is reproduced.
    const statuses = String(f.status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) {
      where.push('e.status = ?');
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      where.push(`e.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
  }
  if (f.categoryId) {
    where.push('e.category_id = ?');
    params.push(f.categoryId);
  }
  if (f.orgId) {
    where.push('e.org_id = ?');
    params.push(f.orgId);
  }
  if (f.date) {
    // Exact calendar day, the filter the Assessment 2 search page offered.
    where.push('DATE(e.event_date) = ?');
    params.push(f.date);
  }
  if (f.location) {
    // Partial venue match, case-insensitive under the utf8mb4_0900_ai_ci collation.
    where.push('e.location LIKE ?');
    params.push(`%${f.location}%`);
  }
  if (f.search) {
    // One search box searching several text columns (used by the Search page).
    where.push(`(
      e.event_name   LIKE ? OR
      e.description  LIKE ? OR
      e.purpose      LIKE ? OR
      e.location     LIKE ? OR
      c.category_name LIKE ? OR
      o.org_name     LIKE ?
    )`);
    const like = `%${f.search}%`;
    params.push(like, like, like, like, like, like);
  }

  const orderBy = SORT_MAP[f.sort] || SORT_MAP.date;
  const limitSql = f.limit ? 'LIMIT ?' : '';
  if (f.limit) params.push(f.limit);

  const sql = `${EVENT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy} ${limitSql}`;
  const rows = await query(sql, params);
  return rows.map(mapEvent);
}

/** GET /api/events/:id - a single event, or 404 when it does not exist. */
async function getEventById(id) {
  const rows = await query(`${EVENT_SELECT} WHERE e.event_id = ?`, [id]);
  if (!rows.length) throw notFound(`Event ${id} was not found.`);
  return mapEvent(rows[0]);
}

/** Lightweight existence check used by the registrations routes. */
async function findEventRow(id) {
  const rows = await query('SELECT * FROM events WHERE event_id = ?', [id]);
  return rows[0] || null;
}

/**
 * POST /api/events
 * Insert a brand new charity event (admin-side "New event" form).
 * @returns the created event, freshly read back from the database
 */
async function createEvent(data) {
  const sql = `
    INSERT INTO events
      (event_name, description, full_description, event_date, location, purpose,
       ticket_price, goal_amount, current_amount, image_url, status, org_id, category_id,
       latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    data.eventName,
    data.description,
    data.fullDescription,
    data.eventDate,
    data.location,
    data.purpose,
    data.ticketPrice,
    data.goalAmount,
    data.currentAmount,
    data.imageUrl,
    data.status,
    data.orgId,
    data.categoryId,
    data.latitude,
    data.longitude,
  ];
  const result = await query(sql, params);
  return getEventById(result.insertId);
}

/**
 * PUT /api/events/:id
 * Full update of an existing event.  `data` must already contain every column,
 * because the route layer merges the incoming body over the stored record
 * (that merge is what makes PATCH-style partial updates work as well).
 */
async function updateEvent(id, data) {
  await getEventById(id); // throws 404 when the id is unknown

  const sql = `
    UPDATE events SET
      event_name       = ?,
      description      = ?,
      full_description = ?,
      event_date       = ?,
      location         = ?,
      purpose          = ?,
      ticket_price     = ?,
      goal_amount      = ?,
      current_amount   = ?,
      image_url        = ?,
      status           = ?,
      org_id           = ?,
      category_id      = ?,
      latitude         = ?,
      longitude        = ?
    WHERE event_id = ?
  `;
  await query(sql, [
    data.eventName,
    data.description,
    data.fullDescription,
    data.eventDate,
    data.location,
    data.purpose,
    data.ticketPrice,
    data.goalAmount,
    data.currentAmount,
    data.imageUrl,
    data.status,
    data.orgId,
    data.categoryId,
    data.latitude,
    data.longitude,
    id,
  ]);
  return getEventById(id);
}

/**
 * DELETE /api/events/:id
 * DATA INTEGRITY RULE:
 *   "the event can only be deleted if it has not yet received any
 *    registrations.  If registrations exist, the deletion attempt should be
 *    blocked, and an appropriate error response should be returned to the user."
 *
 * The rule is enforced twice, on purpose:
 *   1. here in code, so the admin user receives a friendly HTTP 409 message
 *      that names the number of registrations, and
 *   2. in the schema, where registrations.event_id uses ON DELETE RESTRICT,
 *      so even a careless DELETE FROM events typed straight into MySQL fails.
 */
async function deleteEvent(id) {
  const event = await getEventById(id); // 404 when unknown

  const rows = await query(
    'SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?',
    [id],
  );
  const registrationCount = Number(rows[0].count);

  if (registrationCount > 0) {
    throw conflict(
      `"${event.eventName}" cannot be deleted because it has ${registrationCount} ` +
        `registration${registrationCount === 1 ? '' : 's'}. ` +
        `Remove the registrations first, or set the event status to "suspended" instead.`,
      { eventId: id, registrationCount },
    );
  }

  await query('DELETE FROM events WHERE event_id = ?', [id]);
  return event;
}

/**
 * Recalculate events.current_amount from the registrations that exist.
 *
 * `current_amount` started life in A2 as a manually entered "amount raised so
 * far".  In A3 real registrations are recorded, so the amount raised is derived
 * from them:  SUM(tickets_purchased * ticket_price).
 *
 * Called after every registration insert/delete so the two tables can never
 * disagree.  Runs inside the caller's transaction.
 */
async function recalculateRaisedAmount(conn, eventId) {
  await conn.execute(
    `UPDATE events e
        SET e.current_amount = COALESCE((
              SELECT SUM(r.tickets_purchased * e.ticket_price)
                FROM registrations r
               WHERE r.event_id = e.event_id
            ), 0)
      WHERE e.event_id = ?`,
    [eventId],
  );
}

module.exports = {
  listEvents,
  getEventById,
  findEventRow,
  createEvent,
  updateEvent,
  deleteEvent,
  recalculateRaisedAmount,
  withTransaction,
  EVENT_SELECT,
  SORT_MAP,
};
