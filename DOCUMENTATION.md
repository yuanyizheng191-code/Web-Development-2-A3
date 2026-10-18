# Documentation and code-comment conventions

**PROG2002 A3 — team40** — Yizheng Yuan (24833044), Mu Li (224832355)

This document explains the two conventions the tutor asked for after Assessment 2,
and shows exactly how to regenerate the automatic documentation from the code.

---

## 1. Page segmentation: Header, Nav, Body, Footer

> *Tutor feedback:* "Your webpages should be broken down into the following
> segments: Header, Nav, Body, Footer. The common segments like Header, Nav, and
> Footer should be created once and be common across all your pages."

### The problem in Assessment 2

Each page was a standalone HTML file that repeated the shared markup. The `<nav>`
and `<footer>` blocks were copy-pasted into `index.html`, `search.html` **and**
`event.html`, so a change to the menu had to be made in three places and could
easily drift out of step.

### The solution in Assessment 3

Both applications use a single **application shell** that holds the three shared
segments around a router outlet that supplies the per-page Body:

| Segment | Client website | Admin console |
|---|---|---|
| **Header** | `src/app/app.html` → `<header class="site-header">` | `src/app/app.html` → `<header class="topbar">` |
| **Nav** | `src/app/app.html` → `<nav id="primary-navigation">` | `src/app/app.html` → `<nav class="sidebar__nav">` |
| **Body** | one component per route in `src/app/features/<page>/` | one component per route in `src/app/features/<page>/` |
| **Footer** | `src/app/app.html` → `<footer class="site-footer">` | `src/app/app.html` → `<footer class="admin-footer">` |

Each segment is marked in the source with a comment banner, for example:

```html
<!-- =========================================================================
     SEGMENT 2 of 4 - NAV  (common to every page)
     ===================================================================== -->
```

### Why this is a genuine fix, not a claim

- `src/index.html` contains **no** page markup at all — only `<head>`, the
  `<app-root>` mount point and a no-JavaScript message. It carries a comment
  documenting the four-segment contract.
- The strings `site-header`, `primary-navigation` and `site-footer` each appear
  **exactly once** in the whole client codebase. There is nothing to keep in sync.
- The router swaps only the Body, so Header, Nav and Footer are constructed once
  and never re-created while the user navigates.

Verify it yourself:

```bash
grep -rn "site-footer" ng-client/src        # one match: app.html
grep -rn "site-header" ng-client/src        # one match: app.html
grep -rc  "router-outlet" ng-client/src     # one match: app.html
```

---

## 2. Comment style: autodoc (JSDoc / TSDoc)

> *Tutor feedback:* "Comments style not consistent, should follow the autodoc
> style, for ease of automatic doc generation through your code."

Comments are written so a documentation generator can consume them directly, and
the generated sites are committed as proof.

### The block tags used

| Tag | Where | Meaning |
|---|---|---|
| `@module` | first comment of every API file | groups the file's symbols into one module page |
| `@param {type} name` | every documented function | parameter and its type |
| `@returns {type}` | every documented function | return value and its type |
| `@throws {HttpError}` | functions that can reject | the failure a caller must handle |
| `@constant`, `@type` | configuration objects and fields | declares an immutable value or a field type |
| `` `back-ticks` `` | throughout | Markdown is enabled in the generator, so code renders as code |

### Generated documentation

| Application | Generator | Command | Output |
|---|---|---|---|
| API (Node/Express) | **JSDoc 4** with the docdash theme | `cd api && npm run docs` | `api/docs/index.html` — 8 module pages |
| Client website (Angular) | **TypeDoc** | `cd ng-client && npm run docs` | `ng-client/docs/index.html` |
| Admin console (Angular) | **TypeDoc** | `cd ng-admin && npm run docs` | `ng-admin/docs/index.html` |

The HTML output is committed alongside the source so the marker can open it
without installing anything. Regenerating it is a single command per project.

### One deliberate difference between the two generators

The API uses classic **JSDoc block tags**; the Angular code uses **TSDoc**
syntax. They are not interchangeable: TypeDoc rejects the `@file` and
`@description` tags as unknown, so the TypeScript files use a description
paragraph followed by `@module`, which both tools accept. Getting this right is
why `npx typedoc` now reports **0 errors and 0 warnings** for both applications.

---

## 3. Reproducing every check

```bash
# API documentation
cd api && npm install && npm run docs

# Angular documentation
cd ../ng-client && npm install && npm run docs
cd ../ng-admin  && npm install && npm run docs

# Tests
cd ../api && npm test                     # 96 API checks
cd .. && node tools/ui-smoke-test.js      # 57 browser checks (real Chrome)
```

Expected results, as delivered: **96 API checks pass**, **57 browser checks
pass**, JSDoc and TypeDoc both generate with no errors.
