/**
 * @module db/lookup.repo
 * @description
 * db/lookup.repo.js
 * Read-only access to the two lookup tables that the admin forms need:
 *   categories    - used by the "New event" / "Update event" dropdowns
 *   organisations - used by the same dropdowns
 *
 */
'use strict';

const { query } = require('./pool');

/** GET /api/categories - every category, plus how many events use it. */
async function listCategories() {
  const rows = await query(`
    SELECT
      c.category_id   AS categoryId,
      c.category_name AS categoryName,
      c.description   AS description,
      (SELECT COUNT(*) FROM events e WHERE e.category_id = c.category_id) AS eventCount
    FROM categories c
    ORDER BY c.category_name ASC
  `);
  return rows.map((r) => ({ ...r, eventCount: Number(r.eventCount) }));
}

/** GET /api/organisations - every charity, plus how many events it owns. */
async function listOrganisations() {
  const rows = await query(`
    SELECT
      o.org_id        AS orgId,
      o.org_name      AS orgName,
      o.description   AS description,
      o.contact_email AS contactEmail,
      o.contact_phone AS contactPhone,
      o.website       AS website,
      (SELECT COUNT(*) FROM events e WHERE e.org_id = o.org_id) AS eventCount
    FROM organisations o
    ORDER BY o.org_name ASC
  `);
  return rows.map((r) => ({ ...r, eventCount: Number(r.eventCount) }));
}

/**
 * Aggregate figures for the admin dashboard summary cards:
 * total events, registrations, tickets sold and money raised.
 */
async function dashboardSummary() {
  const rows = await query(`
    SELECT
      (SELECT COUNT(*) FROM events)                                  AS totalEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'upcoming')        AS upcomingEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'active')          AS activeEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'suspended')       AS suspendedEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'past')            AS pastEvents,
      (SELECT COUNT(*) FROM registrations)                           AS totalRegistrations,
      (SELECT COALESCE(SUM(tickets_purchased),0) FROM registrations) AS totalTickets,
      (SELECT COALESCE(SUM(total_amount),0) FROM registrations)      AS totalRevenue
  `);
  const r = rows[0];
  return {
    totalEvents: Number(r.totalEvents),
    upcomingEvents: Number(r.upcomingEvents),
    activeEvents: Number(r.activeEvents),
    suspendedEvents: Number(r.suspendedEvents),
    pastEvents: Number(r.pastEvents),
    totalRegistrations: Number(r.totalRegistrations),
    totalTickets: Number(r.totalTickets),
    totalRevenue: Number(r.totalRevenue),
  };
}

module.exports = { listCategories, listOrganisations, dashboardSummary };
