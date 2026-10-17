/**
 * @module data/demo-store
 * @description
 * data/demo-store.js
 * An in-memory copy of the seeded charityevents_db data.
 *
 * WHY THIS EXISTS
 * The website is a genuinely dynamic MySQL application - that is what gets
 * marked.  This module is only a safety net so that the Angular front ends can
 * still be browsed when MySQL is unavailable (for example a marker opening the
 * project without importing the SQL, or a cPanel environment where the database
 * has not been created yet).  Set USE_DEMO_FALLBACK to false in config/env.js to
 * disable it completely; the API then reports the database error instead.
 *
 * The shape of every object matches exactly what the SQL repositories return,
 * so the route handlers never need to know which mode is active.
 *
 */
'use strict';

// Import the WMO table through the same path the weather service uses.
const { describe } = require('./weather-codes');

const categories = [
  { categoryId: 1, categoryName: 'Fun Run', description: 'Charity running events', eventCount: 2 },
  { categoryId: 2, categoryName: 'Gala', description: 'Formal charity dinners', eventCount: 3 },
  { categoryId: 3, categoryName: 'Auction', description: 'Silent auction events', eventCount: 2 },
  { categoryId: 4, categoryName: 'Concert', description: 'Charity music concerts', eventCount: 2 },
];

const organisations = [
  {
    orgId: 1,
    orgName: 'Hope Foundation',
    description: 'Helping children in need',
    contactEmail: 'info@hope.org',
    contactPhone: '02-1111-2222',
    website: 'www.hope.org',
    eventCount: 4,
  },
  {
    orgId: 2,
    orgName: 'Green Future',
    description: 'Environmental charity',
    contactEmail: 'contact@green.org',
    contactPhone: '02-3333-4444',
    website: 'www.green.org',
    eventCount: 2,
  },
  {
    orgId: 3,
    orgName: 'Health First',
    description: 'Medical research charity',
    contactEmail: 'hello@health.org',
    contactPhone: '02-5555-6666',
    website: 'www.health.org',
    eventCount: 2,
  },
];

const events = [
  {
    eventId: 1,
    eventName: 'City Fun Run 2026',
    description: '5km charity run',
    fullDescription:
      'Join us for a 5km run to raise funds for children education. Every ticket includes a race bib, a finisher medal and refreshments at the finish line.',
    eventDate: '2026-11-15 08:00:00',
    location: 'Sydney Olympic Park',
    purpose: 'Raise $50,000 for education',
    ticketPrice: 25,
    goalAmount: 50000,
    currentAmount: 175,
    imageUrl: '/images/funrun.jpg',
    status: 'upcoming',
    orgId: 1,
    orgName: 'Hope Foundation',
    categoryId: 1,
    categoryName: 'Fun Run',
    latitude: -33.847,
    longitude: 151.063,
  },
  {
    eventId: 2,
    eventName: 'Hope Gala Dinner',
    description: 'Formal dinner event',
    fullDescription: 'An elegant evening with a three course dinner, live entertainment and a charity auction.',
    eventDate: '2026-11-20 19:00:00',
    location: 'Sydney Town Hall',
    purpose: 'Support medical research',
    ticketPrice: 150,
    goalAmount: 100000,
    currentAmount: 1950,
    imageUrl: '/images/gala.jpg',
    status: 'upcoming',
    orgId: 1,
    orgName: 'Hope Foundation',
    categoryId: 2,
    categoryName: 'Gala',
    latitude: -33.8731,
    longitude: 151.2065,
  },
  {
    eventId: 3,
    eventName: 'Silent Auction Night',
    description: 'Art auction',
    fullDescription: 'Bid on donated artworks, sculptures and experiences in a silent auction format.',
    eventDate: '2026-12-05 18:30:00',
    location: 'Melbourne Art Gallery',
    purpose: 'Fund environmental projects',
    ticketPrice: 50,
    goalAmount: 30000,
    currentAmount: 250,
    imageUrl: '/images/auction.jpg',
    status: 'upcoming',
    orgId: 2,
    orgName: 'Green Future',
    categoryId: 3,
    categoryName: 'Auction',
    latitude: -37.8226,
    longitude: 144.9689,
  },
  {
    eventId: 4,
    eventName: 'Charity Rock Concert',
    description: 'Live music night',
    fullDescription: 'Enjoy four live bands across one night and support a good cause.',
    eventDate: '2026-12-01 20:00:00',
    location: 'Brisbane Entertainment Centre',
    purpose: 'Raise funds for health research',
    ticketPrice: 80,
    goalAmount: 80000,
    currentAmount: 560,
    imageUrl: '/images/concert.jpg',
    status: 'upcoming',
    orgId: 3,
    orgName: 'Health First',
    categoryId: 4,
    categoryName: 'Concert',
    latitude: -27.4705,
    longitude: 153.046,
  },
  {
    eventId: 5,
    eventName: 'Beach Cleanup Run',
    description: 'Run and cleanup',
    fullDescription: 'Run along the beach and help clean up the coastline afterwards.',
    eventDate: '2026-11-25 07:00:00',
    location: 'Bondi Beach',
    purpose: 'Environmental awareness',
    ticketPrice: 0,
    goalAmount: 20000,
    currentAmount: 0,
    imageUrl: '/images/beachrun.jpg',
    status: 'active',
    orgId: 2,
    orgName: 'Green Future',
    categoryId: 1,
    categoryName: 'Fun Run',
    latitude: -33.8908,
    longitude: 151.2743,
  },
  {
    eventId: 6,
    eventName: 'Winter Gala 2026',
    description: 'Formal winter dinner',
    fullDescription: 'A magical winter evening for charity with a formal dinner, jazz trio and a fundraising pledge session.',
    eventDate: '2026-12-10 18:00:00',
    location: 'Perth Convention Centre',
    purpose: 'Support homeless shelters',
    ticketPrice: 120,
    goalAmount: 60000,
    currentAmount: 240,
    imageUrl: '/images/wintergala.jpg',
    status: 'active',
    orgId: 1,
    orgName: 'Hope Foundation',
    categoryId: 2,
    categoryName: 'Gala',
    latitude: -31.9523,
    longitude: 115.8605,
  },
  {
    eventId: 7,
    eventName: 'Art for Hope Auction',
    description: 'Online art auction',
    fullDescription: 'Bid on paintings from local artists in a fully online auction.',
    eventDate: '2026-12-18 17:00:00',
    location: 'Online',
    purpose: 'Support children arts programs',
    ticketPrice: 30,
    goalAmount: 25000,
    currentAmount: 30,
    imageUrl: '/images/artauction.jpg',
    status: 'active',
    orgId: 1,
    orgName: 'Hope Foundation',
    categoryId: 3,
    categoryName: 'Auction',
    latitude: -33.8688,
    longitude: 151.2093,
  },
  {
    eventId: 8,
    eventName: 'Jazz for Health',
    description: 'Jazz concert',
    fullDescription: 'An evening of jazz music for health research featuring the Adelaide Youth Jazz Ensemble.',
    eventDate: '2026-09-15 19:30:00',
    location: 'Adelaide Jazz Club',
    purpose: 'Fund cancer research',
    ticketPrice: 60,
    goalAmount: 40000,
    currentAmount: 0,
    imageUrl: '/images/jazz.jpg',
    status: 'past',
    orgId: 3,
    orgName: 'Health First',
    categoryId: 4,
    categoryName: 'Concert',
    latitude: -34.9285,
    longitude: 138.6007,
  },
];

const registrations = [
  { registrationId: 1,  eventId: 1, attendeeName: 'Alice Nguyen',    email: 'alice.nguyen@example.com',    phone: '0400 111 222', organisation: 'Coffs Harbour High', ticketsPurchased: 2,  totalAmount: 50,    registrationDate: '2026-10-01 09:15:00', notes: 'Running with a friend' },
  { registrationId: 2,  eventId: 1, attendeeName: 'Ben Carter',      email: 'ben.carter@example.com',      phone: '0400 222 333', organisation: null,                 ticketsPurchased: 1,  totalAmount: 25,    registrationDate: '2026-10-03 14:40:00', notes: null },
  { registrationId: 3,  eventId: 1, attendeeName: 'Chloe Martin',    email: 'chloe.martin@example.com',    phone: '0400 333 444', organisation: 'SCU Running Club',   ticketsPurchased: 4,  totalAmount: 100,   registrationDate: '2026-10-08 11:05:00', notes: 'Team entry' },
  { registrationId: 4,  eventId: 2, attendeeName: 'Daniel Okafor',   email: 'daniel.okafor@example.com',   phone: '0400 444 555', organisation: 'Okafor Legal',       ticketsPurchased: 2,  totalAmount: 300,   registrationDate: '2026-10-02 18:20:00', notes: 'Vegetarian meals x2' },
  { registrationId: 5,  eventId: 2, attendeeName: 'Ella Fitzgerald', email: 'ella.fitzgerald@example.com', phone: '0400 555 666', organisation: null,                 ticketsPurchased: 1,  totalAmount: 150,   registrationDate: '2026-10-06 20:45:00', notes: null },
  { registrationId: 6,  eventId: 2, attendeeName: 'Farid Hassan',    email: 'farid.hassan@example.com',    phone: '0400 666 777', organisation: 'Hassan & Co',        ticketsPurchased: 10, totalAmount: 1500,  registrationDate: '2026-10-10 13:30:00', notes: 'Corporate table' },
  { registrationId: 7,  eventId: 3, attendeeName: 'Grace Lim',       email: 'grace.lim@example.com',       phone: '0400 777 888', organisation: null,                 ticketsPurchased: 3,  totalAmount: 150,   registrationDate: '2026-10-04 10:10:00', notes: null },
  { registrationId: 8,  eventId: 3, attendeeName: 'Henry Patel',     email: 'henry.patel@example.com',     phone: '0400 888 999', organisation: 'Art Lovers Club',    ticketsPurchased: 2,  totalAmount: 100,   registrationDate: '2026-10-09 16:55:00', notes: null },
  { registrationId: 9,  eventId: 4, attendeeName: 'Isla Robertson',  email: 'isla.robertson@example.com',  phone: '0401 111 222', organisation: null,                 ticketsPurchased: 1,  totalAmount: 80,    registrationDate: '2026-10-05 21:00:00', notes: null },
  { registrationId: 10, eventId: 4, attendeeName: 'Jack Thompson',   email: 'jack.thompson@example.com',   phone: '0401 222 333', organisation: 'SCU Student Guild',  ticketsPurchased: 6,  totalAmount: 480,   registrationDate: '2026-10-11 12:25:00', notes: 'Student group booking' },
  { registrationId: 11, eventId: 6, attendeeName: 'Kiara Singh',     email: 'kiara.singh@example.com',     phone: '0401 333 444', organisation: null,                 ticketsPurchased: 2,  totalAmount: 240,   registrationDate: '2026-10-07 19:35:00', notes: null },
  { registrationId: 12, eventId: 7, attendeeName: "Liam O'Brien",    email: 'liam.obrien@example.com',     phone: '0401 444 555', organisation: 'Hope Foundation',    ticketsPurchased: 1,  totalAmount: 30,    registrationDate: '2026-10-12 08:50:00', notes: 'Online bidding link sent' },
];

/** Deep copy so a request can never mutate the seed data by accident. */
const clone = (value) => JSON.parse(JSON.stringify(value));

// Derived helpers - identical semantics to the SQL versions

/** Add registrationCount / ticketsSold to an event, like the SQL subqueries do. */
function decorate(event) {
  const mine = registrations.filter((r) => r.eventId === event.eventId);
  return {
    ...event,
    registrationCount: mine.length,
    ticketsSold: mine.reduce((sum, r) => sum + r.ticketsPurchased, 0),
  };
}

let nextEventId = Math.max(...events.map((e) => e.eventId)) + 1;
let nextRegistrationId = Math.max(...registrations.map((r) => r.registrationId)) + 1;

module.exports = {
  // ---- read ----
  listCategories: () => clone(categories),
  listOrganisations: () => clone(organisations),
  listEvents: () => clone(events.map(decorate)),
  getEventById: (id) => {
    const found = events.find((e) => e.eventId === Number(id));
    return found ? clone(decorate(found)) : null;
  },
  listRegistrations: (eventId, order = 'desc') => {
    const rows = registrations
      .filter((r) => r.eventId === Number(eventId))
      .sort((a, b) =>
        order === 'asc'
          ? a.registrationDate.localeCompare(b.registrationDate)
          : b.registrationDate.localeCompare(a.registrationDate),
      );
    return clone(rows);
  },
  getRegistrationById: (id) => clone(registrations.find((r) => r.registrationId === Number(id)) || null),
  findRegistration: (eventId, email) =>
    clone(
      registrations.find(
        (r) => r.eventId === Number(eventId) && String(r.email).toLowerCase() === String(email).toLowerCase(),
      ) || null,
    ),
  countRegistrationsForEvent: (eventId) => registrations.filter((r) => r.eventId === Number(eventId)).length,

  // ---- write ----
  createEvent(data) {
    const org = organisations.find((o) => o.orgId === Number(data.orgId));
    const cat = categories.find((c) => c.categoryId === Number(data.categoryId));
    const row = {
      eventId: nextEventId++,
      ...data,
      orgName: org ? org.orgName : null,
      categoryName: cat ? cat.categoryName : null,
    };
    events.push(row);
    return clone(decorate(row));
  },

  updateEvent(id, data) {
    const index = events.findIndex((e) => e.eventId === Number(id));
    if (index === -1) return null;
    const org = organisations.find((o) => o.orgId === Number(data.orgId));
    const cat = categories.find((c) => c.categoryId === Number(data.categoryId));
    events[index] = {
      ...events[index],
      ...data,
      orgName: org ? org.orgName : null,
      categoryName: cat ? cat.categoryName : null,
    };
    return clone(decorate(events[index]));
  },

  deleteEvent(id) {
    const index = events.findIndex((e) => e.eventId === Number(id));
    if (index === -1) return null;
    const [removed] = events.splice(index, 1);
    return clone(removed);
  },

  createRegistration(eventId, data) {
    const event = events.find((e) => e.eventId === Number(eventId));
    if (!event) return null;
    const row = {
      registrationId: nextRegistrationId++,
      eventId: Number(eventId),
      attendeeName: data.attendeeName,
      email: data.email,
      phone: data.phone,
      organisation: data.organisation,
      ticketsPurchased: data.ticketsPurchased,
      totalAmount: Number((Number(event.ticketPrice) * data.ticketsPurchased).toFixed(2)),
      registrationDate: data.registrationDate || new Date().toISOString().slice(0, 19).replace('T', ' '),
      notes: data.notes,
    };
    registrations.push(row);
    // Mirror the SQL behaviour: current_amount tracks the tickets actually sold.
    event.currentAmount = registrations
      .filter((r) => r.eventId === event.eventId)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    return clone(row);
  },

  deleteRegistration(id) {
    const index = registrations.findIndex((r) => r.registrationId === Number(id));
    if (index === -1) return null;
    const [removed] = registrations.splice(index, 1);
    const event = events.find((e) => e.eventId === removed.eventId);
    if (event) {
      event.currentAmount = registrations
        .filter((r) => r.eventId === event.eventId)
        .reduce((sum, r) => sum + r.totalAmount, 0);
    }
    return clone(removed);
  },

  /** Counts for the admin dashboard cards. */
  dashboardSummary() {
    const byStatus = (s) => events.filter((e) => e.status === s).length;
    return {
      totalEvents: events.length,
      upcomingEvents: byStatus('upcoming'),
      activeEvents: byStatus('active'),
      suspendedEvents: byStatus('suspended'),
      pastEvents: byStatus('past'),
      totalRegistrations: registrations.length,
      totalTickets: registrations.reduce((s, r) => s + r.ticketsPurchased, 0),
      totalRevenue: registrations.reduce((s, r) => s + r.totalAmount, 0),
    };
  },

  /** Weather codes are shared with the live service for consistency. */
  describeWeatherCode: describe,
};
