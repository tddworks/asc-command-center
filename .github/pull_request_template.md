## Why

<!-- The problem this solves, in the user's words — not the change. Link the issue.
     "Fixes #123: IAPs queued for the next version show as not submitted."
     If there is no issue, say what you saw and who it affects. -->

Fixes #

## What changed

<!-- The effect, briefly. The diff shows the how. Name the slice(s) touched (e.g. monetization/iap). -->

## How it was verified

<!-- Tests that pin the behaviour (Chicago school: state, not calls), written and seen failing first.
     For UI: before/after screenshots in mock mode — never real app names, IDs, keys or customer data. -->

## Checklist

- [ ] The problem is stated above, not only the solution
- [ ] A failing test came first; `npm test` passes
- [ ] `npx tsc -b` and `npm run build` pass
- [ ] Mock fixtures updated to match any new backend field or affordance
- [ ] No key, Key ID, Issuer ID, real app ID or customer data in code, fixtures or screenshots
