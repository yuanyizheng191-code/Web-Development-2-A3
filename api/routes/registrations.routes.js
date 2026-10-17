/**
 * @module routes/registrations.routes
 * @description
 * routes/registrations.routes.js
 * Top-level access to individual registration records.
 *
 *  GET    /api/registrations/:id   read one registration
 *  DELETE /api/registrations/:id   remove a registration
 *
 * category and registration, but you may do it if you want to" - the delete
 * endpoint is included because it makes the admin workflow complete: staff can
 * cancel a booking and only then is the event itself deletable.
 *
 * Anonymous public "list every registration in the system" is intentionally NOT
 * exposed: registrations contain personal contact details, and the brief's
 * security note asks designers to think about the implications of endpoints.
 * Staff read them through /api/events/:id/registrations instead.
 *
 */
'use strict';

const express = require('express');
const data = require('../db/data');
const V = require('../utils/validate');

const router = express.Router();

/** GET /api/registrations/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'registration id');
    const registration = await data.getRegistrationById(id);
    res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/registrations/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'registration id');
    const removed = await data.deleteRegistration(id);
    res.json({
      success: true,
      message: `Registration ${removed.registrationId} (${removed.attendeeName}) was cancelled.`,
      data: removed,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
