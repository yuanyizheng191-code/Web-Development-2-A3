/**
 * tools/ui-smoke-test.js
 * ---------------------------------------------------------------------------
 * Drives a REAL Chrome browser against the two Angular applications and the
 * Express API, using the Chrome DevTools Protocol over a WebSocket.
 *
 * Why this exists: the API test suite proves the REST layer works, but the brief
 * is marked on the WEBSITE.  This script proves that a user clicking around the
 * actual rendered pages can:
 *
 *   Client site
 *     1. load the home page and see events from MySQL
 *     2. search, and get filtered results
 *     3. open an event and see its registrations (newest first)
 *     4. submit the registration form and receive a confirmation
 *     5. be blocked with a readable message when registering twice
 *   Admin site
 *     6. load the dashboard and the complete event list
 *     7. create a new event through the form           (POST)
 *     8. update that event                             (PUT)
 *     9. be BLOCKED from deleting it once it has a registration (409 feedback)
 *    10. delete it successfully after the registration is cancelled (DELETE)
 *
 * Usage:
 *   node tools/ui-smoke-test.js
 *   node tools/ui-smoke-test.js --client=http://localhost:3000 --admin=http://localhost:3000/admin
 *
 * The DEFAULTS deliberately point at the API server on port 3000, because that is
 * the exact production layout: one Express application serves the API, the client
 * website at / and the admin website at /admin. Testing against it therefore also
 * verifies that the admin build's `--base-href /admin/` and the single-origin
 * routing are correct.
 *
 * Requirements:
 *   1. the API with the built front ends in place:
 *        cd api && node server.js      (after tools/build_all.ps1, or any build
 *                                       copied into api/public/{client,admin})
 *   2. Chrome installed
 *
 * During development you can instead point the flags at the two preview servers:
 *   node tools/preview-server.js ../ng-client/dist/clientside/browser 4201
 *   node tools/preview-server.js ../ng-admin/dist/adminside/browser   4301 --base=/admin
 *   node tools/ui-smoke-test.js --client=http://localhost:4201 --admin=http://localhost:4301/admin
 *
 * PROG2002 A3 - team40 - Yizheng Yuan (24833044), Mu Li (224832355)
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : fallback;
};

const CLIENT = arg('client', 'http://localhost:3000');
const ADMIN = arg('admin', 'http://localhost:3000/admin');
const CHROME = arg('chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
const SHOTS = arg('shots', path.join(__dirname, '..', '..', '_brief', 'shots', 'ui'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}${extra ? `  -> ${extra}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Remove everything this script created, directly through the API.
 * Called from the finally block so a failed run never leaves test rows behind.
 */
async function cleanup(baseClient, createdEventId, emails) {
  const api = async (method, path) => {
    try {
      const response = await fetch(`${baseClient}${path}`, { method });
      return response.status;
    } catch {
      return 0;
    }
  };

  for (const email of emails) {
    // Find the registration ids for the test e-mails.
    try {
      const list = await fetch(`${baseClient}/api/events/3/registrations`).then((r) => r.json());
      for (const registration of list.data || []) {
        if (registration.email === email) {
          await api('DELETE', `/api/registrations/${registration.registrationId}`);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (createdEventId) {
    // Deleting the event only succeeds once its registrations are gone.
    await api('DELETE', `/api/events/${createdEventId}`);
  }
}

// ---------------------------------------------------------------------------
// Minimal CDP client
// ---------------------------------------------------------------------------
class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', (e) => reject(new Error(`WebSocket error: ${e.message || 'unknown'}`)));
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && this.pending.has(message.id)) {
          const { resolve: res, reject: rej } = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) rej(new Error(message.error.message));
          else res(message.result);
        }
      });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /** Evaluate an expression in the page and return its value. */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed',
      );
    }
    return result.result.value;
  }

  async goto(url, settleMs = 2500) {
    await this.send('Page.navigate', { url });
    await sleep(settleMs);
  }

  async screenshot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

/** Wait for Chrome's DevTools endpoint to answer. */
function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

async function waitForDevTools(port, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return await getJson(`http://127.0.0.1:${port}/json/version`);
    } catch {
      await sleep(400);
    }
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

// ---------------------------------------------------------------------------
// Page helpers (all run inside the browser)
// ---------------------------------------------------------------------------

/** Text content of the whole body. */
const BODY_TEXT = 'document.body.innerText';

/**
 * Fill an input/select/textarea and fire the events Angular listens to.
 *
 * For a <select> the correct option is located by matching either the option's
 * value or its visible text, because Angular's [ngValue] binding stores the
 * actual value (often a number) rather than a plain string - so simply assigning
 * '1' to select.value would silently select nothing.
 */
const setField = (selector, value) => `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return 'NOT_FOUND';

  if (el.tagName === 'SELECT') {
    const wanted = String(${JSON.stringify(String(value))}).trim().toLowerCase();
    const option = Array.from(el.options).find(
      (o) => o.value === String(${JSON.stringify(String(value))}) ||
             o.textContent.trim().toLowerCase() === wanted ||
             o.textContent.trim().toLowerCase().startsWith(wanted),
    );
    if (!option) {
      return 'OPTION_NOT_FOUND: ' + Array.from(el.options).map((o) => o.value + '|' + o.textContent.trim()).join(', ');
    }
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, option.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'OK';
  }

  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(${JSON.stringify(String(value))}));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return 'OK';
})()`;

/** Click the first element matching a selector (optionally by its text). */
const clickBySelector = (selector) => `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return 'NOT_FOUND';
  el.click();
  return 'OK';
})()`;

const clickByText = (selector, text) => `
(() => {
  const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
  const el = nodes.find((n) => (n.textContent || '').trim().toLowerCase().includes(${JSON.stringify(
    text.toLowerCase(),
  )}));
  if (!el) return 'NOT_FOUND';
  el.click();
  return 'OK';
})()`;

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('  PROG2002 A3 - browser UI smoke test');
  console.log(`  Client: ${CLIENT}`);
  console.log(`  Admin : ${ADMIN}`);

  if (!fs.existsSync(CHROME)) {
    throw new Error(`Chrome was not found at ${CHROME}. Pass --chrome=<path>.`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a3ui-'));
  const debugPort = 9333;
  // Tracked so the finally block can undo anything the test created.
  let cleanupEventId = null;
  const cleanupEmails = [];
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--disable-extensions',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1500,1000',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let cdp;
  /** Browser console errors / uncaught exceptions, collected for diagnostics. */
  const browserErrors = [];
  try {
    await waitForDevTools(debugPort);
    const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('No browser page target was found.');

    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Collect browser console errors and uncaught exceptions - they are the
    // fastest way to explain a failed interaction.
    cdp.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        browserErrors.push(
          'console.error: ' + message.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
        );
      }
      if (message.method === 'Runtime.exceptionThrown') {
        browserErrors.push(
          'exception: ' +
            (message.params.exceptionDetails.exception?.description ||
              message.params.exceptionDetails.text),
        );
      }
    });

    // Always accept window.confirm() so destructive buttons can be exercised.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'window.confirm = () => true;',
    });

    fs.mkdirSync(SHOTS, { recursive: true });

    // =====================================================================
    console.log('');
    console.log('\u2500\u2500 CLIENT SITE: browsing and searching \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    // =====================================================================

    await cdp.goto(`${CLIENT}/`, 3000);
    let text = await cdp.evaluate(BODY_TEXT);
    check('home page renders', text.includes('Find a charity event worth showing up for'));
    check('home page lists events from MySQL', text.includes('City Fun Run 2026'), text.slice(0, 200));
    check('home page shows the charity partners', text.includes('Hope Foundation'));
    // The stat labels are uppercased by CSS, and innerText reflects that.
    check(
      'home page shows live statistics from the API',
      /8\s*CHARITY EVENTS/i.test(text) && /RAISED SO FAR/i.test(text),
      text.match(/CHARITY EVENTS[\s\S]{0,120}/)?.[0],
    );
    await cdp.screenshot(path.join(SHOTS, '01-client-home.png'));

    // ---- search ---------------------------------------------------------
    await cdp.goto(`${CLIENT}/events`, 2500);
    await cdp.evaluate(setField('#search', 'gala'));
    await sleep(2000); // debounce + API round trip
    text = await cdp.evaluate(BODY_TEXT);
    check('search filters the event list', text.includes('Hope Gala Dinner') && !text.includes('City Fun Run 2026'), text.slice(0, 300));
    check('search reports how many events matched', /matching "gala"/.test(text), text.slice(0, 200));

    // no results path
    await cdp.evaluate(setField('#search', 'zzzzz-nothing-matches'));
    await sleep(1800);
    text = await cdp.evaluate(BODY_TEXT);
    check('an empty search shows the "no events found" state', text.includes('No events found'));
    await cdp.evaluate(clickByText('button', 'Clear all filters'));
    await sleep(1500);
    text = await cdp.evaluate(BODY_TEXT);
    check('clearing the filters restores the full list', text.includes('City Fun Run 2026'));

    // ---- event detail + registrations -----------------------------------
    await cdp.goto(`${CLIENT}/events/1`, 3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('event detail page loads the event', text.includes('City Fun Run 2026'));
    check('event detail shows the registration list', text.includes('Alice Nguyen') && text.includes('Ben Carter'));
    check('registrations are ordered latest purchase first', (() => {
      const iChloe = text.indexOf('Chloe Martin'); // 8 Oct
      const iBen = text.indexOf('Ben Carter'); // 3 Oct
      const iAlice = text.indexOf('Alice Nguyen'); // 1 Oct
      return iChloe > -1 && iBen > -1 && iAlice > -1 && iChloe < iBen && iBen < iAlice;
    })(), text.match(/Chloe[\s\S]{0,400}/)?.[0]?.slice(0, 120));
    // The forecast comes from the external Open-Meteo service, so allow one
    // retry: a transient outage must not be reported as a website defect.
    let forecastVisible = text.includes('Weather forecast for the venue');
    if (!forecastVisible) {
      await cdp.goto(`${CLIENT}/events/1`, 5000);
      text = await cdp.evaluate(BODY_TEXT);
      forecastVisible = text.includes('Weather forecast for the venue');
    }
    check('event detail shows the Open-Meteo forecast', forecastVisible);
    // The forecast panel is only rendered once real data has arrived.
    check(
      'the forecast is translated into readable conditions',
      /Clear sky|Mainly clear|Partly cloudy|Overcast|Fog|Drizzle|Rain|Snow|Thunderstorm/.test(text),
      text.match(/Weather forecast[\s\S]{0,300}/)?.[0],
    );
    check('event detail shows the Register button', text.includes('Register for this event'));
    await cdp.screenshot(path.join(SHOTS, '02-client-event-detail.png'));

    // =====================================================================
    console.log('');
    console.log('\u2500\u2500 CLIENT SITE: the registration page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    // =====================================================================

    const uniqueEmail = `ui.test.${Date.now()}@example.com`;
    cleanupEmails.push(uniqueEmail);

    await cdp.goto(`${CLIENT}/register?eventId=3`, 3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('registration page shows the selected event', text.includes('Silent Auction Night'), text.slice(0, 300));
    check('registration page shows the form', text.includes('Finalise registration'));

    // ---- submit with an empty form to prove client-side validation ------
    await cdp.evaluate(clickByText('button', 'Finalise registration'));
    await sleep(700);
    text = await cdp.evaluate(BODY_TEXT);
    check('an invalid form shows a client-side validation alert', text.includes('Please check your details'));
    check('field level errors are shown', text.includes('This field is required.'));
    await cdp.screenshot(path.join(SHOTS, '03-client-validation.png'));

    // ---- fill the form properly -----------------------------------------
    await cdp.evaluate(setField('#attendeeName', 'Browser Test Attendee'));
    await cdp.evaluate(setField('#email', uniqueEmail));
    await cdp.evaluate(setField('#phone', '0400 123 456'));
    await cdp.evaluate(setField('#organisation', 'Automated UI Test'));
    await cdp.evaluate(setField('#ticketsPurchased', '2'));
    await sleep(600);
    text = await cdp.evaluate(BODY_TEXT);
    // Silk Auction Night tickets are $50 each, so two tickets must total $100.
    check('the total updates live as tickets change', /\$100\.00/.test(text), text.match(/Total[\s\S]{0,120}/)?.[0]);

    await cdp.evaluate(clickByText('button', 'Finalise registration'));
    await sleep(3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('a valid registration is confirmed', text.includes('Registration confirmed'), text.slice(0, 400));
    check('the confirmation shows the amount charged', text.includes('$100.00'));
    check('the confirmation shows a reference number', /Registration reference[\s\S]{0,40}#\d+/.test(text));
    await cdp.screenshot(path.join(SHOTS, '04-client-registration-confirmed.png'));

    // ---- duplicate registration is refused ------------------------------
    await cdp.goto(`${CLIENT}/register?eventId=3`, 2500);
    await cdp.evaluate(setField('#attendeeName', 'Browser Test Attendee'));
    await cdp.evaluate(setField('#email', uniqueEmail));
    await cdp.evaluate(setField('#organisation', 'Automated UI Test'));
    await cdp.evaluate(setField('#ticketsPurchased', '1'));
    await cdp.evaluate(clickByText('button', 'Finalise registration'));
    await sleep(2500);
    text = await cdp.evaluate(BODY_TEXT);
    check('registering twice with the same e-mail is blocked', text.includes('already registered'), text.slice(0, 400));
    await cdp.screenshot(path.join(SHOTS, '05-client-duplicate-blocked.png'));

    // The registration now shows on the event's public page.
    await cdp.goto(`${CLIENT}/events/3`, 2500);
    text = await cdp.evaluate(BODY_TEXT);
    check('the new booking appears in the public registration list', text.includes(uniqueEmail));

    // =====================================================================
    console.log('');
    console.log('\u2500\u2500 ADMIN SITE: list, create, update \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    // =====================================================================

    await cdp.goto(`${ADMIN}/dashboard`, 3500);
    text = await cdp.evaluate(BODY_TEXT);
    // Assert on the rendered elements rather than on body text: reading the stat
    // card values proves the cards actually rendered with data.
    const dashboardState = await cdp.evaluate(`
      JSON.stringify({
        heading: document.querySelector('h1')?.textContent?.trim() || '',
        cards: Array.from(document.querySelectorAll('.stat-card')).map((c) => ({
          label: c.querySelector('.stat-card__label')?.textContent?.trim() || '',
          value: c.querySelector('.stat-card__value')?.textContent?.trim() || '',
        })),
        hasRecent: !!Array.from(document.querySelectorAll('h2')).find((h) => h.textContent.includes('Recently added')),
        hasStatusBreakdown: !!Array.from(document.querySelectorAll('h2')).find((h) => h.textContent.includes('Events by status')),
        menuItems: Array.from(document.querySelectorAll('.sidebar__nav a')).map((a) => a.textContent.trim()),
      })`);
    const dash = JSON.parse(dashboardState);
    check('admin dashboard renders its heading', dash.heading === 'Dashboard', dash.heading);
    check(
      'dashboard renders the four summary cards with values',
      dash.cards.length === 4 && dash.cards.every((c) => c.label && c.value),
      JSON.stringify(dash.cards),
    );
    check('dashboard shows the total event count', dash.cards.some((c) => /total events/i.test(c.label) && /^\d+$/.test(c.value)), JSON.stringify(dash.cards));
    check('dashboard shows recent events and the status breakdown', dash.hasRecent && dash.hasStatusBreakdown);
    check('dashboard has the sidebar navigation', dash.menuItems.length >= 4, dash.menuItems.join(' | '));
    await cdp.screenshot(path.join(SHOTS, '06-admin-dashboard.png'));

    await cdp.goto(`${ADMIN}/events`, 3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('admin event list shows every event', text.includes('City Fun Run 2026') && text.includes('Jazz for Health'));
    check('the list shows events of every status', ['upcoming', 'active', 'past'].every((s) => text.toLowerCase().includes(s)));
    check('the list warns which events are protected from deletion', text.includes('Protected:'));
    await cdp.screenshot(path.join(SHOTS, '07-admin-event-list.png'));

    // ---- create ---------------------------------------------------------
    const stamp = Date.now();
    const eventName = `UI Test Event ${stamp}`;

    await cdp.goto(`${ADMIN}/events/new`, 3000);
    await cdp.evaluate(setField('#eventName', eventName));
    await cdp.evaluate(setField('#description', 'Created by the automated browser test'));
    await cdp.evaluate(setField('#fullDescription', 'This event was created through the real admin form by tools/ui-smoke-test.js.'));
    await cdp.evaluate(setField('#eventDate', '2027-05-20T18:30'));
    await cdp.evaluate(setField('#location', 'Coffs Harbour'));
    await cdp.evaluate(setField('#ticketPrice', '42.50'));
    await cdp.evaluate(setField('#goalAmount', '15000'));
    await cdp.evaluate(setField('#status', 'upcoming'));
    await cdp.evaluate(setField('#categoryId', 'Fun Run'));
    await cdp.evaluate(setField('#orgId', 'Hope Foundation'));
    await cdp.evaluate(setField('#purpose', 'Automated verification'));
    await sleep(600);
    const stillInvalid = await cdp.evaluate(
      `JSON.stringify(Array.from(document.querySelectorAll('form .is-invalid')).map((e) => e.id))`,
    );
    check('every required field accepts the test input', stillInvalid === '[]', stillInvalid);
    await cdp.screenshot(path.join(SHOTS, '08-admin-new-event-form.png'));

    await cdp.evaluate(clickByText('button', 'Save new event'));
    await sleep(3200);
    text = await cdp.evaluate(BODY_TEXT);
    const currentUrl = await cdp.evaluate('window.location.pathname + window.location.search');
    check('saving a new event navigates to its update page', /\/events\/\d+\/edit/.test(currentUrl), currentUrl);
    // The event name lives in an <input value>, which innerText does not include.
    const formState = await cdp.evaluate(`
      JSON.stringify({
        eventName: document.querySelector('#eventName')?.value || '',
        eventDate: document.querySelector('#eventDate')?.value || '',
        ticketPrice: document.querySelector('#ticketPrice')?.value || '',
        location: document.querySelector('#location')?.value || '',
        heading: document.querySelector('h1')?.textContent?.trim() || '',
      })`);
    const loaded = JSON.parse(formState);
    check('the saved event is loaded back into the form', loaded.eventName === eventName, JSON.stringify(loaded));
    check('the saved date survives the round trip', loaded.eventDate === '2027-05-20T18:30', loaded.eventDate);
    check('the saved ticket price is preserved', Number(loaded.ticketPrice) === 42.5, loaded.ticketPrice);
    check('the form switched to update mode', /Update charity event/.test(loaded.heading), loaded.heading);

    const createdId = Number((currentUrl.match(/\/events\/(\d+)\/edit/) || [])[1]);
    check('the created event has a database id', Number.isInteger(createdId) && createdId > 0, String(createdId));
    if (Number.isInteger(createdId) && createdId > 0) cleanupEventId = createdId;

    // ---- update ---------------------------------------------------------
    await cdp.evaluate(setField('#ticketPrice', '55.00'));
    await cdp.evaluate(setField('#status', 'active'));
    await cdp.evaluate(setField('#location', 'Coffs Harbour Showground'));
    await cdp.evaluate(clickByText('button', 'Save changes'));
    await sleep(3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('saving an update reports success', text.includes('was updated successfully'), text.slice(0, 300));
    check('the update panel confirms it has no registrations', text.includes('safe to delete'), text.slice(0, 400));

    // ---- register for the new event from the public site ----------------
    const adminEmail = `ui.admin.${stamp}@example.com`;
    cleanupEmails.push(adminEmail);
    await cdp.goto(`${CLIENT}/register?eventId=${createdId}`, 2800);
    text = await cdp.evaluate(BODY_TEXT);
    check('the updated event is visible on the public registration page', text.includes(eventName), text.slice(0, 300));

    await cdp.evaluate(setField('#attendeeName', 'Admin Flow Tester'));
    await cdp.evaluate(setField('#email', adminEmail));
    await cdp.evaluate(setField('#organisation', 'Automated UI Test'));
    await cdp.evaluate(setField('#ticketsPurchased', '1'));
    await cdp.evaluate(clickByText('button', 'Finalise registration'));
    await sleep(3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('a booking can be made for the newly created event', text.includes('Registration confirmed'), text.slice(0, 300));

    // =====================================================================
    console.log('');
    console.log('\u2500\u2500 ADMIN SITE: the delete guard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    // =====================================================================

    await cdp.goto(`${ADMIN}/events`, 3000);
    // Click the Delete button on the row that contains our test event.
    await cdp.evaluate(`
      (() => {
        const row = Array.from(document.querySelectorAll('tbody tr'))
          .find((tr) => tr.textContent.includes(${JSON.stringify(eventName)}));
        if (!row) return 'ROW_NOT_FOUND';
        const button = Array.from(row.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Delete');
        if (!button) return 'BUTTON_NOT_FOUND';
        button.click();
        return 'OK';
      })()`);
    await sleep(1500);
    text = await cdp.evaluate(BODY_TEXT);
    check(
      'deleting an event that has a registration is blocked in the UI',
      text.includes('cannot be deleted') && text.includes('Action not completed'),
      text.slice(0, 400),
    );
    await cdp.screenshot(path.join(SHOTS, '09-admin-delete-blocked.png'));

    // The event must still exist.
    const stillThere = await cdp.evaluate(`
      fetch('/api/events/${createdId}').then((r) => r.status)`);
    check('the blocked event still exists in the database', stillThere === 200, `status ${stillThere}`);

    // ---- cancel the booking, then delete --------------------------------
    await cdp.goto(`${ADMIN}/events/${createdId}/registrations`, 3000);
    text = await cdp.evaluate(BODY_TEXT);
    check('the admin registration viewer lists the booking', text.includes('Admin Flow Tester'), text.slice(0, 400));
    check('the viewer reports that bookings block deletion', text.includes('block deletion'));
    await cdp.screenshot(path.join(SHOTS, '10-admin-registrations.png'));

    // Accept the confirm() dialog that the cancel button opens.
    await cdp.evaluate(`
      (() => { window.confirm = () => true; return 'patched'; })()`);
    await cdp.evaluate(clickByText('button', 'Cancel'));
    await sleep(2500);
    text = await cdp.evaluate(BODY_TEXT);
    check('a booking can be cancelled from the admin site', text.includes('was cancelled') || text.includes('no registrations for this event'), text.slice(0, 300));

    await cdp.goto(`${ADMIN}/events`, 3000);
    await cdp.evaluate(`
      (() => {
        const row = Array.from(document.querySelectorAll('tbody tr'))
          .find((tr) => tr.textContent.includes(${JSON.stringify(eventName)}));
        if (!row) return 'ROW_NOT_FOUND';
        const button = Array.from(row.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Delete');
        if (!button) return 'BUTTON_NOT_FOUND';
        button.click();
        return 'OK';
      })()`);
    await sleep(2500);
    text = await cdp.evaluate(BODY_TEXT);
    check('the event can now be deleted', text.includes('was deleted successfully'), text.slice(0, 300));
    // The confirmation message itself contains the event name, so check the
    // actual table rows rather than the page text.
    const rowsLeft = await cdp.evaluate(`
      JSON.stringify(Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')?.innerText?.trim()))`);
    check(
      'the deleted event is gone from the table',
      !JSON.parse(rowsLeft).some((name) => (name || '').includes(eventName)),
      rowsLeft.slice(0, 200),
    );
    await cdp.screenshot(path.join(SHOTS, '11-admin-deleted.png'));

    // Confirm through the API as well.
    const afterDelete = await cdp.evaluate(`fetch('/api/events/${createdId}').then((r) => r.status)`);
    check('the API confirms the event no longer exists', afterDelete === 404, `status ${afterDelete}`);

    // =====================================================================
    console.log('');
    console.log('\u2500\u2500 ADMIN SITE: navigation on every page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    // =====================================================================

    for (const route of ['/dashboard', '/events', '/events/new', '/about']) {
      await cdp.goto(`${ADMIN}${route}`, 2200);
      text = await cdp.evaluate(BODY_TEXT);
      const hasMenu = text.includes('Dashboard') && text.includes('All events') && text.includes('New event');
      check(`the sidebar menu is present on ${route}`, hasMenu);
    }

    // Unknown admin URL -> 404 page
    await cdp.goto(`${ADMIN}/this/does/not/exist`, 2200);
    text = await cdp.evaluate(BODY_TEXT);
    check('an unknown admin URL shows the 404 page', text.includes('does not exist'));

    // Unknown client URL -> 404 page
    await cdp.goto(`${CLIENT}/nope`, 2200);
    text = await cdp.evaluate(BODY_TEXT);
    check('an unknown client URL shows the 404 page', text.includes('could not find that page'));
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    // Leave the database exactly as it was found.
    await cleanup(CLIENT, cleanupEventId, cleanupEmails);
  }

  console.log('');
  console.log('\u2500'.repeat(72));
  console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
  if (failures.length) {
    console.log('');
    console.log('  Failing checks:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  const seen = [];
  try {
    // eslint-disable-next-line no-undef
    (globalThis.__browserErrors || []).forEach((e) => seen.push(e));
  } catch {
    /* ignore */
  }
  if (browserErrors.length) {
    console.log('');
    console.log('  Browser console errors (deduplicated):');
    [...new Set(browserErrors)].slice(0, 12).forEach((e) => console.log(`    ! ${e.slice(0, 400)}`));
  }
  console.log(`  Screenshots: ${SHOTS}`);
  console.log('\u2500'.repeat(72));
  console.log('');

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('');
  console.error('  The UI smoke test could not complete.');
  console.error(`  ${err.message}`);
  console.error('');
  console.error('  Make sure both preview servers and the API are running:');
  console.error('    node server.js                                        (api, port 3000)');
  console.error('    node tools/preview-server.js ../ng-client/dist/clientside/browser 4201');
  console.error('    node tools/preview-server.js ../ng-admin/dist/adminside/browser   4301');
  console.error('');
  process.exit(1);
});
