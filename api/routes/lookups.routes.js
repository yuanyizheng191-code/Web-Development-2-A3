/**
 * @module routes/lookups.routes
 * @description
 * routes/lookups.routes.js
 * Reference data used to populate the admin dropdowns, plus a small dashboard
 * summary and the health check.
 *
 *  GET /api/categories      all event categories
 *  GET /api/organisations   all charities
 *  GET /api/dashboard       counts and totals for the admin dashboard cards
 *  GET /api/health          is the API alive, and is it using MySQL?
 *
 */
'use strict';

const express = require('express');
const data = require('../db/data');
const pool = require('../db/pool');

const router = express.Router();

/** GET /api/categories */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await data.listCategories();
    res.json({ success: true, count: categories.length, data: categories });
  } catch (err) {
    next(err);
  }
});

/** GET /api/organisations */
router.get('/organisations', async (req, res, next) => {
  try {
    const organisations = await data.listOrganisations();
    res.json({ success: true, count: organisations.length, data: organisations });
  } catch (err) {
    next(err);
  }
});

/** GET /api/dashboard - summary numbers for the admin home screen. */
router.get('/dashboard', async (req, res, next) => {
  try {
    const summary = await data.dashboardSummary();
    const events = await data.listEvents({ sort: '-created', limit: 5 });
    res.json({
      success: true,
      data: {
        summary,
        recentEvents: events,
        storage: data.storageMode(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/health
 * Handy while deploying to cPanel: it proves the Node app started and tells
 * you whether it can see the MySQL database.
 */
router.get('/health', async (req, res) => {
  const database = await pool.testConnection();
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'PROG2002 A3 Charity Events API',
      team: 'team40',
      time: new Date().toISOString(),
      storage: data.storageMode(),
      demoFallbackEnabled: require('../config/env').useDemoFallback,
      database: database.ok
        ? { connected: true, name: database.database, version: database.version }
        : { connected: false, error: database.error },
    },
  });
});

module.exports = router;
