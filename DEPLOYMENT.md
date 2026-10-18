# Deploying PROG2002 A3 to SCU cPanel — step by step

Team **team40** — Yizheng Yuan (24833044), Mu Li (224832355)

This guide deploys all three parts to one SCU cPanel account:

| What | Where it ends up | URL after deployment |
|---|---|---|
| `charityevents_db` (MySQL) | cPanel → MySQL® Databases | — |
| Express REST API | cPanel → Setup Node.js App | `https://<host>/api` |
| Angular **client** website | `public_html/` | `https://<host>/` |
| Angular **admin** website | `public_html/admin/` | `https://<host>/admin/` |

> **Each student must deploy to their own cPanel account.** Never share cPanel
> credentials — that breaches the university's security policy.

---

## 0. Before you start

Collect these from your SCU email / cPanel:

- cPanel URL, username and password
- The **Application root** you will use for the Node app (this guide uses `a3api`)
- The database name and database user cPanel gives you
  (cPanel prefixes both with your account name, e.g. `youruser_charitydb` and
  `youruser_a3user`)

On your own computer, build the two Angular applications first
(see section 3), or use the ready-made zip files produced by
`tools/package-deliverables.ps1`:

```
upload/
├── public_html/
│   ├── .htaccess              <- deploy/client.htaccess
│   ├── index.html             <- Angular CLIENT build
│   ├── main-*.js, styles-*.css, ...
│   └── admin/
│       ├── .htaccess          <- deploy/admin.htaccess
│       ├── index.html         <- Angular ADMIN build
│       └── main-*.js, styles-*.css, ...
└── a3api/                     <- the whole api/ folder
    ├── app.js                 <- cPanel startup file
    ├── server.js
    ├── event_db.js            <- the database file named by the brief
    ├── config/env.js          <- EDIT THE DB_CONFIG BLOCK IN HERE
    ├── package.json
    ├── db/, routes/, utils/, services/, data/
    └── sql/charityevents_db.sql
```

> **There is no `.env` file in this project.** The database details are written
> directly into `config/env.js` (and mirrored in `event_db.js`), exactly as
> Assessment 2 did it. Section 3b shows what to change.

---

## 1. Create the MySQL database

1. cPanel → **MySQL® Databases**
2. **Create New Database**: e.g. `charitydb` → cPanel names it `youruser_charitydb`
3. **Add New User**: e.g. `a3user` with a strong password → `youruser_a3user`
4. **Add User To Database** → select the user and the database → **ALL PRIVILEGES**
5. Write down the three values — you need them in section 4:
   - database name, database user, database password
   (the host is always `localhost` on cPanel)

## 2. Import the SQL file

1. cPanel → **phpMyAdmin**
2. Select your database in the left-hand list
3. **Import** tab → **Choose File** → `a3api/sql/charityevents_db.sql`
4. **Go** — you should see:
   *"Import has been successfully finished"*

> The SQL file contains `CREATE DATABASE IF NOT EXISTS charityevents_db`, so if
> you import it through the cPanel terminal (`mysql -u user -p < file.sql`) the
> database is created for you. Through phpMyAdmin, create the database first
> (section 1) and import **into** it.

Verify with the **SQL** tab:

```sql
SELECT COUNT(*) FROM events;          -- 8
SELECT COUNT(*) FROM registrations;   -- 12
SHOW CREATE TABLE registrations;      -- shows the FK, UNIQUE KEY and CHECK
```

## 3. Upload the API and register the Node.js application

### 3a. Upload the files

1. cPanel → **File Manager**
2. Go to your home directory (one level **above** `public_html`)
3. Create the folder `a3api`
4. Upload `a3api.zip` into it and **Extract** (then delete the zip)

### 3b. Point the API at your cPanel database

The project does **not** use a `.env` file. Open this file in the File Manager
(or in VS Code before uploading) and edit the `DB_CONFIG` block:

**`a3api/config/env.js`**

```js
const DB_CONFIG = {
  host: 'localhost',                    // stays 'localhost' on cPanel
  port: 3306,
  user: 'youruser_a3user',              // <-- your cPanel database user
  password: 'the-password-you-set',     // <-- your cPanel database password
  database: 'youruser_charitydb',       // <-- your cPanel database name
  connectionLimit: 10,
};
```

Also in the same file, add your deployed site to the CORS allow-list and switch
the demo fallback off, so the real database is the only source of data:

```js
const CORS_ORIGINS = ['https://YOUR-DOMAIN'];

const USE_DEMO_FALLBACK = false;
```

`event_db.js` re-exports the very same object, so it needs no edit - it exists
because Part 1 of the brief names `event_db.js` as the file to update.

> **Reminder:** on cPanel both the database name **and** the user are prefixed
> with your account name. If cPanel shows the database as
> `tomsy_charitydb`, the user as `tomsy_a3user`, then those full names are what
> belong in `DB_CONFIG`.
>
> If you do not know your deployed domain yet, leave `CORS_ORIGINS` as it is and
> come back to it after step 5. Because the Angular apps are served from the
> **same** origin as the API, the browser sends same-origin requests and CORS is
> not actually exercised in production — but setting it correctly is good
> practice.

### 3c. Install the dependencies

cPanel → **Setup Node.js App** → find your application → **Run NPM Install**
(or open the **Terminal** and run `cd ~/a3api && npm install --omit=dev`).

### 3d. Register the application

cPanel → **Setup Node.js App** → **Create Application**:

| Field | Value |
|---|---|
| Node.js version | the newest version offered (18 or later) |
| Application mode | **Production** |
| Application root | `a3api` |
| Application URL | your domain (or a sub-path such as `a3api`) |
| Application startup file | `app.js` |

Click **Create**, then **Restart**.

## 4. Verify the API

Open in a browser:

```
https://YOUR-DOMAIN/api/health
```

A correct response looks like this — `connected: true` proves the API reached
MySQL:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "PROG2002 A3 Charity Events API",
    "team": "team40",
    "storage": "mysql",
    "database": { "connected": true, "name": "youruser_charitydb", "version": "8.0.x" }
  }
}
```

Then check the resource endpoints:

```
https://YOUR-DOMAIN/api/events
https://YOUR-DOMAIN/api/events/1
https://YOUR-DOMAIN/api/events/1/weather
```

> **If `/api/health` returns `connected: false`**, the `DB_CONFIG` block in
> `config/env.js` is wrong. On cPanel the database name and user are **prefixed
> with your account name**. Fix `config/env.js` and restart the application.
>
> **If you get a 503 or "We're sorry, but something went wrong"**, open the
> application's log in *Setup Node.js App* and check that `package.json` lists
> `express`, `cors`, `mysql2` and `dotenv`, then run **Run NPM Install** again.

## 5. Deploy the two Angular websites

1. cPanel → **File Manager** → `public_html`
2. **Delete** the default placeholder files (`default.html`, `index.html`, ...)
   — keep `cgi-bin` if it exists
3. Upload the **client** build output (`upload/public_html/` contents) directly
   into `public_html/`, including the hidden `.htaccess`
   (File Manager → **Settings → Show Hidden Files (dotfiles)**)
4. Create the folder `public_html/admin` and upload the **admin** build output
   (`upload/public_html/admin/` contents) into it, plus its own `.htaccess`

Final layout:

```
public_html/
├── .htaccess          (client.htaccess)
├── index.html
├── main-XXXX.js
├── styles-XXXX.css
├── favicon.ico
└── admin/
    ├── .htaccess      (admin.htaccess)
    ├── index.html
    └── main-YYYY.js
```

## 6. End-to-end verification checklist

Walk through this list on the **deployed** site — the same list is useful as the
demo video script:

**Client website (`https://YOUR-DOMAIN/`)**

- [ ] Home page shows the statistics strip and three upcoming events
- [ ] `/events` lists events; typing `gala` in the search box filters them
- [ ] `/events/1` shows the event, the Open-Meteo forecast and **3 registrations,
      newest purchase first**
- [ ] "Show oldest first" reverses the order (proves the ordering is real)
- [ ] "Register for this event" opens `/register?eventId=1`
- [ ] Submitting an empty form shows the client-side validation alert
- [ ] A correct submission shows the confirmation with a registration reference
- [ ] Registering the **same e-mail twice** for the same event is refused with a
      readable message
- [ ] Deep links work after a hard refresh (e.g. reload `/events/1`) — this
      proves `.htaccess` is correct

**Admin website (`https://YOUR-DOMAIN/admin/`)**

- [ ] The sidebar menu is visible on every page
- [ ] The dashboard shows the summary cards, status breakdown and recent events
- [ ] The event list shows **every** status (upcoming, active, past) with the
      "Protected" notes
- [ ] Create a new event → it appears in the list and in `GET /api/events`
- [ ] Update that event → the change is saved
- [ ] Delete the event → it is removed
- [ ] Delete an event that **has** registrations → clear "cannot be deleted"
      feedback (HTTP 409)
- [ ] Reload a deep link such as `/admin/events/1/edit`

**Database**

- [ ] `SELECT * FROM registrations ORDER BY registration_date DESC;` shows the
      bookings your test created
- [ ] `DELETE FROM events WHERE event_id = 1;` in phpMyAdmin **fails** with a
      foreign-key error — this is the data-integrity rule being enforced by the
      database itself

---

## Building the Angular apps yourself (instead of using the zip)

```bash
# Node 22.22.3+ / 24.15+ is required by Angular v22
node -v

# ---- client website ----
cd ng-client
npm install
npx ng build --configuration production            # output: dist/clientside/browser

# ---- admin website ----
cd ../ng-admin
npm install
npx ng build --configuration production --base-href /admin/   # output: dist/adminside/browser
```

The production configuration swaps in `environment.production.ts`, which uses the
**relative** API path `apiBase: '/api'`. That is why nothing has to be edited
after uploading: the browser resolves `/api/...` against whatever host and
sub-path the site was deployed to.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health` → `connected: false` | Wrong `DB_CONFIG` values | On cPanel the database and user are prefixed with your account name. Fix the block in `config/env.js`, restart the app. |
| Front pages load but every list is empty and the console shows a CORS error | API and site are on different origins and `CORS_ORIGINS` does not list the site | Add the site origin to `CORS_ORIGINS` in `config/env.js`, or deploy both on the same host as described above. |
| Refreshing `/events/1` gives Apache's 404 | `.htaccess` missing or not uploaded (hidden file!) | Upload `client.htaccess` as `public_html/.htaccess`. |
| Admin deep link 404 | `public_html/admin/.htaccess` missing, or the build was made without `--base-href /admin/` | Rebuild with `--base-href /admin/` and upload the admin `.htaccess`. |
| The site shows "read-only demo data" | `USE_DEMO_FALLBACK` is `true` and MySQL is unreachable | Fix `DB_CONFIG`, or set `USE_DEMO_FALLBACK = false` in `config/env.js`. |
| Weather panel is missing | Open-Meteo temporarily unavailable | Not fatal — the panel hides itself. Reload the page. |
| 503 "We're sorry, but something went wrong" | Passenger could not start the app | Check the app log, confirm `express`/`cors`/`mysql2` are in `package.json`, re-run npm install. |

---

## GitHub reminder (Assessment 3 deliverable)

The brief requires the repository to show **regular commits with meaningful
messages**, and warns that failing to demonstrate work progress fails the
assignment. Commit as you go, one logical change at a time, for example:

```
feat(db): add registrations table with FK, unique key and check constraint
feat(api): add event CRUD endpoints with delete integrity guard
feat(api): include registrations in GET /api/events/:id
feat(client): add registration page with reactive form validation
feat(admin): add event list with blocked-delete feedback
feat(weather): integrate Open-Meteo forecast for event venues
chore(deploy): add cPanel .htaccess files and deployment guide
test: add 96-check API suite and 57-check browser UI suite
docs: add A3 report documenting the Angular v22 extra work and AI use
```
