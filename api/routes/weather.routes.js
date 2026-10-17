/**
 * @module routes/weather.routes
 * @description
 * routes/weather.routes.js
 * Part 6 - external Open-Meteo API integration.
 *
 *  GET /api/weather?latitude=-33.87&longitude=151.21           raw forecast
 *  GET /api/weather?location=Sydney%20Opera%20House           geocode + forecast
 *  GET /api/events/:id/weather                                forecast for an
 *                                                             event's venue
 *  GET /api/geocode?name=Bondi%20Beach                        coordinate lookup
 *
 * The event-specific endpoint is deliberately built on top of the stored
 * events.latitude / events.longitude columns, which is why the A3 database
 * upgrade added them.
 *
 */
'use strict';

const express = require('express');
const data = require('../db/data');
const weatherService = require('../services/weather.service');
const { badRequest } = require('../utils/http-error');
const V = require('../utils/validate');

const router = express.Router();

/**
 * GET /api/weather
 * Two ways to use it:
 *   ?latitude=..&longitude=..   coordinates straight from the caller
 *   ?location=Sydney Opera House  geocoded first, then forecast
 * Optional: &days=7&timezone=Australia/Sydney
 */
router.get('/', async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 7;
    const timezone = req.query.timezone ? V.requireString(req.query.timezone, 'timezone', { max: 60 }) : 'Australia/Sydney';

    let latitude = req.query.latitude;
    let longitude = req.query.longitude;
    let resolvedFrom = null;

    // No coordinates supplied?  Turn a place name into coordinates first.
    if ((latitude === undefined || longitude === undefined) && req.query.location) {
      const geo = await weatherService.geocodeLocation(req.query.location);
      if (!geo.results.length) {
        // Open-Meteo's geocoder matches on place names, not addresses - it
        // returns nothing at all for a long, very specific string such as
        // "Sydney Opera House".  Say so clearly instead of failing silently.
        throw badRequest(
          `No location matched "${req.query.location}". ` +
            'Open-Meteo geocodes place names rather than street addresses - ' +
            'try a shorter name such as "Sydney" or "Coffs Harbour".',
        );
      }
      latitude = geo.results[0].latitude;
      longitude = geo.results[0].longitude;
      resolvedFrom = geo.results[0].name;
    }

    if (latitude === undefined || longitude === undefined) {
      throw badRequest(
        'Provide either "latitude" and "longitude", or a "location" name, e.g. /api/weather?location=Sydney.',
      );
    }

    const forecast = await weatherService.getForecast(latitude, longitude, days, timezone);

    res.json({
      success: true,
      resolvedFrom,
      data: forecast,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/geocode?name=...
 * Used by the admin "New event" form's "Find coordinates" button.
 *
 * The same function is mounted at two paths in server.js, because Express
 * strips the mount path before matching and the weather router itself is
 * mounted at /api/weather (where the route path is "/"):
 *      /api/weather/geocode?name=Sydney   (a side effect of the shared router)
 *      /api/geocode?name=Sydney           (the advertised URL)
 */
async function geocodeHandler(req, res, next) {
  try {
    const name = V.requireString(req.query.name, 'name', { max: 120 });
    const result = await weatherService.geocodeLocation(name);
    res.json({ success: true, count: result.results.length, data: result });
  } catch (err) {
    next(err);
  }
}

router.get('/geocode', geocodeHandler);

module.exports = router;

// Exported pieces for server.js
//
//   geocodeHandler    - mounted at /api/geocode
//   eventWeatherRouter- mounted at /api/events so GET /api/events/:id/weather
//                       returns the forecast for a stored event venue
module.exports.geocodeHandler = geocodeHandler;

// Mounted separately in server.js because it hangs off the /api/events path.
const eventWeatherRouter = express.Router({ mergeParams: true });

/**
 * GET /api/events/:id/weather
 * Forecast for the venue of one charity event - this is what the Event Detail
 * page displays so attendees know what the weather will be like on the day.
 */
eventWeatherRouter.get('/:id/weather', async (req, res, next) => {
  try {
    const id = V.requireIdParam(req.params.id, 'event id');
    const event = await data.getEventById(id);

    if (event.latitude === null || event.longitude === null) {
      throw badRequest(
        `"${event.eventName}" does not have coordinates stored yet, so no forecast can be retrieved. ` +
          'Update the event and add its latitude and longitude.',
      );
    }

    const days = req.query.days ? Number(req.query.days) : 7;
    const forecast = await weatherService.getForecast(event.latitude, event.longitude, days, 'Australia/Sydney');

    res.json({
      success: true,
      eventId: event.eventId,
      eventName: event.eventName,
      location: event.location,
      eventDate: event.eventDate,
      data: forecast,
    });
  } catch (err) {
    next(err);
  }
});

module.exports.eventWeatherRouter = eventWeatherRouter;
