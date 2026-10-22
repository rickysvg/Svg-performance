# Interaction suite

Playwright coverage for the routes and controls in `data/inventory.json`. Projects `m375` (375×812) and `m430` (430×932) share one setup project that signs in.

## Commands

From the repo root:

```bash
npm run test:e2e
npm run test:e2e:public
npm run test:e2e:member
```

Or from this directory: `npm test`, `npm run test:public`, `npm run test:member`.

## Environment

No credentials are stored in the repo. The signed-in session is written to `e2e/.auth/member.json` (gitignored). That file is Playwright `storageState` and holds the test account's session cookie. It is never placed under `e2e/results` and never uploaded.

| Name | Where | Purpose |
|---|---|---|
| `BASE_URL` | env | Page under test. Defaults to `https://svg-performance.vercel.app`. |
| `TEST_EMAIL` | env / Actions secret `QA_TEST_EMAIL` | Dedicated test-member email. |
| `TEST_PASSWORD` | env / Actions secret `QA_TEST_PASSWORD` | Password for that test member. |
| `STRICT` | env | `1` fails the test when an always-render test id is missing. On in CI unless set to `0`. |
| `E2E_SEEDED_PATHS` | env | Optional JSON object of inventory route → pathname, for dynamic routes. |
| `RUN_ADMIN` | env | Set to visit `/admin` routes, including dynamic admin routes. |

Create the secrets in Settings → Secrets and variables → Actions. Do not point `QA_TEST_EMAIL` at a real member.

GitHub Actions runs this suite on a push to `main` and on `workflow_dispatch`, always against production. Pull requests do not run it. The upload publishes `report.json`, the HTML report, screenshots, and the per-item JSONL. It does not upload `e2e/.auth`, `storageState`, or Playwright traces.

## STRICT / always-render

`data/always-render.json` lists inventory ids that are in the DOM on first paint:

- Login, register, forgot-password, and reset-password forms (the page is the form).
- `SHARED-004` (`chrome-link`), the member dock logo on `/home`.

Sheets, toasts, empty lists, and prefix selectors stay `NOT-PRESENT` when absent. With `STRICT=1` (the CI default), a missing always-render test id fails that route. Set `STRICT=0` to record the miss without failing.

Production serves the previous deploy until Vercel finishes the push. A `main` run that starts before that deploy will fail these checks until the test ids are live. Re-run with `workflow_dispatch` after the deploy.

## Dynamic routes

`tests/specs/dynamic.spec.ts` covers the 21 inventory routes that contain a `[param]`. Each test opens a concrete pathname from `E2E_SEEDED_PATHS` or from a link (or photo id) on the signed-in account, then runs the same checks as a static route. If the account has no such id, the test skips. Admin dynamic routes also skip unless `RUN_ADMIN` is set.

`/training/[dayId]/start` is listed and always skipped. Opening it calls `startProgramDayLog` and creates a session.

Example:

```bash
E2E_SEEDED_PATHS='{"/clips/[clipId]":"/clips/EXAMPLE"}' npm run test:e2e:member
```

## UNSAFE controls

Controls marked `unsafe` in the inventory (send, pay, delete, approve, message) are not activated. The suite checks that they are present and records `SKIP-UNSAFE`. That holds on production. The only account the suite signs in is the QA test account.

## `data-testid` names

`{route}-{element}`

- `route` is the pathname with `/` turned into `-`, dynamic segments such as `[id]` dropped. `/` is `root`. Shared chrome is `chrome`.
- `element` is a kebab-case name from the control's `name`, accessible label, or kind (`save-workout`, `session-length-min`, `form`).
- A list item is `{route}-{element}-${key}`, and the inventory selector is the prefix `data-testid^="{route}-{element}-"`.
- A component rendered on more than one route keeps the shortest route's prefix.
- Toast action buttons use `chrome-toast-action-<name>` (`chrome-toast-action-remove`, `chrome-toast-action-move`). The inventory selector is the prefix `data-testid^="chrome-toast-action-"`.

Examples: `bagwork-new-save-workout`, `checkin-region-${id}`, `chrome-timer-toggle-bell`.
