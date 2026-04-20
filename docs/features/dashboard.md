# Feature: Dashboard

The Dashboard is a cross-cutting **read-model slice** that answers a single question: *"what needs my attention?"* It is not a bounded context of its own (it reads from Release, Signing & Identity, and App Catalog) — see [`docs/domain/asc-context-map.html`](../domain/asc-context-map.html) for where it sits.

Ubiquitous-language reference: [`docs/domain/asc-ubiquitous-language.html`](../domain/asc-ubiquitous-language.html). Terms used below (*Release*, *Submission*, *Build*, *Certificate*) match the glossary entries there.

---

## User journey

1. User opens `/` (first screen after auth).
2. Page renders a **briefing line** summarising everything urgent in one sentence, plus four clickable attention tiles.
3. Tiles navigate to the relevant sub-page (`/submissions`, `/code-signing`, `/builds`) so every claim is drill-through.
4. Below the tiles: two tables — **Expiring certificates** and **Recent builds across the fleet**.

Design principle, directly from the glossary/context work: dashboard is an *attention* tool, not a status board. Counters alone don't earn their pixels — each tile states a problem to solve or declares "nothing to do."

---

## Scope — fleet vs. per-app

Three scopes coexist on this page, not interchangeable:

| Tile / table              | Scope              | Reason |
|---------------------------|--------------------|--------|
| Awaiting Apple review     | **pinned app**     | Apple's `/v1/reviewSubmissions` requires `filter[app]` (schema: `required: true`). Fleet listing is impossible at the platform level. |
| Unresolved submissions    | **pinned app**     | Same as above. |
| Certificates expiring     | **fleet**          | Signing identity isn't app-scoped; one cert signs many apps. |
| Recent builds             | **fleet**          | `/api/v1/builds` now supports fleet listing (backend added it after initial ship). |

The "pinned app" (a.k.a. *current selected app*) is sourced from [`src/shared/current-app.tsx`](../../src/shared/current-app.tsx) — see below.

---

## Data sources — 4 calls, regardless of fleet size

```
GET /api/v1/builds?sort=-uploadedDate&limit=5
GET /api/v1/certificates?before=<now+14d ISO>&limit=200
GET /api/v1/apps/{currentAppId}/review-submissions?state=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW&limit=200
GET /api/v1/apps/{currentAppId}/review-submissions?state=UNRESOLVED_ISSUES&limit=200
```

- All four in `Promise.all`, each wrapped in `.catch(() => EMPTY)` so one 404/500 doesn't nuke the whole page.
- When `currentAppId === null`: submission calls are skipped entirely — those tiles show `0` with a helper hint.
- Server-side `?before=` narrows the cert payload; we still run `isExpiringSoon()` client-side to enforce the `isValid` gate (expired/revoked certs never show).
- Counts prefer `meta.paging.total` from the response, falling back to `data.length` when the backend omits meta.

---

## The `filter[app]` constraint (critical to understand)

Two Apple endpoints have different constraints:

| Apple endpoint          | `filter[app]`    | Fleet listing? |
|-------------------------|------------------|----------------|
| `/v1/reviewSubmissions` | **required**     | ❌ never — Apple 400s without it |
| `/v1/builds`            | optional         | ✅ works |
| `/v1/customerReviews`   | (no fleet endpoint at all) | ❌ per-app `/v1/apps/{id}/customerReviews` only |

Implication for this slice: the backend can never add a fleet-wide review-submissions route — this is a platform-level limit, not a backend gap. Per-pinned-app is the cheapest and only path.

---

## Current-app context

Lives in [`src/shared/current-app.tsx`](../../src/shared/current-app.tsx). Exposes:

```ts
const { currentAppId, currentApp, setCurrentAppId, availableApps, loading } = useCurrentApp();
```

Behaviour:

- On mount, fetches `/api/v1/apps` (or mock fixtures in `mock` mode) and populates `availableApps`.
- Reads `localStorage['asc.currentAppId']` — if it maps to an app in the list, keep it; otherwise default to `availableApps[0]`.
- `setCurrentAppId(id | null)` persists to localStorage.
- **Key timing rule**: `useDashboard` waits on `currentAppLoading` before firing, so the initial render doesn't load-with-null-then-reload-with-first-app.

Wired in [`src/App.tsx`](../../src/App.tsx) between `DataModeProviderComponent` and `CommandLogProvider`.

> Not yet built: a sidebar selector to *change* the pin. For now the user accepts the auto-pick. When we ship the selector it reuses `setCurrentAppId` without touching anything else.

---

## Domain model

Rich-domain aggregate in [`src/dashboard/Dashboard.ts`](../../src/dashboard/Dashboard.ts):

```ts
export class Dashboard {
  constructor(
    readonly submissionsAwaitingReview: number,
    readonly submissionsWithIssues: number,
    readonly expiringCertificates: Certificate[],
    readonly recentBuilds: Build[],
  ) {}

  get allClear(): boolean   // every count is zero, no certs expiring
  get hasWork(): boolean    // = !allClear
  get isUrgent(): boolean   // unresolved submissions, or a cert ≤7d
  get criticalCertificates(): Certificate[]  // ≤7 days
  get warningCertificates():  Certificate[]  // 8–14 days
}
```

Semantic booleans > raw counters. `isUrgent` isn't computed in the component — it's a getter on the aggregate, so the component never re-derives domain logic.

Expiry math lives on `Certificate`, not `Dashboard` — [`src/code-signing/Certificate.ts`](../../src/code-signing/Certificate.ts) exposes `daysUntilExpiration(now)`, `isExpiringSoon(within, now)`, `isExpiringCritical(now)`. Keeps the urgency rule in the cert domain where it belongs; the dashboard just filters.

---

## File map

Follows the repository pattern from [`docs/features/README.md`](./README.md):

```
src/dashboard/
  Dashboard.ts                        # Read-model domain aggregate
  DashboardRepository.ts              # Port: load(currentAppId | null) → Dashboard
  Dashboard.hooks.ts                  # useDashboard() — reads useDataMode + useCurrentApp
  infrastructure/
    Dashboard.api.ts                  # RestDashboardRepository + repositoryFor(mode)
    Dashboard.mock.ts                 # MockDashboardRepository with deterministic fixtures
  pages/
    DashboardPage.tsx                 # StatCard, CertificateRow, briefing, empty/error states

src/shared/
  current-app.tsx                     # CurrentAppProvider + useCurrentApp() — not dashboard-only

tests/dashboard/
  Dashboard.test.ts                   # Semantic booleans, urgency, groupings, repo delegation shape
```

Sibling slices that the dashboard depends on (**domain class only** per the cake-slice layering rules): `src/build/Build.ts`, `src/code-signing/Certificate.ts`. No imports of their `infrastructure/` or `pages/`.

---

## Testing

Chicago-school with `vi.fn()` stubs — same convention as the rest of the codebase.

- **Dashboard domain** — construct `new Dashboard(awaiting, issues, certs, builds)`, assert `allClear` / `hasWork` / `isUrgent` / groupings. Uses `vi.setSystemTime` to pin "now" for expiry math.
- **Certificate expiry math** — separate tests in `tests/code-signing/CodeSigning.test.ts` (also `vi.setSystemTime`).
- **Repository shape** — single test that `load(currentAppId)` receives the arg and returns a `Dashboard`. Also covers the `null` path. We do **not** unit-test `RestDashboardRepository` — that's integration territory; network behaviour would need an `apiClient` stub per call, which isn't worth the maintenance cost on a straightforward fan-out.

`DashboardPage.tsx` (React) is not unit-tested. Visual regressions are caught by running the dev server. Per the CLAUDE.md TDD guidance: hooks and rendering are integration-covered, not unit-tested.

---

## Known limitations

| Limitation | Why | Fix path |
|---|---|---|
| No "unanswered customer reviews" tile | No fleet `/v1/customerReviews` endpoint; per-app fan-out of N-per-render too chatty | Backend aggregator, or defer to a per-app detail page |
| Recent builds across all apps (not the pinned app) | Fleet `/v1/builds` is now available; showing pinned-app only would be less useful for multi-app teams | Add a `scope: fleet | pinned` toggle if users ask |
| No real-time activity stream | Poll-only today; `/v1/webhooks` exists (`APP_STORE_VERSION_APP_VERSION_STATE_UPDATED`, `BUILD_UPLOAD_STATE_UPDATED`, `BUILD_BETA_DETAIL_EXTERNAL_BUILD_STATE_UPDATED`, etc.) but backend isn't subscribed + buffering | Backend work: subscribe + expose SSE/websocket → swap poll for push |
| Can't change the pinned app from the UI | No selector built yet; auto-picks `availableApps[0]` | Sidebar selector using `setCurrentAppId` from `useCurrentApp()` |
| `submissionsAwaitingReview` and `submissionsWithIssues` are totals, not lists | Tiles only need counts; drill-through navigates to `/submissions` | Replace with an `include=items` query if we ever surface in-place detail |

---

## Adding a tile

Canonical steps, with references to the shipped code:

1. **Extend `Dashboard`** ([`Dashboard.ts`](../../src/dashboard/Dashboard.ts)) — add a readonly field + any semantic getters (`isXUrgent`, `criticalX`, …) that belong on the aggregate.
2. **Extend the repository query** ([`Dashboard.api.ts`](../../src/dashboard/infrastructure/Dashboard.api.ts)) — add the call inside the `Promise.all`, wrapped in the same `safeGet` so a failure degrades gracefully.
3. **Extend the mock** ([`Dashboard.mock.ts`](../../src/dashboard/infrastructure/Dashboard.mock.ts)) so mock-mode users see something realistic.
4. **Extend the page** ([`DashboardPage.tsx`](../../src/dashboard/pages/DashboardPage.tsx)) — use the existing `StatCard` component with one of the four tone colours (`orange` / `purple` / `blue` / `green`) and a `.stat-change.up|.down` badge for urgency.
5. **Add tests** — one per semantic boolean + one that verifies the repository shape.

Don't add UI-only tone classes or bespoke card markup — reuse `.stat-card`, `.stat-icon.*`, `.status.*`, `.empty-state` from [`src/styles/components.css`](../../src/styles/components.css). The dashboard already looks consistent with the rest of the tool; stay in that lane.

---

## Non-goals

- **Not a replacement for per-page detail.** The dashboard's job ends at "here's what's urgent"; every tile drills through to a page that does the actual work.
- **Not Apple's ASC web UI.** We deliberately avoid replicating the kitchen sink. Every tile must answer a real question a developer asks — counters for their own sake belong elsewhere.
- **Not a fleet-wide release overview.** That's a separate artifact (see "per-app release swim lanes" in the earlier dashboard-design notes, deferred). The dashboard is attention-claim; the release overview would be a different page scoped per-app or per-Version.
