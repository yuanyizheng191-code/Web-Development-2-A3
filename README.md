# PROG2002 Web Development II — Assessment 3

**Complete dynamic charity events website**

| | |
|---|---|
| **Unit** | PROG2002 Web Development II |
| **Assessment** | Assessment 3 — Website (complete dynamic website), 40% |
| **Team** | **team40** |
| **Members** | Yizheng Yuan (24833044) · Mu Li (224832355) |
| **Due** | 12 October 2026, 11:59 pm AEST/AEDT |

---

## What has been built

A full-stack charity events platform in three parts, all talking to one MySQL
database through one REST API:

```
┌──────────────────────┐        ┌──────────────────────┐
│  CLIENT WEBSITE      │        │  ADMIN CONSOLE       │
│  Angular v22         │        │  Angular v22         │
│  • Home              │        │  • Dashboard         │
│  • Events + search   │        │  • Event list (CRUD) │
│  • Event details     │        │  • New / Update form │
│  • Registration      │        │  • Registrations     │
└──────────┬───────────┘        └──────────┬───────────┘
           │            HTTP / JSON        │
           └───────────────┬───────────────┘
                           ▼
              ┌────────────────────────────┐
              │  REST API                  │
              │  Node.js 24 + Express 5    │
              │  mysql2 connection pool    │
              │  • full CRUD for events    │
              │  • event + registrations   │
              │  • delete integrity guard  │
              │  • Open-Meteo weather      │
              └────────────┬───────────────┘
                           ▼
              ┌────────────────────────────┐
              │  MySQL 8                   │
              │  categories                │
              │  organisations             │
              │  events                    │
              │  registrations   (new)     │
              └────────────────────────────┘
```

**The extra work beyond the minimum requirements** — the client site, the admin
site and the API are all written in TypeScript, and both websites are built with
**Angular v22** (standalone components, signals, `resource()`, zoneless change
detection). The optional **Open-Meteo weather API** is integrated as well.

---

## How the tutor's Assessment 2 feedback was addressed

Three points were raised on Assessment 2. All three are resolved in A3, and each
one is documented where a marker can check it:

| Feedback | Resolution | Where to look |
|---|---|---|
| *"Webpages should be broken down into Header, Nav, Body, Footer. The common segments should be created once and be common across all your pages."* | A single application shell holds Header + Nav + Footer around a router outlet that supplies the per-page Body. `site-header`, `primary-navigation` and `site-footer` each appear **exactly once** in the source. | `src/index.html` and `src/app/app.html` in both apps (segment banners mark each one); [DOCUMENTATION.md](DOCUMENTATION.md) §1 |
| *"Comments style not consistent, should follow the autodoc style, for ease of automatic doc generation."* | Every API file carries `@module`, and exported functions carry `@param` / `@returns` / `@throws`. Documentation is generated: JSDoc for the API, TypeDoc for both Angular apps. | [DOCUMENTATION.md](DOCUMENTATION.md) §2; run `npm run docs` in each project |
| *"Videos doesn't demonstrate how your website works."* | A timed, shot-by-shot demonstration script with an explicit pre-recording checklist. | `report/VIDEO_SCRIPT.md` |

---

## Carried forward from Assessment 2

A3 extends the A2 work rather than replacing it:

- the **A2 database schema** (`categories`, `organisations`, `events`) is retained
  and extended, and the seed data is the same eight events;
- **`GET /api/events/search`** is kept and improved, so the A2 search page's
  `?date=&location=&category=` contract still works (the category now also accepts
  a name, and `?status=` can override the original active/upcoming restriction);
- the **event images** are restored and corrected — the A2 files were mislabelled
  WebP data with off-topic subjects, so they were replaced with correctly formatted,
  topical photographs; see `ng-client/public/images/README.md`;
- **`event_db.js`** is the entry point the brief names for Part 1. It now delegates
  to the layered `api/db/` package (`pool.js`, `events.repo.js`,
  `registrations.repo.js`, `lookup.repo.js`, and the `data.js` facade) instead of
  opening one raw connection, because A3 needs transactions and a connection pool.

---

## Repository layout

```
prog2002-a3/
├── api/                          Node.js + Express REST API  (Part 2)
│   ├── app.js                    cPanel / Passenger startup file
│   ├── server.js                 Express app, middleware, routes, error handler
│   ├── config/env.js             all environment settings
│   ├── db/
│   │   ├── pool.js               MySQL connection pool + transactions
│   │   ├── events.repo.js        events SQL, including the delete guard
│   │   ├── registrations.repo.js registrations SQL
│   │   ├── lookup.repo.js        categories, organisations, dashboard
│   │   └── data.js               data facade (MySQL, or read-only demo data)
│   ├── routes/                   events, registrations, lookups, weather
│   ├── services/weather.service.js  Open-Meteo integration
│   ├── data/                     demo dataset + WMO weather code table
│   ├── utils/                    HttpError + server-side validation
│   ├── tests/api.test.js         96-check automated API suite
│   ├── sql/charityevents_db.sql  the complete database + seed data  (Part 1)
│   └── README.md                 full API documentation
├── deploy/                       cPanel .htaccess files            (Part 5)
├── tools/
│   ├── build_all.ps1             production build + packaging
│   ├── package_zips.py           creates the three submission zips
│   ├── preview-server.js         serves a build with an /api proxy
│   └── ui-smoke-test.js          57-check browser test through real Chrome
├── DEPLOYMENT.md                 step-by-step SCU cPanel guide
└── README.md                     this file

Sibling folders (created by `ng new`):
  ../ng-client/                   Angular v22 client website        (Part 3)
  ../ng-admin/                    Angular v22 admin website         (Part 4)
  ../report/                      project report, video script, peer evaluation
  ../submission/                  the three generated zip files
```

---

## Quick start (development)

**Requirements:** Node 22.22.3+ (or 24.15+ — Angular v22 requires it), MySQL 8,
and Python 3 (only for the packaging script).

```bash
# ---------------------------------------------------------------- 1. database
mysql -u root -p < api/sql/charityevents_db.sql

# ------------------------------------------------------------------- 2. API
cd api
npm install
#   then check the DB_CONFIG password in config/env.js (no .env file is used)
npm start                     # http://localhost:3000

# ------------------------------------------------------- 3. client website
cd ../ng-client
npm install
npx ng serve --port 4200      # http://localhost:4200

# -------------------------------------------------------- 4. admin console
cd ../ng-admin
npm install
npx ng serve --port 4300      # http://localhost:4300
```

Not ready to set up MySQL? `USE_DEMO_FALLBACK` is `true` in `api/config/env.js`:
the API serves the bundled sample dataset read-only so both websites still work,
and prints a clear warning on start-up. Set it to `false` to disable.

**Configuration lives in `api/config/env.js`** as plain JavaScript constants —
there is no `.env` file and no dotenv package, the same approach Assessment 2
used. See [api/README.md](api/README.md) §2 for the full table of settings.

---

## Verifying the work

Two automated suites, no test framework to install:

```bash
cd api
npm test                      # 96 checks - the REST API end to end
```

The browser suite drives both websites in real Chrome. It expects the combined
deployment (one Express app serving the API, the client at `/` and the admin at
`/admin`), which is exactly the production layout, so it also verifies the admin
build's `--base-href /admin/`:

```bash
cd prog2002-a3
& .\tools\build_all.ps1           # produces api/public/client and api/public/admin
cd api
node server.js                    # http://localhost:3000

# in another terminal:
cd ..
node tools/ui-smoke-test.js       # 57 checks - drives both websites in real Chrome
```

The browser suite proves the parts a marker sees: search and filtering, the
registration ordering, client-side validation, a successful registration, the
duplicate-registration refusal, and the admin console's create → update → blocked
delete → delete cycle. It also writes screenshots to `../_brief/shots/ui/` and
leaves the database exactly as it found it.

During front-end development you can run it against the dev servers instead:

```bash
node tools/preview-server.js ../ng-client/dist/clientside/browser 4201
node tools/preview-server.js ../ng-admin/dist/adminside/browser   4301 --base=/admin
node tools/ui-smoke-test.js --client=http://localhost:4201 --admin=http://localhost:4301/admin
```

---

## Building for deployment

```powershell
cd prog2002-a3
& .\tools\build_all.ps1 -Username 24833044
```

This will:

1. build the client website for production,
2. build the admin website for production with `--base-href /admin/`,
3. copy both into `api/public/` (with their `.htaccess` files) so **one** cPanel
   Node.js application serves the API and both websites,
4. create `24833044A3-clientside.zip`, `24833044A3-adminside.zip` and
   `24833044A3-api.zip`.

The production environment uses the **relative** API path `apiBase: '/api'`, so
no URL has to be edited after uploading. See [DEPLOYMENT.md](DEPLOYMENT.md) for
the cPanel steps.

You can verify the combined deployment locally: `cd api && node server.js`, then
open `http://localhost:3000/` and `http://localhost:3000/admin/`.

---

## Feature checklist against the assessment brief

| Brief requirement | Where | Status |
|---|---|---|
| **1a** New registration page with ticket quantity | `ng-client/.../register/` | done |
| **1b** Event page shows registrations, latest first | `ng-client/.../event-detail/` + `GET /api/events/:id` | done |
| **Part 1** New table linked to `events` | `registrations` (FK, UNIQUE, CHECK) | done |
| **Part 1** ≥10 seeded registrations | 12 in `charityevents_db.sql` | done |
| **Part 1** `event_db.js` updated | `api/db/*.repo.js`, `api/db/data.js` | done |
| **Part 2** Single event returns its registrations | `GET /api/events/:id` | done |
| **Part 2** Insert / update / delete event endpoints | `POST`, `PUT`/`PATCH`, `DELETE /api/events` | done |
| **Part 2** Delete blocked when registrations exist | HTTP 409 + `ON DELETE RESTRICT` | done |
| **Part 2** Postman testing | `api/README.md`, tested live | done |
| **Part 3** Registration page calls the API | `POST /api/events/:id/registrations` | done |
| **Part 3** Client-side validation + alert | Angular Reactive Forms + `validate.js` | done |
| **Part 3** Event ID passed via query string | `/register?eventId=N` | done |
| **Part 4** List every event, any status | `/events` in the admin console | done |
| **Part 4** New / Update / Delete with validation | `event-form` + `event-list` | done |
| **Part 4** Update shows associated registrations | side panel + registrations viewer | done |
| **Part 4** Blocked-delete user feedback | 409 message shown in the admin UI | done |
| **Part 4** Navigation menu on all pages | sidebar in `app.html` | done |
| **Part 5** Deploy both sites to SCU cPanel | `DEPLOYMENT.md`, `.htaccess`, build script | documented |
| **Part 6** External Open-Meteo weather API | `/api/events/:id/weather` + panel | done |
| **Extra** Angular **v22** for both websites | `ng-client`, `ng-admin` | done |
| **Part 7** GitHub repository with progress | this repository | ongoing |
| **Part 7** Demonstration video | `report/VIDEO_SCRIPT.md` | script ready |
| **Part 7** Peer evaluation form | `report/peer-evaluation/` | generated |

---

## Generative AI use declaration

I acknowledge that I have used GenAI tools to complete this assessment. We used
ChatGPT and GitHub Copilot to brainstorm the database and API design, to review
and comment our code, to check grammar and clarity in the project report, and to
help format the documentation, within the parameters outlined in the Assessment
Brief and by the Unit Assessor.

All generated suggestions were reviewed, tested and understood by both team
members before they were committed.

---

## Submission details

| | |
|---|---|
| Unit | PROG2002 Web Development II |
| Assessment | Assessment 3 |
| Team | team40 |
| Members | Yizheng Yuan (24833044), Mu Li (224832355) |
| Submitted | October 2025 |
| Repository | private, shared with the Unit Assessor as a collaborator |

### What is in this repository

| Folder | Contents |
|---|---|
| `api/` | Node.js + Express.js + MySQL REST API, and the built copies of both websites for cPanel |
| `ng-client/` | Angular v22 source for the public charity events website |
| `ng-admin/` | Angular v22 source for the admin console |
| `deploy/` | `.htaccess` files used when publishing to cPanel |
| `tools/` | build, preview, packaging and browser-test scripts |

### How to run it locally

```bash
cd api
npm install
npm start                       # API + both websites on http://localhost:3000
```

The database is recreated from `api/sql/charityevents_db.sql`.
Full instructions are in `DEPLOYMENT.md`; the quick version is in `READ-ME-FIRST.txt`.

### How to run the tests

```bash
cd api && npm test                    # 96 automated API checks
node tools/ui-smoke-test.js           # 57 browser checks through real Chrome
```

---

## Academic integrity declaration

By submitting this assessment, we declare that we have read and understood SCU's
Academic Integrity policies and referencing guidelines; that we are aware of the
consequences of academic misconduct; and that this submission is our own original
work, referenced appropriately, and has not been previously submitted. We
authorise its reproduction for authentication purposes and understand the
implications of a false declaration. We have adhered to guidelines regarding
Generative AI.
