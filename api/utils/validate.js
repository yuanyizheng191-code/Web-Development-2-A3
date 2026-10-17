/**
 * @module utils/validate
 * @description
 * Server-side validation helpers.
 *
 * The Angular forms also validate on the client (so users get instant
 * feedback), but a REST API must NEVER trust the browser - anyone can POST to
 * it with Postman or curl.  Every rule is therefore enforced a second time
 * here, and failures become HTTP 400 responses.
 *
 */
'use strict';

const { badRequest } = require('./http-error');

/** Characters that must never reach a redirect/Location header. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Trim a value and confirm it is a non-empty string within a length limit.
 * @returns {string} the trimmed value
 */
function requireString(value, field, { min = 1, max = 255 } = {}) {
  if (value === undefined || value === null) {
    throw badRequest(`"${field}" is required.`);
  }
  const text = String(value).trim();
  if (text.length < min) {
    throw badRequest(`"${field}" is required and cannot be empty.`);
  }
  if (text.length > max) {
    throw badRequest(`"${field}" must be ${max} characters or fewer.`);
  }
  if (CONTROL_CHARS.test(text)) {
    throw badRequest(`"${field}" contains invalid control characters.`);
  }
  return text;
}

/** Optional free text: returns null when the client sent nothing useful. */
function optionalString(value, field, { max = 255 } = {}) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  if (text.length > max) {
    throw badRequest(`"${field}" must be ${max} characters or fewer.`);
  }
  if (CONTROL_CHARS.test(text)) {
    throw badRequest(`"${field}" contains invalid control characters.`);
  }
  return text;
}

/** Optional multi-line text (descriptions). */
function optionalText(value, field, { max = 5000 } = {}) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  if (text.length > max) {
    throw badRequest(`"${field}" must be ${max} characters or fewer.`);
  }
  return text;
}

/** Parse a number, rejecting NaN and out-of-range values. */
function requireNumber(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  if (value === undefined || value === null || value === '') {
    throw badRequest(`"${field}" is required.`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw badRequest(`"${field}" must be a number.`);
  }
  if (integer && !Number.isInteger(n)) {
    throw badRequest(`"${field}" must be a whole number.`);
  }
  if (n < min) throw badRequest(`"${field}" must be at least ${min}.`);
  if (n > max) throw badRequest(`"${field}" must be at most ${max}.`);
  return n;
}

/** Optional number with a fallback when the client omitted it. */
function optionalNumber(value, field, fallback = null, opts = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  return requireNumber(value, field, opts);
}

/** Optional integer within a range. */
function optionalInteger(value, field, fallback = null, opts = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  return requireNumber(value, field, { ...opts, integer: true });
}

// Deliberately pragmatic e-mail pattern: something@something.something
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** Validate a mandatory e-mail address and normalise it to lower case. */
function requireEmail(value, field = 'email') {
  const email = requireString(value, field, { max: 120 }).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw badRequest(`"${field}" must be a valid e-mail address (e.g. name@example.com).`);
  }
  return email;
}

// Australian-friendly phone check: digits, spaces, +, -, ( ) and 8-20 chars.
const PHONE_RE = /^[0-9+()\-\s]{8,20}$/;

/** Validate an optional contact phone number. */
function optionalPhone(value, field = 'phone') {
  const phone = optionalString(value, field, { max: 20 });
  if (phone === null) return null;
  if (!PHONE_RE.test(phone)) {
    throw badRequest(`"${field}" must be a valid phone number (digits, spaces, +, -, brackets).`);
  }
  return phone;
}

/**
 * Validate and normalise a datetime coming from a form or an API client.
 * Accepts 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DD HH:mm:ss' and full
 * ISO strings, and always returns 'YYYY-MM-DD HH:MM:SS' - the exact format
 * MySQL DATETIME columns expect, with no timezone conversion.
 */
function requireDateTime(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw badRequest(`"${field}" is required.`);
  }
  const raw = String(value).trim();

  // Already the canonical MySQL form?
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    // Plain date - the browser date input sends this.
    m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      m = [m[0], m[1], m[2], m[3], '00', '00', '00'];
    }
  }
  if (!m) {
    throw badRequest(`"${field}" must be a valid date/time (YYYY-MM-DD HH:MM:SS).`);
  }

  const [, y, mo, d, hh, mi, ss = '00'] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss);

  if (month < 1 || month > 12) throw badRequest(`"${field}" has an invalid month.`);
  if (day < 1 || day > 31) throw badRequest(`"${field}" has an invalid day.`);
  if (hour > 23 || minute > 59 || second > 59) {
    throw badRequest(`"${field}" has an invalid time.`);
  }
  if (year < 2000 || year > 2100) {
    throw badRequest(`"${field}" must be a year between 2000 and 2100.`);
  }

  const pad = (v) => String(v).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/** Validate an event status against the ENUM defined in the events table. */
const EVENT_STATUSES = ['active', 'suspended', 'past', 'upcoming'];

function requireStatus(value, field = 'status') {
  const status = requireString(value, field, { max: 20 }).toLowerCase();
  if (!EVENT_STATUSES.includes(status)) {
    throw badRequest(`"${field}" must be one of: ${EVENT_STATUSES.join(', ')}.`);
  }
  return status;
}

/** Validate a positive integer path parameter such as /api/events/12. */
function requireIdParam(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`"${field}" must be a positive integer.`);
  }
  return n;
}

/**
 * Validate latitude / longitude.
 * Latitude spans -90..90, longitude -180..180 - needed by Open-Meteo.
 */
function optionalLatitude(value, field = 'latitude') {
  const n = optionalNumber(value, field, null, { min: -90, max: 90 });
  return n === null ? null : Number(n.toFixed(6));
}

function optionalLongitude(value, field = 'longitude') {
  const n = optionalNumber(value, field, null, { min: -180, max: 180 });
  return n === null ? null : Number(n.toFixed(6));
}

module.exports = {
  requireString,
  optionalString,
  optionalText,
  requireNumber,
  optionalNumber,
  optionalInteger,
  requireEmail,
  optionalPhone,
  requireDateTime,
  requireStatus,
  requireIdParam,
  optionalLatitude,
  optionalLongitude,
  EVENT_STATUSES,
};
