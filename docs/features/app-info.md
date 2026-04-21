# Feature: App Info

App Info is the **metadata editor** for the currently-selected app — what shows up on the App Store listing and what Apple uses for review. It lives under the **App Catalog** bounded context (see [`docs/domain/asc-context-map.html`](../domain/asc-context-map.html)).

Ubiquitous-language reference: [`docs/domain/asc-ubiquitous-language.html`](../domain/asc-ubiquitous-language.html). Terms used below (*App Info*, *Localization*, *Category*) match the glossary entries there.

---

## Design decision — why web, not a multi-tab mobile workspace

The Swift sibling app (`AppNexus-iOS`) splits App Info into five swipeable tabs (Essentials, Story, Version, Privacy, Support), each backed by its own aggregate, plus a `SubmissionReadiness` score and a floating FAB. That pattern is right for a narrow mobile screen.

This is a web app. We have horizontal real-estate, URL-addressable state, and a keyboard. The web equivalent is:

- **One page, multiple sections, a single scroll.** Not tabs.
- **Inline editing** where it reads naturally (the localizations table), explicit form controls where values are structural (name, categories, URLs).
- **One sticky save bar** that appears only when something's dirty. No per-entity `hasUnsavedChanges` ceremony.
- **No readiness FAB, no score, no aggregate for it** — yet. If users ask for "what am I missing before I can submit", we add it later on the Version page (where submission actually happens), not here.

If a section grows so large it needs its own page (e.g., screenshots), it gets its own slice. App Info stays focused on **textual + categorical metadata** — the fields a developer types or picks.

---

## User journey

1. User clicks "App Info" in the sidebar (routed to `/app-info`).
2. Page resolves the currently-selected app from `useWorkspace()`, shows a spinner while loading.
3. Page fetches the app's info + localizations in parallel and renders sections:
   - **Overview** — name, subtitle, primary locale. Read-only: bundle id, SKU.
   - **Categories** — primary + secondary, picked from `appCategories` taxonomy.
   - **Localizations** — table of locales; click a row to expand inline name + subtitle editors. Add-locale button.
   - **Privacy & Support** — privacy policy URL, support URL, marketing URL.
4. User edits any field. A sticky footer appears: `Discard · Save changes`.
5. Save writes back and clears the dirty state. Discard restores the last loaded values.

Switching the selected app in the sidebar reloads the page for the new app (with an unsaved-changes confirmation if dirty).

---

## Scope

Per the bounded-context map:

| Section            | Scope              | Why |
|--------------------|--------------------|-----|
| Overview fields    | **selected app**   | Each field is per-app. |
| Categories         | **selected app**   | Primary/secondary categories are app-level. |
| Localizations      | **selected app**   | Apple's `/v1/apps/{id}/appInfoLocalizations`. |
| Privacy & Support  | **selected app**   | URLs are per-app. |

Version-specific metadata (what's new, release notes, promotional text) belongs on the **Version** slice, not here. This page never touches `appStoreVersionLocalizations`.

---

## Data sources

**Mock-first** — the backend's REST endpoint for app-infos is not ready (`GET /api/v1/apps/{id}/app-infos` returns 404 as of writing, even though `/api/v1/apps/{id}` advertises it via `_links.listAppInfos`). The `asc` CLI doesn't yet expose `app-infos get/update` either.

So the slice ships with a `MockAppInfoRepository` that stores an in-memory map keyed by app id. Mock fixtures seed the two known apps. REST mode falls back to mock data with a console warning until the endpoint lands.

When the backend is ready, switch `RestAppInfoRepository` from throw-to-mock to the real calls below:

```
GET   /api/v1/apps/{id}/app-infos                              # the "generic" info (categories, content rights)
GET   /api/v1/apps/{id}/app-info-localizations                 # list of locales + localized fields
POST  /api/v1/app-info-localizations                           # add a locale
PATCH /api/v1/app-info-localizations/{id}                      # edit name / subtitle / privacy / support URLs
DELETE /api/v1/app-info-localizations/{id}                     # remove a locale
PATCH /api/v1/app-infos/{infoId}                               # update categories, content rights
```

- List calls go through `Promise.all` so the page renders when the slowest finishes.
- Each call is wrapped in a `safeGet` that returns an empty domain object on failure, so a broken endpoint never nukes the page.
- Saves are sent in **one transaction** per click — the save bar batches all dirty sub-sections and fires them sequentially, rolling back local state on error.

---

## Domain model

Rich-domain aggregate in [`src/app-catalog/app-info/AppInfo.ts`](../../src/app-catalog/app-info/AppInfo.ts).

Single aggregate, not five. Sub-structure is a plain field, not a sub-aggregate, until we have a reason otherwise.

```ts
export class AppInfo {
  appId: string;

  // Structural fields (what lives on the `/app-infos/{id}` resource)
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;

  // Per-app fields that are not localized
  privacyPolicyUrl: string | null;
  supportUrl: string | null;
  marketingUrl: string | null;

  // One row per locale
  localizations: AppInfoLocalization[];

  // Dirty tracking — the whole aggregate, not per-field
  get hasUnsavedChanges(): boolean { ... }

  // Mutating operations
  setPrimaryCategory(id: string | null): void
  setSecondaryCategory(id: string | null): void
  setPrivacyPolicyUrl(url: string | null): void
  setSupportUrl(url: string | null): void
  setMarketingUrl(url: string | null): void
  addLocalization(locale: string): AppInfoLocalization
  removeLocalization(locale: string): void

  async save(): Promise<void>    // batches all changes through the repository
  discard(): void                // restores the last-saved snapshot
  async reload(): Promise<void>  // re-fetches from the repository
}

export class AppInfoLocalization {
  id: string;          // backend id; empty string for a locally-added locale awaiting save
  locale: string;      // "en-US", "de-DE", …
  name: string;
  subtitle: string | null;

  setName(name: string): void
  setSubtitle(subtitle: string | null): void
  get hasUnsavedChanges(): boolean
}
```

**MobX-observable**, matching the convention in `src/app-catalog/app/App.ts`. The aggregate holds a pristine snapshot internally so `discard()` and `hasUnsavedChanges` are easy: they compare current state to snapshot.

Semantic helpers (as getters):

- `AppInfo.isComplete: boolean` — name + subtitle + primary category + privacy URL present for the primary locale. Cheap signal for a later "ready to submit" hint, without building a scoring aggregate.
- `AppInfo.missingFields(locale): string[]` — list of field labels missing for that locale, used by the localization row badge.

**No separate aggregate for categories, privacy, support, etc.** Those are fields. If the Privacy section grows (e.g., privacy nutrition labels, data-collection declarations), it gets extracted to its own slice (`src/app-catalog/app-privacy/`) because it's a different bounded concern.

---

## Root aggregate (`AppInfos`)

```ts
export class AppInfos {
  constructor(private readonly repo: AppInfoRepository) {}
  get(appId: string): Promise<AppInfo>;
}
```

Thin wrapper, for symmetry with `Apps` and to give `AppInfo.hooks.ts` a single entry point.

---

## File map

```
src/app-catalog/app-info/
  AppInfo.ts                          # Aggregate — sections, localizations, dirty tracking
  AppInfoLocalization.ts              # Entity — one locale's name/subtitle
  AppInfoRepository.ts                # Port — get/save/addLocale/removeLocale
  AppInfos.ts                         # Root aggregate — entry point
  AppInfo.hooks.ts                    # useAppInfo(appId) → { appInfo, loading, error }
  infrastructure/
    AppInfo.api.ts                    # RestAppInfoRepository (falls back to mock when 404s) + repositoryFor(mode)
    AppInfo.mock.ts                   # MockAppInfoRepository with in-memory fixtures for app-1 / app-2 (and live apps if REST is up)
  pages/
    AppInfoPage.tsx                   # Single-route page — sections + sticky save bar
  components/
    AppInfoSection.tsx                # Section shell (heading + body + optional action)
    LocalizationsTable.tsx            # Inline-editable table with add-locale row
    LocaleRow.tsx                     # One row; expands on click to name + subtitle editors
    AppInfoSaveBar.tsx                # Sticky footer — appears only when aggregate is dirty

tests/app-catalog/app-info/
  AppInfo.test.ts                     # Aggregate: setters, addLocalization, removeLocalization, dirty, discard, save
  AppInfoLocalization.test.ts         # Setters + dirty tracking
  AppInfos.test.ts                    # Root aggregate delegates get to the repository
```

Follows the cake-slice rules in [`docs/features/README.md`](./README.md). Depends only on domain classes from other slices (`src/app-catalog/app/App.ts` for the selected app's id/name in the page header).

---

## Workspace integration

`AppInfoPage` reads the selected app id from [`useWorkspace()`](../../src/workspace/ASCWorkspace.hooks.tsx):

```tsx
const workspace = useWorkspace();
const app = workspace?.currentApp;
const { appInfo, loading, error } = useAppInfo(app?.id ?? null);
```

If `workspace` is not hydrated, the page renders a spinner. If `currentApp` is null (no app pinned), the page renders an empty state with a pointer to the sidebar app picker. When the user switches app via the sidebar, the hook's dependency on `app.id` re-fires and the page reloads.

If the page is dirty when the user switches apps, a **confirmation prompt** blocks the switch (standard `beforeunload` pattern extended to the in-app navigation). This is the one place we *do* take the discard/save question seriously — losing metadata changes on a misclick would be painful.

---

## UI layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ App Info · Bakery App                                               │
├─────────────────────────────────────────────────────────────────────┤
│ Overview                                                            │
│   Name        [Bakery App                    ]                      │
│   Subtitle    [Fresh bread every morning     ]                      │
│   Bundle ID    com.asccli.bakery              (read-only)           │
│   SKU          bakery-ios-2026                (read-only)           │
│   Primary loc  [en-US ⌄]                                            │
├─────────────────────────────────────────────────────────────────────┤
│ Categories                                                          │
│   Primary    [Food & Drink ⌄]   Secondary  [— ⌄]                    │
├─────────────────────────────────────────────────────────────────────┤
│ Localizations                                  [+ Add locale]       │
│                                                                     │
│   ▸ en-US    Bakery App          Fresh bread every morning          │
│   ▸ de-DE    Bäckerei-App        Täglich frisches Brot              │
│   ▾ fr-FR    Boulangerie         (missing subtitle)   [Remove]      │
│       Name      [Boulangerie                  ]                     │
│       Subtitle  [                              ]                    │
├─────────────────────────────────────────────────────────────────────┤
│ Privacy & Support                                                   │
│   Privacy Policy URL    [https://...]                               │
│   Support URL           [https://...]                               │
│   Marketing URL         [https://...]                               │
└─────────────────────────────────────────────────────────────────────┘

 ───────────── (sticky, only when dirty) ──────────────
 3 unsaved changes                 [Discard] [Save changes]
```

Reuses existing CSS primitives (`.card`, `.toolbar`, `.form-row`, `.form-group`, `.form-control`, `.select-styled`). Localization row expand/collapse uses CSS `details`/`summary` or a small `is-expanded` class. Save bar is a new primitive (`.save-bar`) added to `components.css`; it's a dashed-top-border strip pinned to the bottom of the content area.

---

## Testing

Chicago-school with `vi.fn()` stubs — same convention as the rest of the codebase.

- **AppInfo domain** — construct `new AppInfo(...)` from JSON, apply setters, assert `hasUnsavedChanges` flips, `discard()` restores, `save()` calls the repo with a payload that reflects the dirty sub-sections only.
- **AppInfoLocalization domain** — setters + dirty tracking.
- **AppInfos aggregate** — single test that `get(appId)` delegates and returns an `AppInfo`.
- **Repository shape** — `save()` round-trips a dirty aggregate through the repo; covers the batch-save happy path.
- **Not unit-tested**: the page, hooks, or save-bar. Those are integration-covered; we run the dev server against mock mode and click through the flow.

Use `vi.setSystemTime` if we ever add timestamps; not needed today.

---

## Known limitations

| Limitation | Why | Fix path |
|---|---|---|
| Categories dropdown hard-codes a short list | `/api/v1/app-categories` exists on the API root but the payload shape isn't validated yet | Fetch lazily into a `CategoriesRepository` slice; cache for the session |
| No age rating editor | Age rating has its own nested structure (questionnaire → rating); too big for this page | Separate `/age-rating` page or modal |
| No primary-locale change UI | Requires a backend call that replaces the primary; risky if other fields aren't filled in the new locale | Separate "change primary locale" modal with a guardrail check |
| REST falls back to mock silently | Backend endpoint not yet built | Switch to real calls once backend ships; delete the fallback |
| Can't reorder locales | Locales render in fetch order | Trivial add when asked; no backend support needed |
| No bulk-translate | AI translation is a separate skill/backend (see `asc app-infos` skill) | Add "Translate from en-US" button calling that skill |

---

## Non-goals

- **Not a screenshot editor.** Screenshots have their own slice (`src/app-catalog/screenshot/`).
- **Not a version editor.** What's new, release notes, promotional text, release type, build attachment — all live under `src/release/version/`. This page never writes to `appStoreVersionLocalizations`.
- **Not a submission tool.** Submit-for-review happens on the Version page. If a readiness signal emerges as useful across pages, it goes in a shared slice, not here.
- **Not a 5-tab workspace.** The iOS sibling's pattern fits mobile; on web a single scrollable page is denser and easier to scan.
- **Not a settings panel for ASC account preferences.** That's a different bounded context entirely.

---

## Adding a field

1. **Extend `AppInfo`** — add a field + setter + include it in the snapshot comparison that drives `hasUnsavedChanges`.
2. **Extend the repository port** — either add a new method or extend the payload of `save()` with the new field.
3. **Extend the mock** — seed a value in fixtures; implement persistence in the in-memory store.
4. **Extend the REST adapter** — add the PATCH or include the field in the existing one.
5. **Extend the page** — drop it into the right section (Overview / Categories / Privacy & Support / a new section if the field doesn't fit any existing bucket).
6. **Add tests** — one that setter flips dirty, one that `save()` includes the field when dirty.

Don't introduce a new sub-aggregate for a single field. Only extract a sub-aggregate when it has its own ports (e.g., needs to talk to a separate endpoint with its own rate limit).
