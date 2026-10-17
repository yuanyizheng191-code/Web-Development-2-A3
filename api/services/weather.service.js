/**
 * @module services/weather.service
 * @description
 * services/weather.service.js
 * Integration with the EXTERNAL Open-Meteo API (optional).
 *
 * The API is free and needs no key.  Two Open-Meteo services are used:
 *
 *   1. Forecast          https://api.open-meteo.com/v1/forecast
 *      Supplies the daily weather_code / temperature_2m_max / temperature_2m_min
 *      for a latitude + longitude pair.
 *
 *   2. Geocoding         https://geocoding-api.open-meteo.com/v1/search
 *      Lets the admin site look up coordinates for a typed venue name, which is
 *      how latitude/longitude get filled in when a new event is created.
 *
 * Everything is wrapped so a slow or unavailable Open-Meteo never breaks the
 * charity website: the routes return HTTP 502 with a clear message instead.
 *
 */
'use strict';

const config = require('../config/env');
const { HttpError, badRequest } = require('../utils/http-error');
const { describe } = require('../data/weather-codes');

const geocodingBase = config.openMeteoBase.replace('/v1/forecast', '/v1/search').replace(
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
);

/** Promise-based sleep, used between retry attempts. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch() with a timeout AND automatic retries.
 *
 * Open-Meteo is a free public service and occasionally answers 503 for a
 * fraction of a second.  Without a retry the event page would show an error
 * during a demonstration even though the integration is correct, so transient
 * failures (network error, timeout, HTTP 5xx) are retried up to MAX_ATTEMPTS
 * times with a growing delay (600ms, 1200ms, 1800ms).  A genuine 4xx is never
 * retried.
 *
 * Node 18+ has fetch built in; the AbortController guarantees a hung request
 * cannot freeze a route.
 */
const MAX_ATTEMPTS = 4;

async function fetchJson(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.weatherTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        return await response.json();
      }

      // 4xx means the request itself is wrong - retrying cannot help.
      if (response.status < 500) {
        throw new HttpError(502, `Open-Meteo responded with HTTP ${response.status}.`);
      }

      // 5xx: remember it and try again.
      lastError = new HttpError(502, `Open-Meteo responded with HTTP ${response.status}.`);
    } catch (err) {
      if (err instanceof HttpError && err.status === 502 && /HTTP 4\d\d/.test(err.message)) {
        throw err; // a permanent client error - do not retry
      }
      lastError =
        err.name === 'AbortError'
          ? new HttpError(504, 'The weather service did not respond in time.')
          : new HttpError(502, `Could not reach the weather service: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (attempt < MAX_ATTEMPTS) {
      // 600ms, 1200ms, 1800ms - Open-Meteo occasionally returns 503 for a
      // fraction of a second, so give it a moment before trying again.
      await sleep(600 * attempt);
    }
  }

  // Every attempt failed - report the last reason.
  throw lastError || new HttpError(502, 'The weather service is unavailable.');
}

/**
 * Build the exact forecast URL that the weather API expects:
 * /v1/forecast?latitude=..&longitude=..&daily=weather_code,temperature_2m_max,
 * temperature_2m_min&timezone=Australia%2FSydney
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} forecastDays how many days of forecast to request (1-16)
 * @param {string} timezone      IANA timezone name
 */
async function getForecast(latitude, longitude, forecastDays = 7, timezone = 'Australia/Sydney') {
  const lat = Number(latitude);
  const lon = Number(longitude);

  // Guard rails before spending a network call.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw badRequest('Both "latitude" and "longitude" are required and must be numbers.');
  }
  if (lat < -90 || lat > 90) throw badRequest('"latitude" must be between -90 and 90.');
  if (lon < -180 || lon > 180) throw badRequest('"longitude" must be between -180 and 180.');

  const days = Math.min(Math.max(Number(forecastDays) || 7, 1), 16);

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: String(timezone || 'Australia/Sydney'),
    forecast_days: String(days),
  });

  const url = `${config.openMeteoBase}?${params.toString()}`;
  const raw = await fetchJson(url);

  const daily = raw.daily || {};
  const dates = daily.time || [];

  // Translate the raw parallel arrays into an array of friendly day objects.
  const forecast = dates.map((date, index) => {
    const code = daily.weather_code?.[index];
    const info = describe(code);
    return {
      date,
      weatherCode: code,
      description: info.description,
      icon: info.icon,
      temperatureMax: daily.temperature_2m_max?.[index] ?? null,
      temperatureMin: daily.temperature_2m_min?.[index] ?? null,
    };
  });

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    timezoneAbbreviation: raw.timezone_abbreviation,
    elevation: raw.elevation,
    forecast,
    source: 'Open-Meteo (https://open-meteo.com)',
    requestedUrl: url,
  };
}

/**
 * Look up coordinates for a venue name, e.g. "Sydney Olympic Park".
 * Used by the admin "New event" form to fill latitude/longitude automatically.
 */
async function geocodeLocation(name) {
  if (!name || String(name).trim().length < 2) {
    throw badRequest('A place name of at least two characters is required.');
  }
  const params = new URLSearchParams({
    name: String(name).trim(),
    count: '5',
    language: 'en',
    format: 'json',
  });
  const raw = await fetchJson(`${geocodingBase}?${params.toString()}`);

  const results = (raw.results || []).map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));

  return { query: name, results };
}

module.exports = { getForecast, geocodeLocation };
