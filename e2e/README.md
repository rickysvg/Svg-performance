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

No credentials are stored in the repo.

| Name | Where | Purpose |
|---|---|---|
| `BASE_URL` | env | Page under test. Defaults to `https://svg-performance.vercel.app`. |
| `TEST_EMAIL` | env / Actions secret `QA_TEST_EMAIL` | Dedicated test-member email. |
| `TEST_PASSWORD` | env / Actions secret `QA_TEST_PASSWORD` | Password for that test member. |

GitHub Actions also accepts an optional repository variable `QA_PREVIEW_BASE_URL` when a pull request's Vercel preview URL cannot be resolved. Create the secrets in Settings → Secrets and variables → Actions. Do not point `QA_TEST_EMAIL` at a real member.

Pull requests run against the Vercel preview deployment. Pushes to `main` run against production.

## UNSAFE controls

Controls marked `unsafe` in the inventory (send, pay, delete, approve, message) are not activated. The suite checks that they are present and records `SKIP-UNSAFE`. That holds on preview and on production. The only account the suite signs in is the QA test account.

## `data-testid` names

`{route}-{element}`

- `route` is the pathname with `/` turned into `-`, dynamic segments such as `[id]` dropped. `/` is `root`. Shared chrome is `chrome`.
- `element` is a kebab-case name from the control's `name`, accessible label, or kind (`save-workout`, `session-length-min`, `form`).
- A list item is `{route}-{element}-${key}`, and the inventory selector is the prefix `data-testid^="{route}-{element}-"`.
- A component rendered on more than one route keeps the shortest route's prefix.

Examples: `bagwork-new-save-workout`, `checkin-region-${id}`, `chrome-timer-toggle-bell`.
