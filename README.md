# Intelligent Inventory Dashboard

Keyloop technical assessment, **Scenario B**: a dashboard that shows dealership managers their vehicle stock, highlights aging stock (more than 90 days in inventory) and lets them record what they will do about each aging vehicle.

**Implemented layer:** Frontend (Vue 3 + TypeScript). The backend is mocked with Mock Service Worker against a written contract ([docs/openapi.yaml](docs/openapi.yaml)).

- **Live demo:** https://keyloop-inventory-dashboard.vercel.app (try [`?mock=error`](https://keyloop-inventory-dashboard.vercel.app/?mock=error) for the error state)
- **System design:** [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) (architecture, data flow, technology choices, observability, assumptions)

## What it does

| Requirement | How it is met |
|-------------|---------------|
| **Inventory visualization**: a filterable list of a dealership's vehicles | Dealership selector, then a paged table filtered by make, model (narrowed to the chosen make), age band, and VIN or model search. Filtering and paging run on the server side of the API. |
| **Aging stock identification** | Vehicles with more than 90 days in stock get an amber "Aging" badge and row marker. There is an **Aging stock** tab, KPI cards (aging count, aging rate, aging vehicles with no action) and an age chart where you can click a band to filter. |
| **Actionable insights**: log and persist a status or action | Each aging vehicle has a **Log action** button that opens a panel with a status, a note and your name. Entries are **appended to a history** rather than overwritten. They are persisted, survive a page reload, and the latest entry appears as the vehicle's status. A rule-based **suggested next step** escalates with age: price reduction, then promote or transfer, then auction. |

Also included: loading, empty and error states with retry; vehicles with invalid or future stock dates are flagged rather than crashing the page; keyboard-accessible controls; light and dark themes.

## Run it

Requires Node.js 20.19+ (developed on Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server with the mock backend |
| `npm run build` | Type-check (`vue-tsc`) and production build in `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit, contract and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against the production build. First run `npx playwright install chromium`. |

**Mock backend controls** (add to the page URL):
- `?mock=error`: every API call returns HTTP 500, to show the error state
- `?mock=slow`: 2.5 s latency, to show the loading states
- To reset data, clear the site's local storage (key `keyloop-inventory-db-v1`); the seed is generated again.

## Tests

| Layer | Where | What it proves |
|-------|-------|----------------|
| Unit (domain rules) | `src/domain/*.test.ts` | Stock age in whole UTC days, including leap days and DST changes; **day 90 is not aging, day 91 is**; invalid and future dates are rejected; age bands; suggestions; filtering, sorting, paging and clamping; KPI maths |
| Contract | `src/mocks/handlers.test.ts` | The mock API behaves as `openapi.yaml` describes: server-side filters, 400/404/422 errors, validation, history newest first, and that only aging vehicles accept actions |
| Persistence | `src/mocks/db.test.ts` | Append-only history, survival across reloads, recovery from corrupt storage, and in-memory fallback when storage is unavailable |
| Component | `src/components/*.test.ts` | Table badges and buttons; action panel history, saving, validation and server errors, using the real mock backend instead of stubs |
| End-to-end | `e2e/inventory.spec.ts` | In a real browser: filtering, the aging view, **log an action → reload → still there**, switching dealership, and error and empty states |

Two **mutation checks** confirmed the tests catch real bugs. Changing `days > 90` to `days >= 90` makes 6 unit tests fail. Turning off persistence makes the reload E2E test fail.

## Project structure

```
src/
  domain/        pure business rules (aging.ts, query.ts) + tests, no Vue imports
  api/client.ts  typed fetch wrapper: timeout, x-request-id, ApiError, latency logging
  stores/        Pinia store: filters, paging, loading/error state, cancels outdated requests
  components/    KpiCards, AgeChart, FilterBar, VehicleTable, ActionPanel
  mocks/         MSW handlers (implement openapi.yaml), seed data, localStorage DB
  observability/ structured logger + global error capture
docs/            SYSTEM_DESIGN.md, openapi.yaml
e2e/             Playwright specs
```

To connect a real backend, delete the `startMockBackend()` block in `src/main.ts`. The UI only talks to `/api/*` as defined in the OpenAPI contract.

## AI Collaboration Narrative

I built this with **Claude Code** (Anthropic's agentic coding tool, model Claude Opus 5.5) as the implementer. I acted as the tech lead: I set the direction and constraints, reviewed every step, and decided what was good enough.

### Strategy: constrain first, then delegate in small, testable slices

1. **I made the product decisions myself.** I chose Scenario B, the Vue stack, the "intelligent" features (KPIs, age bands, rule-based suggestions, append-only history) and the quality bar: test-driven pure functions, edge cases on day 90 and day 91 and on invalid dates, three test layers, an OpenAPI contract and a deployed demo.
2. **No guessing.** I told the agent to ask whenever a requirement was ambiguous. Before writing any code it read the brief, summarised the requirements that are easy to miss (for example, that the age filter is *required*, and that the System Design Document needs six specific sections) and asked me four questions: repo visibility, hosting, CSS approach and document format. The interpretations it was left to make, such as UTC calendar days and the ">90" boundary, are written down as assumptions A1–A8 in the design document.
3. **Contract first, then build inwards out.** First the design document and API contract. Then the domain rules (tests first). Then the mock backend with contract tests. Then the UI. Finally E2E tests against the production build. Each slice was committed separately, so each one can be reviewed on its own.

### Verification: what went wrong and how it was caught

Green tests were never accepted as proof on their own. These are real problems found during the build:

- **An outdated API that passed silently.** The agent used the MSW v2 option `onUnhandledRequest`, but MSW v3 renamed it to `onUnhandledFrame`. Every test was green, yet the safety net that should fail a test on an unexpected request was switched off. The type-check (`vue-tsc`) caught it, not the tests. Lesson: the type-checker runs alongside the tests, and library APIs are checked against the installed type definitions, not from memory.
- **Date logic outside the domain layer.** Seed data and a test helper compared date *strings* (`stockedAt <= '…'`). That would treat the invalid date `2026-02-30` as aging, and the hard-coded date in the helper would break as time passes. Both now call the tested domain functions. I am honest about one detail: with the current seed the bug was latent, so the new test guards against regressions rather than reproducing a failure.
- **Tests that could pass for the wrong reason.** In the first E2E draft, a loop read only one cell where it should have read every row, and a filter assertion could pass against the *previous* list before the new response arrived. I rewrote both with `expect.poll` so every row is checked after the re-render.
- **Layout bug found by measuring.** The page scrolled sideways on desktop. Measuring in the browser traced it to two causes: a CSS grid `auto` track stretching to the table's width, and visually hidden accessibility labels (`position: absolute`) escaping the table's scroll container. Both are fixed.
- **Possible flaky tests closed off before they appeared:** the ordering of actions with identical timestamps is now stable, and the mock skips its latency timer in tests.
- **Mutation checks:** the threshold mutation and the persistence mutation (see Tests) showed the suites fail when the behaviour breaks.

### How I kept ownership of quality

- Business rules live in small pure functions, and I can explain and change them without the AI.
- Every assumption is written down, and each one maps to a test.
- `vue-tsc`, 71 Vitest tests and 6 Playwright tests run before every commit, and the main flows were also checked by hand in a real browser.
- AI-generated text, including this README, was reviewed and edited by me before submission.
