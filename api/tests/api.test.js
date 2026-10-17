/**
 * tests/api.test.js
 * End-to-end smoke test for the Charity Events API.
 *
 * It uses nothing but Node's built-in fetch, so there is no test framework to
 * install:   npm test
 *
 *   * events can be listed, filtered and sorted
 *   * a single event returns its complete registration list
 *   * registrations are ordered by the latest purchase date
 *   * full CRUD: create, read, update, delete
 *   * an event with registrations CANNOT be deleted (HTTP 409)
 *   * a duplicate registration for the same event+e-mail is rejected (HTTP 409)
 *   * validation failures return HTTP 400 with a readable message
 *   * the Open-Meteo integration returns translated weather codes
 *
 * Any records it creates are deleted again at the end, so the database is left
 * exactly as it was found.
 *
 *
 * Usage:
 *   node tests/api.test.js [baseUrl]
 *   node tests/api.test.js http://localhost:3000
 */
'use strict';

const BASE = (process.argv[2] || process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Tiny assertion helpers
let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}${extra ? `  -> ${extra}` : ''}`);
  }
}

function section(title) {
  console.log('');
  console.log(`\u2500\u2500 ${title} ${'\u2500'.repeat(Math.max(0, 68 - title.length))}`);
}

/** GET/POST/PUT/PATCH/DELETE returning { status, body }. */
async function request(method, path, body) {
  const options = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, options);
  let parsed = null;
  const text = await response.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

// Unique e-mail for this run so repeated test runs never clash.
const stamp = Date.now();
const testEmail = `a3.smoketest.${stamp}@example.com`;

// The suite
async function run() {
  console.log('');
  console.log('  PROG2002 A3 - API test suite');
  console.log(`  Target: ${BASE}`);

  section('Health, index and lookups');
  {
    const health = await request('GET', '/api/health');
    check('GET /api/health returns 200', health.status === 200, `got ${health.status}`);
    check('health payload reports the service', health.body?.data?.service?.includes('Charity'), JSON.stringify(health.body?.data));
    check('health reports a storage mode', typeof health.body?.data?.storage === 'string', health.body?.data?.storage);

    const index = await request('GET', '/api');
    check('GET /api lists the endpoints', index.status === 200 && Array.isArray(index.body?.endpoints));

    const categories = await request('GET', '/api/categories');
    check('GET /api/categories returns 4 categories', categories.status === 200 && categories.body.count === 4, `count=${categories.body?.count}`);

    const orgs = await request('GET', '/api/organisations');
    check('GET /api/organisations returns 3 charities', orgs.status === 200 && orgs.body.count === 3, `count=${orgs.body?.count}`);

    const dashboard = await request('GET', '/api/dashboard');
    check('GET /api/dashboard returns a summary', dashboard.status === 200 && dashboard.body?.data?.summary?.totalEvents >= 8);
  }

  section('Part 2 - Read: listing, filtering, sorting');
  let originalCount = 0;
  {
    const all = await request('GET', '/api/events');
    originalCount = all.body?.count ?? 0;
    check('GET /api/events returns every event', all.status === 200 && originalCount >= 8, `count=${originalCount}`);
    check('each event carries its organisation name', Boolean(all.body.data[0].orgName));
    check('each event carries its registration count', typeof all.body.data[0].registrationCount === 'number');

    const upcoming = await request('GET', '/api/events?status=upcoming');
    check('?status=upcoming filters correctly', upcoming.body.data.every((e) => e.status === 'upcoming'));

    const byCategory = await request('GET', '/api/events?categoryId=1');
    check('?categoryId=1 filters correctly', byCategory.body.data.every((e) => e.categoryId === 1));

    const search = await request('GET', '/api/events?search=gala');
    check('?search=gala finds the gala events', search.body.count >= 2, `count=${search.body?.count}`);

    const sorted = await request('GET', '/api/events?sort=name');
    const names = sorted.body.data.map((e) => e.eventName);
    check('?sort=name sorts alphabetically', JSON.stringify(names) === JSON.stringify([...names].sort()), names.join(' | '));

    const badSort = await request('GET', '/api/events?sort=banana');
    check('an unknown sort key returns 400', badSort.status === 400, `got ${badSort.status}`);

    const badStatus = await request('GET', '/api/events?status=exploded');
    check('an unknown status returns 400', badStatus.status === 400, `got ${badStatus.status}`);
  }

  section('Carried over from Assessment 2 - /api/events/search');
  // The Assessment 2 search page used this endpoint. It is kept so the A3 API
  // is a genuine continuation rather than a replacement, and so any earlier
  // front-end code still works against it.
  {
    const all = await request('GET', '/api/events/search');
    check('GET /api/events/search returns 200', all.status === 200, `got ${all.status}`);
    check('it defaults to the A2 behaviour (active + upcoming only)', all.body.data.every((e) => ['active', 'upcoming'].includes(e.status)), JSON.stringify(all.body.data?.map((e) => e.status)));
    check('the applied filters are echoed back', all.body.filters?.status === 'active,upcoming', JSON.stringify(all.body.filters));

    const byLocation = await request('GET', '/api/events/search?location=Sydney');
    check('?location= filters by venue', byLocation.status === 200 && byLocation.body.data.every((e) => /sydney/i.test(e.location)), `count=${byLocation.body?.count}`);
    check('the Sydney filter finds at least one event', byLocation.body.count >= 1, `count=${byLocation.body?.count}`);

    const byCategoryId = await request('GET', '/api/events/search?category=1');
    check('?category=<id> filters by category id', byCategoryId.status === 200 && byCategoryId.body.data.every((e) => e.categoryId === 1), `count=${byCategoryId.body?.count}`);

    const byCategoryName = await request('GET', '/api/events/search?category=Fun%20Run');
    check('?category=<name> also works (A3 extension)', byCategoryName.status === 200 && byCategoryName.body.data.every((e) => e.categoryName === 'Fun Run'), `count=${byCategoryName.body?.count}`);

    const byDate = await request('GET', '/api/events/search?date=2026-11-15');
    check('?date= filters to one calendar day', byDate.status === 200 && byDate.body.data.every((e) => e.eventDate.startsWith('2026-11-15')), JSON.stringify(byDate.body.data?.map((e) => e.eventDate)));

    const badDate = await request('GET', '/api/events/search?date=15-11-2026');
    check('a malformed date returns 400', badDate.status === 400, `got ${badDate.status}`);

    const badCategory = await request('GET', '/api/events/search?category=Nonsense');
    check('an unknown category name returns 400 with the valid values', badCategory.status === 400 && /Valid values/.test(badCategory.body?.error?.message || ''), badCategory.body?.error?.message);

    const combined = await request('GET', '/api/events/search?location=Sydney&category=2');
    check('filters combine with AND', combined.status === 200 && combined.body.data.every((e) => /sydney/i.test(e.location) && e.categoryId === 2), `count=${combined.body?.count}`);

    const withPast = await request('GET', '/api/events/search?status=past');
    check('?status=past can override the A2 default', withPast.status === 200 && withPast.body.data.every((e) => e.status === 'past'), `count=${withPast.body?.count}`);
  }

  section('Part 2 + 3 - event detail includes its registrations');
  {
    const detail = await request('GET', '/api/events/1');
    check('GET /api/events/1 returns 200', detail.status === 200, `got ${detail.status}`);
    check('the event includes a registrations array', Array.isArray(detail.body?.data?.registrations));
    check('event 1 has 3 seeded registrations', detail.body.data.registrations.length === 3, `got ${detail.body.data.registrations.length}`);

    const dates = detail.body.data.registrations.map((r) => r.registrationDate);
    const descending = [...dates].sort().reverse();
    check('registrations are sorted latest purchase first', JSON.stringify(dates) === JSON.stringify(descending), dates.join(' | '));

    const none = await request('GET', '/api/events/1?registrations=none');
    check('?registrations=none omits the list', none.body.data.registrations.length === 0);

    const sub = await request('GET', '/api/events/2/registrations?order=asc');
    const ascDates = sub.body.data.map((r) => r.registrationDate);
    check('the registrations sub-resource supports order=asc', JSON.stringify(ascDates) === JSON.stringify([...ascDates].sort()), ascDates.join(' | '));

    const missing = await request('GET', '/api/events/99999');
    check('an unknown event returns 404', missing.status === 404, `got ${missing.status}`);

    const badId = await request('GET', '/api/events/abc');
    check('a non-numeric id returns 400', badId.status === 400, `got ${badId.status}`);
  }

  section('Part 2 - Create (admin)');
  let createdId = null;
  {
    const payload = {
      eventName: `Automated Test Gala ${stamp}`,
      description: 'Created by the automated test suite',
      fullDescription: 'This event is created and deleted by tests/api.test.js to prove the create endpoint works.',
      eventDate: '2027-03-20 18:30:00',
      location: 'Test Venue, Coffs Harbour',
      purpose: 'Automated verification',
      ticketPrice: 45.5,
      goalAmount: 10000,
      imageUrl: 'images/test.jpg',
      status: 'upcoming',
      orgId: 1,
      categoryId: 2,
      latitude: -30.2963,
      longitude: 153.1135,
    };

    const created = await request('POST', '/api/events', payload);
    check('POST /api/events returns 201', created.status === 201, `got ${created.status} ${JSON.stringify(created.body)}`);
    createdId = created.body?.data?.eventId;
    check('the created event has a new id', Number.isInteger(createdId), String(createdId));
    check('the created event kept its ticket price', Number(created.body?.data?.ticketPrice) === 45.5);
    check('the API joined the organisation name', created.body?.data?.orgName === 'Hope Foundation');
    check('the API joined the category name', created.body?.data?.categoryName === 'Gala');

    const readingBack = await request('GET', `/api/events/${createdId}`);
    check('the created event can be read back', readingBack.status === 200 && readingBack.body.data.eventName === payload.eventName);
    check('a brand new event has no registrations', readingBack.body.data.registrations.length === 0);

    const invalid = await request('POST', '/api/events', { description: 'no name, no date' });
    check('a missing event name returns 400', invalid.status === 400, `got ${invalid.status}`);
    check('the 400 response explains the problem', /eventName/.test(invalid.body?.error?.message || ''), invalid.body?.error?.message);

    const badDate = await request('POST', '/api/events', { ...payload, eventDate: 'not-a-date' });
    check('an invalid date returns 400', badDate.status === 400, `got ${badDate.status}`);

    const badOrg = await request('POST', '/api/events', { ...payload, orgId: 4242 });
    check('an unknown orgId returns 400', badOrg.status === 400, `got ${badOrg.status}`);

    const badPrice = await request('POST', '/api/events', { ...payload, ticketPrice: -5 });
    check('a negative ticket price returns 400', badPrice.status === 400, `got ${badPrice.status}`);
  }

  section('Part 2 - Update (admin)');
  {
    const updated = await request('PUT', `/api/events/${createdId}`, {
      eventName: `Automated Test Gala ${stamp} (updated)`,
      description: 'Updated by the test suite',
      fullDescription: 'Updated full description.',
      eventDate: '2027-04-01 19:00:00',
      location: 'Updated Venue, Sydney',
      purpose: 'Automated verification v2',
      ticketPrice: 60,
      goalAmount: 20000,
      status: 'active',
      orgId: 2,
      categoryId: 3,
      latitude: -33.8688,
      longitude: 151.2093,
    });
    check('PUT /api/events/:id returns 200', updated.status === 200, `got ${updated.status}`);
    check('the event name was updated', updated.body?.data?.eventName?.includes('(updated)'));
    check('the status was updated to active', updated.body?.data?.status === 'active');
    check('the organisation was changed to Green Future', updated.body?.data?.orgName === 'Green Future');

    const patched = await request('PATCH', `/api/events/${createdId}`, { ticketPrice: 75 });
    check('PATCH only changes the supplied field', patched.status === 200 && Number(patched.body.data.ticketPrice) === 75, `price=${patched.body?.data?.ticketPrice}`);
    check('PATCH leaves other fields untouched', patched.body.data.location === 'Updated Venue, Sydney');

    const badUpdate = await request('PUT', '/api/events/99999', { eventName: 'Ghost', eventDate: '2027-01-01 10:00:00', location: 'Nowhere' });
    check('updating an unknown event returns 404', badUpdate.status === 404, `got ${badUpdate.status}`);
  }

  section('Part 3 - Registering for an event (client site)');
  let registrationId = null;
  {
    const registration = await request('POST', `/api/events/${createdId}/registrations`, {
      attendeeName: 'Automated Tester',
      email: testEmail,
      phone: '0400 000 111',
      organisation: 'Test Suite',
      ticketsPurchased: 3,
      notes: 'Created by tests/api.test.js',
    });

    check('POST /api/events/:id/registrations returns 201', registration.status === 201, `got ${registration.status} ${JSON.stringify(registration.body)}`);
    registrationId = registration.body?.data?.registrationId;
    check('the registration has an id', Number.isInteger(registrationId));
    check('the server calculated the total (75 x 3 = 225)', Number(registration.body?.data?.totalAmount) === 225, `total=${registration.body?.data?.totalAmount}`);
    check('the API returns a confirmation message', /confirmed/i.test(registration.body?.message || ''), registration.body?.message);
    check('a registration date was stamped', Boolean(registration.body?.data?.registrationDate));

    // The event's running total must now reflect the booking.
    const eventAfter = await request('GET', `/api/events/${createdId}`);
    check('events.current_amount tracks registrations', Number(eventAfter.body.data.currentAmount) === 225, `current=${eventAfter.body.data.currentAmount}`);
    check('the event registration count increased', eventAfter.body.data.registrationCount === 1);

    // ---- duplicate guard -------------------------------------------------
    const duplicate = await request('POST', `/api/events/${createdId}/registrations`, {
      attendeeName: 'Automated Tester',
      email: testEmail,
      ticketsPurchased: 1,
    });
    check('a duplicate registration returns 409', duplicate.status === 409, `got ${duplicate.status}`);
    check('the 409 message mentions the address', (duplicate.body?.error?.message || '').includes(testEmail), duplicate.body?.error?.message);

    // ---- validation ------------------------------------------------------
    const badEmail = await request('POST', `/api/events/${createdId}/registrations`, {
      attendeeName: 'Bad Email',
      email: 'not-an-email',
      ticketsPurchased: 1,
    });
    check('an invalid e-mail returns 400', badEmail.status === 400, `got ${badEmail.status}`);

    const zeroTickets = await request('POST', `/api/events/${createdId}/registrations`, {
      attendeeName: 'Zero',
      email: `zero.${stamp}@example.com`,
      ticketsPurchased: 0,
    });
    check('zero tickets returns 400', zeroTickets.status === 400, `got ${zeroTickets.status}`);

    const fractionalTickets = await request('POST', `/api/events/${createdId}/registrations`, {
      attendeeName: 'Half',
      email: `half.${stamp}@example.com`,
      ticketsPurchased: 1.5,
    });
    check('fractional tickets return 400', fractionalTickets.status === 400, `got ${fractionalTickets.status}`);

    const missingName = await request('POST', `/api/events/${createdId}/registrations`, {
      email: `noname.${stamp}@example.com`,
      ticketsPurchased: 1,
    });
    check('a missing attendee name returns 400', missingName.status === 400, `got ${missingName.status}`);

    const ghostEvent = await request('POST', '/api/events/99999/registrations', {
      attendeeName: 'Ghost',
      email: `ghost.${stamp}@example.com`,
      ticketsPurchased: 1,
    });
    check('registering for an unknown event returns 404', ghostEvent.status === 404, `got ${ghostEvent.status}`);

    // ---- the registration is visible on the detail endpoint --------------
    const detail = await request('GET', `/api/events/${createdId}`);
    check('the new registration appears on the event detail endpoint', detail.body.data.registrations.some((r) => r.email === testEmail));
    check('the newest registration is listed first', detail.body.data.registrations[0].email === testEmail);
  }

  section('Part 2 - Delete guard (data integrity)');
  {
    const blocked = await request('DELETE', `/api/events/${createdId}`);
    check('deleting an event WITH registrations returns 409', blocked.status === 409, `got ${blocked.status}`);
    check('the 409 message explains why', /cannot be deleted/i.test(blocked.body?.error?.message || ''), blocked.body?.error?.message);
    check('the 409 payload reports the count', blocked.body?.error?.details?.registrationCount === 1, JSON.stringify(blocked.body?.error?.details));

    // Still there?
    const stillThere = await request('GET', `/api/events/${createdId}`);
    check('the blocked event still exists', stillThere.status === 200);

    // A seeded event with bookings is also protected.
    const seeded = await request('DELETE', '/api/events/1');
    check('a seeded event with 3 registrations is protected too', seeded.status === 409, `got ${seeded.status}`);
  }

  section('External API (Part 6) - Open-Meteo');
  {
    const forecast = await request('GET', '/api/events/1/weather');
    check('GET /api/events/1/weather returns 200', forecast.status === 200, `got ${forecast.status} ${JSON.stringify(forecast.body)?.slice(0, 160)}`);
    if (forecast.status === 200) {
      const days = forecast.body.data.forecast;
      check('a multi-day forecast is returned', Array.isArray(days) && days.length >= 1, `days=${days?.length}`);
      check('each day is translated into words', typeof days[0].description === 'string' && days[0].description.length > 3, days[0]?.description);
      check('each day has max/min temperatures', days[0].temperatureMax !== null && days[0].temperatureMin !== null);
      check('the source is credited', /open-meteo/i.test(forecast.body.data.source || ''));
    }

    // Open-Meteo geocodes PLACE names, so a plain town name is used here.
    const byName = await request('GET', '/api/weather?location=Coffs%20Harbour&days=3');
    check('GET /api/weather?location=... geocodes and forecasts', byName.status === 200, `got ${byName.status}`);
    if (byName.status === 200) {
      check('the geocoded place is reported back', Boolean(byName.body.resolvedFrom), byName.body.resolvedFrom);
      check('the forecast covers the requested days', byName.body.data.forecast.length === 3, `len=${byName.body.data.forecast.length}`);
    }

    const noMatch = await request('GET', '/api/weather?location=zzzznotaplace');
    check('an unknown place name returns 400 with guidance', noMatch.status === 400 && /shorter name/i.test(noMatch.body?.error?.message || ''), noMatch.body?.error?.message);

    const geocode = await request('GET', '/api/geocode?name=Bondi%20Beach');
    check('GET /api/geocode returns coordinates', geocode.status === 200 && geocode.body.data.results.length > 0, `got ${geocode.status}`);

    const missingCoords = await request('GET', '/api/weather');
    check('GET /api/weather without coordinates returns 400', missingCoords.status === 400, `got ${missingCoords.status}`);

    const badCoords = await request('GET', '/api/weather?latitude=999&longitude=0');
    check('an out-of-range latitude returns 400', badCoords.status === 400, `got ${badCoords.status}`);
  }

  section('Clean up and general behaviour');
  {
    // Cancel the registration so the event becomes deletable - this also
    // exercises the registration delete endpoint.
    const cancelled = await request('DELETE', `/api/registrations/${registrationId}`);
    check('DELETE /api/registrations/:id returns 200', cancelled.status === 200, `got ${cancelled.status}`);

    const afterCancel = await request('GET', `/api/events/${createdId}`);
    check('current_amount is recalculated after cancelling', Number(afterCancel.body.data.currentAmount) === 0, `current=${afterCancel.body.data.currentAmount}`);

    // Now the delete must succeed.
    const deleted = await request('DELETE', `/api/events/${createdId}`);
    check('deleting an event with no registrations returns 200', deleted.status === 200, `got ${deleted.status} ${JSON.stringify(deleted.body)}`);

    const gone = await request('GET', `/api/events/${createdId}`);
    check('the deleted event is really gone (404)', gone.status === 404, `got ${gone.status}`);

    const finalCount = await request('GET', '/api/events');
    check('the event count is back to the original', finalCount.body.count === originalCount, `${finalCount.body.count} vs ${originalCount}`);

    // Security / robustness
    const unknown = await request('GET', '/api/does-not-exist');
    check('an unknown API path returns a JSON 404', unknown.status === 404 && unknown.body?.success === false);

    const injection = await request('GET', `/api/events?search=${encodeURIComponent("' OR 1=1 --")}`);
    check('a SQL-injection attempt is handled safely', injection.status === 200 && injection.body.count === 0, `count=${injection.body?.count}`);

    const badJson = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is not json',
    });
    check('malformed JSON returns 400', badJson.status === 400, `got ${badJson.status}`);
  }

  // Summary
  console.log('');
  console.log('\u2500'.repeat(72));
  console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
  if (failed) {
    console.log('');
    console.log('  Failing checks:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log('\u2500'.repeat(72));
  console.log('');

  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error('');
  console.error('  The test suite could not complete.');
  console.error(`  ${err.message}`);
  console.error('');
  console.error(`  Is the API running at ${BASE}?  Start it with:  npm start`);
  console.error('');
  process.exit(1);
});
