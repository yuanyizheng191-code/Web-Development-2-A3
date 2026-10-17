/**
 * @module utils/http-error
 * @description
 * A tiny error class that carries an HTTP status code.
 *
 * Routes throw `new HttpError(404, 'Event not found')` and the central error
 * middleware at the end of server.js turns it into a clean JSON response:
 *      { "success": false, "error": { "status": 404, "message": "..." } }
 *
 */
'use strict';

class HttpError extends Error {
  /**
   * @param {number} status  HTTP status code, e.g. 400, 404, 409
   * @param {string} message human readable explanation shown to the client
   * @param {object} [details] optional extra machine readable information
   */
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** 400 - the client sent something the API cannot accept. */
const badRequest = (message, details) => new HttpError(400, message, details);

/** 404 - the requested resource does not exist. */
const notFound = (message) => new HttpError(404, message);

/**
 * 409 - the request is valid but clashes with the current state of the data.
 * Used for the two data-integrity rules:
 *   * deleting an event that already has registrations
 *   * registering the same e-mail address twice for the same event
 */
const conflict = (message, details) => new HttpError(409, message, details);

module.exports = { HttpError, badRequest, notFound, conflict };
