# PROG2002 A3 - Charity Events API (team40)

Node.js + Express.js + MySQL REST API that powers both the client-side and the
admin-side Angular websites for the charity events case study.

**Team 40** - Yizheng Yuan (24833044), Mu Li (224832355)

---

## 1. Quick start (local)

```bash
# 1. install dependencies
npm install

# 2. create the database (MySQL 8 / XAMPP / cPanel phpMyAdmin)
mysql -u root -p < sql/charityevents_db.sql

# 3. check the database password in config/env.js
#    (see section 2 below - there is no .env file in this project)

# 4. run the API
npm start                     # http://localhost:3000
```

Check it is alive:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/events
```

> **Not in the mood for MySQL?** `USE_DEMO_FALLBACK` is `true` in
> `config/env.js`. If MySQL cannot be reached the API automatically serves the
> bundled sample dataset (read-only) so the Angular sites still work.
> Everything is normal again the moment the database is reachable. Set it to
> `false` to disable the fallback.

---

## 2. Configuration (no .env file)

Unlike many Node projects, **this API does not use a `.env` file or the dotenv
package.** Assessment 2 configured its database by writing the connection
details straight into `event_db.js`, and Assessment 3 keeps that approach so
there is one fewer thing to set up.

All settings are plain JavaScript constants in **`config/env.js`**, grouped into
three sections. `event_db.js` - the file the brief names for Part 1 -
re-exports the same `DB_CONFIG` object, so the connection details are documented
in the two places the brief expects.

### The database block you may need to edit

```js
// api/config/env.js
const DB_CONFIG = {
  host: 'localhost',        // MySQL server address
  port: 3306,               // MySQL port
  user: 'root',             // MySQL username
  password: '2004yyzdlxx',  // MySQL password  <-- change for your own machine
  database: 'charityevents_db',
  connectionLimit: 10,      // pool size
};
```

On **SCU cPanel** the database name and the user are both prefixed with your
account name, for example `youruser_charitydb` and `youruser_a3user`.

### Every setting

| Constant in `config/env.js` | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Local port. cPanel/Passenger supplies its own `PORT`, and `server.js` prefers that when present. |
| `CORS_ORIGINS` | `['http://localhost:4200', 'http://localhost:4300']` | Front-end origins allowed to call the API. Add your cPanel URL here if you host the sites separately. |
| `IS_PRODUCTION` | `process.env.NODE_ENV === 'production'` | Hides internal error messages from clients when true. |
| `DB_CONFIG.host` | `localhost` | MySQL host. |
| `DB_CONFIG.port` | `3306` | MySQL port. |
| `DB_CONFIG.user` | `root` | MySQL user. |
| `DB_CONFIG.password` | *(your password)* | MySQL password. |
| `DB_CONFIG.database` | `charityevents_db` | Database name. |
| `DB_CONFIG.connectionLimit` | `10` | Size of the connection pool. |
| `USE_DEMO_FALLBACK` | `true` | Serve sample data when MySQL is unreachable. |
| `OPEN_METEO_BASE` | `https://api.open-meteo.com/v1/forecast` | External weather API. |
| `WEATHER_TIMEOUT_MS` | `8000` | Weather request timeout. |

> The only environment variables still read anywhere are `NODE_ENV` (set
> automatically by cPanel's Passenger) and `PORT` (also supplied by Passenger).
> Neither needs to be created by hand, and nothing breaks when they are absent.

---

## 3. API endpoints

Base URL locally: `http://localhost:3000` (on cPanel: `https://<host>/api`).

### Health / dashboard / lookups

| Method | Path | Description |
|---|---|---|
| GET | `/api` | Machine-readable index of every endpoint. |
| GET | `/api/health` | Service status + whether MySQL is connected. |
| GET | `/api/dashboard` | Counts and totals for the admin dashboard cards. |
| GET | `/api/categories` | All event categories. |
| GET | `/api/organisations` | All charities. |

### Events (Part 2 - full CRUD)

| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | List every event. Query: `status`, `categoryId`, `orgId`, `search`, `sort`, `limit`. |
| GET | `/api/events/:id` | One event **plus its complete registration list**. Query: `registrations=none`, `order=asc\|desc`. |
| POST | `/api/events` | Create an event (admin). |
| PUT | `/api/events/:id` | Update an event - full payload. |
| PATCH | `/api/events/:id` | Update an event - only the changed fields. |
| DELETE | `/api/events/:id` | Delete an event. **409** when registrations exist. |

`sort` accepts: `date`, `-date`, `name`, `-name`, `price`, `-price`, `created`, `-created`
(`-` = descending).

### Registrations (Part 2 + Part 3)

| Method | Path | Description |
|---|---|---|
| GET | `/api/events/:id/registrations` | Registrations for one event, latest purchase first (`?order=asc` to flip). |
| POST | `/api/events/:id/registrations` | Register a user for an event. |
| GET | `/api/registrations/:id` | One registration. |
| DELETE | `/api/registrations/:id` | Cancel a registration. |

### External weather API (Part 6 - Open-Meteo)

| Method | Path | Description |
|---|---|---|
| GET | `/api/events/:id/weather` | 7-day forecast for the event's stored coordinates. |
| GET | `/api/weather?latitude=-33.87&longitude=151.21` | Forecast for coordinates. |
| GET | `/api/weather?location=Sydney%20Opera%20House` | Geocode a name, then forecast. |
| GET | `/api/geocode?name=Bondi%20Beach` | Coordinates for a place name. |

---

## 4. Response format

Success:

```json
{ "success": true, "count": 8, "data": [ ... ] }
```

Failure:

```json
{ "success": false, "error": { "status": 409, "message": "...", "details": { } } }
```

Status codes used: `200` OK, `201` Created, `400` validation error,
`403` origin not allowed, `404` not found, `409` data-integrity conflict,
`500` server error, `502`/`504` external weather API problem.

---

## 5. Data-integrity rules (Part 2)

1. **An event with registrations cannot be deleted.**
   `DELETE /api/events/1` → `409 Conflict`
   ```json
   {
     "success": false,
     "error": {
       "status": 409,
       "message": "\"City Fun Run 2026\" cannot be deleted because it has 3 registrations. Remove the registrations first, or set the event status to \"suspended\" instead.",
       "details": { "eventId": 1, "registrationCount": 3 }
     }
   }
   ```
   Enforced in the API **and** by `registrations_ibfk_1 ... ON DELETE RESTRICT`,
   so a manual `DELETE FROM events` in MySQL is refused too.

2. **One user may register for an event only once.**
   A repeat POST for the same `event_id` + `email` returns `409`, backed by
   `UNIQUE KEY uq_event_email (event_id, email)`.

3. **Tickets must be at least 1** - `CHECK (tickets_purchased >= 1)`.

4. **Money is calculated by the server**: `total_amount = ticket_price × tickets_purchased`,
   and `events.current_amount` is recalculated from the registrations inside the
   same transaction.

---

## 6. Project layout

```
api/
├── server.js                  Express app, middleware, route mounting, error handler
├── config/env.js              All environment settings in one place
├── db/
│   ├── pool.js                Shared MySQL connection pool + transactions
│   ├── events.repo.js         SQL for the events table (CRUD + delete guard)
│   ├── registrations.repo.js  SQL for the registrations table
│   ├── lookup.repo.js         categories / organisations / dashboard summary
│   └── data.js                Data facade: MySQL or read-only demo fallback
├── routes/
│   ├── events.routes.js       /api/events ...
│   ├── registrations.routes.js/api/registrations ...
│   ├── lookups.routes.js      /api/categories, /api/health ...
│   └── weather.routes.js      /api/weather, /api/events/:id/weather
├── services/weather.service.js Open-Meteo integration
├── data/
│   ├── demo-store.js          Sample dataset used by the fallback
│   └── weather-codes.js       WMO code → description table
├── utils/
│   ├── http-error.js          HttpError helper (400/404/409 ...)
│   └── validate.js            Server-side validation for every field
├── tests/                     API smoke tests (no framework needed)
└── sql/charityevents_db.sql   Complete database + seed data
```

---

## 7. Testing with Postman

Import `postman/PROG2002-A3-API.postman_collection.json`, set the
`baseUrl` variable to `http://localhost:3000`, and run the requests in order -
they include assertions for the 201/400/404/409 cases.
