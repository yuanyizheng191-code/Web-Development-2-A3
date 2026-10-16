/**
 * @module routes/events.routes
 * @description
 * routes/events.routes.js
 * RESTful endpoints for the `events` resource.
 *
 *  GET    /api/events                    list + filter + sort (Home / Search)
 *  GET    /api/events/:id                one event WITH its registrations
 *  GET    /api/events/:id/registrations  registrations for one event
 *  POST   /api/events/:id/registrations  register a user for an event
 *  POST   /api/events                    create an event        (admin)
 *  PUT    /api/events/:id                update an event        (admin)
 *  PATCH  /api/events/:id                partial update         (admin)
 *  DELETE /api/events/:id                delete an event, blocked when
 *                                        registrations exist    (admin)
 *
 * The URL design follows REST conventions: the resource collection is
 * /api/events, one item is /api/events/{id}, and the registrations that belong
 * to an event are nested underneath it as a sub-resource.
 *
 */
'use strict';

const express = require('express');
const data = require('../db/data');
const { badRequest, notFound, conflict } = require('../utils/http-error');
const V = require('../utils/validate');

const router = express.Router();

// Helpers

/** Validate the query string of GET /api/events. */
function parseListFilters(q) {
  const filters = {};

  if (q.status !== undefined && q.status !== '') {
    filters.status = V.requireStatus(q.status, 'status');
  }
  if (q.categoryId !== undefined && q.categoryId !== '') {
    filters.categoryId = V.requireIdParam(q.categoryId, 'categoryId');
  }
  if (q.orgId !== undefined && q.orgId !== '') {
    filters.orgId = V.requireIdParam(q.orgId, 'orgId');
  }
  if (q.search !== undefined && String(q.search).trim() !== '') {
    filters.search = V.requireString(q.search, 'search', { max: 100 });
  }
  if (q.sort !== undefined && q.sort !== '') {
    const sort = V.requireString(q.sort, 'sort', { max: 20 });
    const sortKeys = Object.keys(require('../db/events.repo').SORT_MAP);
    if (!sortKeys.includes(sort)) {
      throw badRequest(`"sort" must be one of: ${sortKeys.join(', ')}.`);
    }
    filters.sort = sort;
  }
  if (q.limit !== undefined && q.limit !== '') {
    filters.limit = V.requireNumber(q.limit, 'limit', { min: 1, max: 200, integer: true });
  }
  return filters;
}

/**
 * Build a complete, validated event payload from an incoming request body.
 *
 * @param {object} body      req.body
 * @param {object} [existing] the stored event when updating, so that a full
 *                            PUT and a partial PATCH can share this function
 * @param {boolean} isCreate  true => every required field must be present
 */
function buildEventPayload(body, existing = null, isCreate = false) {
  const pick = (camel, snake) =>
    body[camel] !== undefined ? body[camel] : existing ? existing[snake ?? camel] : undefined;

  // ---- required fields (on create they must come from the body) ----
  const eventName = V.requireString(pick('eventName'), 'eventName', { max: 150 });
  const eventDate = V.requireDateTime(pick('eventDate'), 'eventDate');
  const location = V.requireString(pick('location'), 'location', { max: 200 });

  // ---- optional fields ----
  const description = V.optionalString(pick('description'), 'description', { max: 255 });
  const fullDescription = V.optionalText(pick('fullDescription'), 'fullDescription', { max: 5000 });
  const purpose = V.optionalString(pick('purpose'), 'purpose', { max: 255 });
  const imageUrl = V.optionalString(pick('imageUrl'), 'imageUrl', { max: 300 });

  const ticketPrice = V.optionalNumber(pick('ticketPrice'), 'ticketPrice', 0, { min: 0, max: 100000 });
  const goalAmount = V.optionalNumber(pick('goalAmount'), 'goalAmount', null, { min: 0, max: 100000000 });
  const currentAmount = V.optionalNumber(pick('currentAmount'), 'currentAmount', 0, {
    min: 0,
    max: 100000000,
  });

  const status = isCreate
    ? pick('status') === undefined || pick('status') === ''
      ? 'upcoming'
      : V.requireStatus(pick('status'))
    : V.requireStatus(pick('status') ?? existing?.status ?? 'upcoming');

  const orgId = V.optionalInteger(pick('orgId'), 'orgId', null, { min: 1, max: 999999 });
  const categoryId = V.optionalInteger(pick('categoryId'), 'categoryId', null, { min: 1, max: 999999 });

  const latitude = V.optionalLatitude(pick('latitude'));
  const longitude = V.optionalLongitude(pick('longitude'));

  return {
    eventName,
    description,
    fullDescription,
    eventDate,
    location,
    purpose,
    ticketPrice,
    goalAmount,
    currentAmount,
    imageUrl,
    status,
    orgId,
    categoryId,
    latitude,
    longitude,
  };
}

/**
 * Make sure the chosen organisation / category actually exist.
 * The database would also reject a bad id through its foreign keys, but that
 * would surface as an ugly 500; this turns it into a helpful 400 instead.
 */
async function assertLookupsExist(orgId, categoryId) {
  if (orgId !== null && orgId !== undefined) {
    const orgs = await data.listOrganisations();
    if (!orgs.some((o) => o.orgId === Number(orgId))) {
      throw badRequest(`"orgId" ${orgId} does not match any organisation.`);
    }
  }
  if (categoryId !== null && categoryId !== undefined) {
    const cats = await data.listCategories();
    if (!cats.some((c) => c.categoryId === Number(categoryId))) {
      throw badRequest(`"categoryId" ${categoryId} does not match any category.`);
    }
  }
}

// GET /api/events
router.get('/', async (req, res, next) => {
  try {
    const filters = parseListFilters(req.query);
    const events = await data.listEvents(filters);
    res.json({
      success: true,
      count: events.length,
      filters,
      data: events,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/search
 * CARRIED OVER FROM ASSESSMENT 2.
 *
 * Assessment 2's search page called this endpoint with three optional filters:
 *     /api/events/search?date=2026-11-15&location=Sydney&category=2
 * The endpoint is kept and extended here so the Assessment 3 API is a genuine
 * continuation of the earlier work rather than a replacement, and so any A2
 * front-end code still works against it.
 *
 * A3 extensions:
 *   * `category` also accepts a category NAME (e.g. "gala"), not just an id
 *   * `status` may be supplied, otherwise the A2 restriction to
 *     active + upcoming events is preserved
 *   * `sort` and `limit` are honoured like the main list endpoint
 *
 * IMPORTANT: this route is declared BEFORE '/:id' so that Express matches the
 * literal "search" segment instead of treating it as an event id.
 */
router.get('/search', async (req, res, next) => {
  try {
    const q = req.query;
    const filters = {};

    // ---- date: an exact calendar day -------------------------------------
    if (q.date) {
      const date = V.requireString(q.date, 'date', { max: 10 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw badRequest('"date" must use the format YYYY-MM-DD (for example 2026-11-15).');
      }
      filters.date = date;
    }

    // ---- location: partial venue match -----------------------------------
    if (q.location) {
      filters.location = V.requireString(q.location, 'location', { max: 100 });
    }

    // ---- category: an id OR a name ---------------------------------------
    if (q.category !== undefined && q.category !== '' && q.category !== 'all') {
      const raw = String(q.category).trim();
      if (/^\d+$/.test(raw)) {
        filters.categoryId = V.requireIdParam(raw, 'category');
      } else {
        // Resolve the name to an id so the same SQL path is used either way.
        const categories = await data.listCategories();
        const match = categories.find(
          (c) => c.categoryName.toLowerCase() === raw.toLowerCase(),
        );
        if (!match) {
          throw badRequest(
            `"category" "${raw}" does not match any category. Valid values: ` +
              categories.map((c) => c.categoryName).join(', ') +
              ', or a category id.',
          );
        }
        filters.categoryId = match.categoryId;
      }
    }

    // ---- status: default keeps the Assessment 2 behaviour ----------------
    filters.status = q.status ? V.requireStatus(q.status) : 'active,upcoming';

    if (q.sort) filters.sort = V.requireString(q.sort, 'sort', { max: 20 });
    if (q.limit) filters.limit = V.requireNumber(q.limit, 'limit', { min: 1, max: 200, integer: true });

    const events = await data.listEvents(filters);

    res.json({
      success: true,
      // Echo the filters back so the caller can confirm what was applied.
      filters: {
        date: filters.date ?? null,
        location: filters.location ?? null,
        category: filters.categoryId ?? null,
        status: filters.status,
      },
      count: events.length,
      data: events,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id   ->  event + complete list of its registrations
// Part 2: "Update one of your existing endpoints for a single
// event (by ID) so that it efficiently retrieves not only the event details
// but also the complete list of associated registrations for that specific
// event."  One request gives the Event Detail page everything it needs.
router.get('/:id', async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'event id');
    const event = await data.getEventById(id);

    // ?registrations=none keeps the payload light when the caller only wants
    // the event itself (the admin list does not need 12 rows per event).
    const includeRegistrations = String(req.query.registrations || 'include').toLowerCase() !== 'none';
    const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const registrations = includeRegistrations ? await data.listRegistrations(id, order) : [];

    res.json({
      success: true,
      data: {
        ...event,
        registrations,
        registrationCount: registrations.length || event.registrationCount,
        ticketsSold: includeRegistrations
          ? registrations.reduce((sum, r) => sum + r.ticketsPurchased, 0)
          : event.ticketsSold,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id/registrations
router.get('/:id/registrations', async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'event id');
    await data.getEventById(id); // 404 when the event does not exist
    const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const registrations = await data.listRegistrations(id, order);
    res.json({
      success: true,
      eventId: id,
      order: order === 'asc' ? 'oldest first' : 'latest first',
      count: registrations.length,
      data: registrations,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/registrations   ->  register for an event
router.post('/:id/registrations', async (req, res, next) => {
  try {
    const eventId = V.requireIdParam(req.params.id, 'event id');
    const body = req.body || {};

    const payload = {
      attendeeName: V.requireString(body.attendeeName, 'attendeeName', { max: 100 }),
      email: V.requireEmail(body.email, 'email'),
      phone: V.optionalPhone(body.phone, 'phone'),
      organisation: V.optionalString(body.organisation, 'organisation', { max: 120 }),
      ticketsPurchased: V.requireNumber(body.ticketsPurchased, 'ticketsPurchased', {
        min: 1,
        max: 100,
        integer: true,
      }),
      // Optional: when omitted MySQL stamps the row with CURRENT_TIMESTAMP.
      registrationDate:
        body.registrationDate === undefined || body.registrationDate === ''
          ? null
          : V.requireDateTime(body.registrationDate, 'registrationDate'),
      notes: V.optionalString(body.notes, 'notes', { max: 255 }),
    };

    const created = await data.createRegistration(eventId, payload);

    // Read the new booking straight back so the client can show a receipt.
    const registration = await data.getRegistrationById(created.registrationId);

    res
      .status(201)
      .location(`/api/events/${eventId}/registrations/${created.registrationId}`)
      .json({
        success: true,
        message: `Registration confirmed for ${registration.attendeeName} - ${registration.ticketsPurchased} ticket(s).`,
        data: registration,
      });
  } catch (err) {
    next(err);
  }
});

// POST /api/events   ->  create a new charity event (admin)
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const payload = buildEventPayload(body, null, true);
    await assertLookupsExist(payload.orgId, payload.categoryId);
    const created = await data.createEvent(payload);
    res.status(201).location(`/api/events/${created.eventId}`).json({
      success: true,
      message: `Event "${created.eventName}" was created successfully.`,
      data: created,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id   and   PATCH /api/events/:id
// PUT sends a whole object, PATCH sends only the changed fields.  Both are
// supported because a partial payload is merged over the stored record first.
const updateHandler = async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'event id');
    const existing = await data.getEventById(id); // 404 when unknown
    const payload = buildEventPayload(req.body || {}, existing, false);
    await assertLookupsExist(payload.orgId, payload.categoryId);
    const updated = await data.updateEvent(id, payload);
    res.json({
      success: true,
      message: `Event "${updated.eventName}" was updated successfully.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

router.put('/:id', updateHandler);
router.patch('/:id', updateHandler);

// DELETE /api/events/:id
// Blocked with HTTP 409 when the event already has registrations.  The rule is
// documented in db/events.repo.js and mirrored in db/data.js for demo mode.
router.delete('/:id', async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'event id');
    const removed = await data.deleteEvent(id);
    res.json({
      success: true,
      message: `Event "${removed.eventName}" was deleted successfully.`,
      data: { eventId: removed.eventId, eventName: removed.eventName },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
