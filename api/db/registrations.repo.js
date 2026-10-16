/**
 * @module db/registrations.repo
 * @description
 * db/registrations.repo.js
 * Data access layer for the `registrations` table (NEW in Assessment 3).
 *
 */
'use strict';

const { query, withTransaction } = require('./pool');
const { notFound, conflict } = require('../utils/http-error');
const { recalculateRaisedAmount } = require('./events.repo');

// Registrations are always returned with the most recently purchased ticket
// first - this is the "sorted by the latest date when the tickets were
// purchased" requirement.
const REGISTRATION_SELECT = `
  SELECT
    r.registration_id   AS registrationId,
    r.event_id          AS eventId,
    r.attendee_name     AS attendeeName,
    r.email             AS email,
    r.phone             AS phone,
    r.organisation      AS organisation,
    r.tickets_purchased AS ticketsPurchased,
    r.total_amount      AS totalAmount,
    r.registration_date AS registrationDate,
    r.notes             AS notes
  FROM registrations r
`;

/** Convert decimal strings to numbers so the API returns real JSON numbers. */
function mapRegistration(row) {
  if (!row) return null;
  return {
    ...row,
    ticketsPurchased: Number(row.ticketsPurchased),
    totalAmount: row.totalAmount === null ? 0 : Number(row.totalAmount),
  };
}

/**
 * GET /api/events/:eventId/registrations
 * Complete list of registrations belonging to one event.
 *
 * @param {number} eventId
 * @param {'asc'|'desc'} [order] newest first by default
 */
async function listByEvent(eventId, order = 'desc') {
  const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const rows = await query(
    `${REGISTRATION_SELECT} WHERE r.event_id = ? ORDER BY r.registration_date ${direction}, r.registration_id ${direction}`,
    [eventId],
  );
  return rows.map(mapRegistration);
}

/** GET /api/registrations/:id */
async function getById(id) {
  const rows = await query(`${REGISTRATION_SELECT} WHERE r.registration_id = ?`, [id]);
  if (!rows.length) throw notFound(`Registration ${id} was not found.`);
  return mapRegistration(rows[0]);
}

/**
 * POST /api/events/:eventId/registrations   (the client-side registration form)
 *
 * The whole insert runs inside a transaction together with the
 * `events.current_amount` recalculation, so the registration and the event's
 * running total are always committed as one unit.  If anything fails, MySQL
 * rolls both back and the database stays consistent.
 *
 * @param {number} eventId
 * @param {object} data  already validated by the route layer
 */
async function create(eventId, data) {
  return withTransaction(async (conn) => {
    // 1. The event must exist and must be open for registration.
    const [eventRows] = await conn.execute(
      'SELECT event_id, event_name, ticket_price, status, event_date FROM events WHERE event_id = ?',
      [eventId],
    );
    if (!eventRows.length) {
      throw notFound(`Event ${eventId} was not found.`);
    }
    const event = eventRows[0];

    // 2. Business rule: you cannot buy tickets for a suspended event or one
    //    that has already taken place.
    if (event.status === 'suspended') {
      throw conflict(`"${event.event_name}" is currently suspended and is not accepting registrations.`, {
        eventId,
        status: event.status,
      });
    }
    if (event.status === 'past') {
      throw conflict(`"${event.event_name}" has already taken place and is no longer accepting registrations.`, {
        eventId,
        status: event.status,
      });
    }

    // 3. Business rule from the brief: "one user may register for an event
    //    once".  The UNIQUE KEY uq_event_email enforces it in MySQL as well.
    const [existing] = await conn.execute(
      'SELECT registration_id FROM registrations WHERE event_id = ? AND email = ?',
      [eventId, data.email],
    );
    if (existing.length) {
      throw conflict(
        `${data.email} has already registered for "${event.event_name}". ` +
          `Each attendee may register only once per event.`,
        { eventId, email: data.email, registrationId: existing[0].registration_id },
      );
    }

    // 4. Money is calculated by the server, never trusted from the browser.
    const totalAmount = Number((Number(event.ticket_price) * data.ticketsPurchased).toFixed(2));

    const [result] = await conn.execute(
      `INSERT INTO registrations
         (event_id, attendee_name, email, phone, organisation,
          tickets_purchased, total_amount, registration_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)`,
      [
        eventId,
        data.attendeeName,
        data.email,
        data.phone,
        data.organisation,
        data.ticketsPurchased,
        totalAmount,
        data.registrationDate, // null => MySQL uses CURRENT_TIMESTAMP
        data.notes,
      ],
    );

    // 5. Keep events.current_amount in step with the registrations.
    await recalculateRaisedAmount(conn, eventId);

    return { registrationId: result.insertId, eventId, totalAmount };
  });
}

/**
 * DELETE /api/registrations/:id
 * Included so that ("you are NOT required to create endpoints to
 * manipulate ... registration") but included so the admin site can undo a
 * booking and so the delete-event workflow is demonstrable end to end.
 */
async function remove(id) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT registration_id, event_id, attendee_name FROM registrations WHERE registration_id = ?',
      [id],
    );
    if (!rows.length) throw notFound(`Registration ${id} was not found.`);
    const registration = rows[0];

    await conn.execute('DELETE FROM registrations WHERE registration_id = ?', [id]);
    await recalculateRaisedAmount(conn, registration.event_id);
    return registration;
  });
}

/** Count of registrations for one event - used by the delete-event guard. */
async function countByEvent(eventId) {
  const rows = await query('SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?', [eventId]);
  return Number(rows[0].count);
}

module.exports = { listByEvent, getById, create, remove, countByEvent, mapRegistration };
