# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server on port 5173. Proxies `/api/*` to `http://localhost:8420` (the `asc` backend).
- `npm run build` — type-check (`tsc -b`) then Vite production build to `dist/`.
- `npm run preview` — serve the built bundle.
- `npm test` — run the Vitest suite once (jsdom env, `tests/**/*.test.{ts,tsx}`).
- `npm run test:watch` — watch mode.
- Run a single test: `npx vitest run tests/build/Build.test.ts` (or filter by name with `-t "is usable"`).

## Architecture

The app is a React 19 + Vite SPA that provides a UI over the `asc` (App Store Connect) CLI. It runs in two data modes and uses a consistent per-feature module layout.

### Data modes (`src/shared/api-client.tsx`)

Two modes, controlled by `DataModeContext`:
- **`mock`** — each feature's `infrastructure/*.mock.ts` returns hard-coded objects. Default on startup.
- **`rest`** — `apiClient.get/post` hits the real backend through the Vite `/api` proxy.

On mount, `DataModeProviderComponent` probes `GET /api/v1` with a 2s timeout and flips to `rest` if the backend responds. The mode can also be toggled from the header (`useToggleMode`). Hooks read `useDataMode()` and pass it into the slice's infrastructure — either a `repositoryFor(mode)` factory that returns a repository class (the canonical shape, see `src/app/`) or a legacy `fetchX(appId, mode)` function that branches internally. **Never fetch directly from components — always go through the slice's infrastructure.**

`apiClient.get` runs responses through `normalizeLinks()`, which converts HAL-style `_links: { action: { href } }` into a flat `affordances: Record<string, string>` on each resource (and recurses into nested `data`). Domain classes then check capabilities via `'actionName' in this.affordances`.

`apiClient.runCommand(cmd)` POSTs `{ command: "asc <cmd>" }` to `/api/run` — this is how UI actions invoke the CLI. Output should flow into the `CommandLogContext` (surfaced via the header's command-log modal).

### TDD & rich domain design

This codebase follows **Chicago-school (state-based) TDD** over a **rich, mutable, observable domain model** (MobX). The domain class owns the behavior; components and infrastructure are thin. Navigation between aggregates flows through **repository ports**: `src/app/` is the canonical slice — see `docs/features/README.md` for the full playbook. The domain aims for 1:1 parity with the Swift SDK at `Sources/AppStoreSdk/Domain/` (mutable `@Observable` classes, stored repository refs, in-place caching of loaded children).

- **Rich mutable domain** — `src/<feature>/<Feature>.ts` is the only place business rules live. Fields are `var` (mutable); navigation methods mutate in place (`this.versions = await repo.versions(this)`). Classes call `makeAutoObservable(this)` in the constructor so mutations propagate to `observer()`-wrapped React components. Components do not compute `build.processingState === 'VALID' && !build.expired`; they read `build.isUsable`. Route handlers do not inspect `_links` directly; they check `build.canAddToTestFlight`.
- **Options-object constructors** — aggregates take a single `<Feature>Init` interface (see `src/app/App.ts`). Avoid positional arguments; they are fragile as the aggregate grows.
- **Repository ports, not free fetchers** — new slices define `<Feature>Repository` in `src/<feature>/<Feature>Repository.ts` and expose a root aggregate (e.g., `Apps`) that wraps it. Mock and REST implementations live in `infrastructure/`; a `repositoryFor(mode)` factory picks one. Repository references are **stored on the aggregate** (e.g., `App.repository`), installed via `setRepository(...)` or threaded through the factory. Legacy slices still expose `fetchX(appId, mode)` — migrate to the repository shape when you touch them.
- **Affordances are HATEOAS hrefs** — `apiClient.get` runs `normalizeLinks()` which flattens `_links: { action: { href } }` into `affordances: Record<string, string>` where the value is the URL path (e.g. `/api/v1/apps/app-1/versions`). Mock fixtures use the same shape so mock and REST modes are behaviourally identical. Capability checks use key presence only (`'getVersions' in this.affordances`).
- **State-based tests with `vi.fn()` stubs** — see `tests/app/App.test.ts`, `tests/app/Apps.test.ts`, and `tests/workspace/ASCWorkspace.test.ts`: construct the real domain object, pass a plain-object repository whose methods are `vi.fn().mockResolvedValue(...)`, call the mutator, assert on the *mutated state* (primary) and `toHaveBeenCalledWith(...)` / `not.toHaveBeenCalled()` when the intent is "repo should/shouldn't be hit." Do not mock the domain class itself, do not assert call sequences, and do not reach for `ts-mockito`/`vitest-mock-extended` — native Vitest mocking is enough.
- **TDD loop** — red/green/refactor per behavior. Add one failing test that expresses the intent in domain terms (`isUsable`, `canDoX`, `loadVersions`, `selectVersion`), make it pass with the minimum change, then refactor. Each `<Feature>.test.ts` groups by: semantic booleans, capability checks, display getters (e.g. `statusLabel`/`statusTone`), navigation mutators (mutates in place, short-circuits when affordance missing, throws without repo), and `fromJSON` hydration.
- **Hooks and infra are integration-covered, not unit-tested** — `<Feature>.hooks.ts` is a thin wrapper that builds `new <Root>(await repositoryFor(mode))`; components that read observable state are wrapped in `observer(Component)` from `mobx-react-lite`; exercise them through page-level tests when needed rather than mocking React.

### Session / workspace

The user's current focus — which app, which version — is coordinated by `src/workspace/ASCWorkspace.ts` (MobX observable). `WorkspaceProvider` in `src/workspace/ASCWorkspace.hooks.tsx` builds an `ASCWorkspace` per data-mode, hydrates it via `LocalStorageWorkspaceStore`, and exposes it through context. Consumers call `useWorkspace()` and must be wrapped in `observer()` to re-render on focus changes. `ASCWorkspace` is a UI-shell concept, not a domain aggregate — the Swift SDK does not have one, because the CLI is scoped to a single app per invocation.

### Feature module layout — cake-slice (vertical slice) pattern

The codebase is sliced **by feature, not by layer**. Each `src/<feature>/` is a self-contained cake slice that cuts through all layers — domain, application (hooks), infrastructure, and UI — for one capability. There is no top-level `controllers/`, `services/`, `repositories/`, or `components/`; those concerns live *inside* the slice they belong to. Slices depend on `src/shared/` and on each other's *domain class only* (never reach into another slice's `infrastructure/` or `pages/`).

The canonical shape (see `src/app/`) is:

```
src/<feature>/                       ← one cake slice
  <Feature>.ts                   # Domain: mutable observable class
                                 # (makeAutoObservable), options-object
                                 # constructor, semantic booleans,
                                 # capability getters, navigation mutators
                                 # (app.loadVersions() sets this.versions),
                                 # fromJSON(json, repo?) factory.
  <Feature>Repository.ts         # Port: interface the domain depends on
                                 # (list/get/plus navigation queries).
  <Features>.ts                  # Root aggregate (plural): thin wrapper
                                 # around the repository — list(), get(id).
  <Feature>.hooks.ts             # Application: React hooks that build
                                 # `new <Root>(await repositoryFor(mode))`
                                 # and delegate.
  infrastructure/
    <Feature>.api.ts             # Rest<Feature>Repository class + the
                                 # `repositoryFor(mode)` factory that lazy-
                                 # imports the mock.
    <Feature>.mock.ts            # Mock<Feature>Repository class with
                                 # deterministic fixtures (attach `this` to
                                 # every hydrated domain object so nav works;
                                 # affordance values are HATEOAS hrefs).
  pages/                         # UI: route-level components, lazy-loaded in App.tsx.
                                 # Wrap in `observer()` if they read domain state.
  components/                    # UI: leaf components for this feature.
```

Domain classes (e.g., `src/app/App.ts`) expose five kinds of members:
1. **Semantic booleans** — `isValid`, `isUsable`, `isLive` — named for intent, not raw enum values.
2. **Capability checks** — `canAddToTestFlight` → `'addToTestFlight' in this.affordances`. Gate UI actions on what the backend says is allowed.
3. **Display getters** — `statusLabel`, `statusTone`, `displayName` — pure mappings over state fields; used directly in templates instead of component-side switch statements.
4. **Navigation mutators** — `async loadVersions()`, `selectVersion(id)` — gate on the matching capability, then delegate to `this.repository.<method>(this)` and mutate the aggregate's fields in place. Short-circuit to `[]` when the affordance is absent; throw only if navigation is attempted without a repository attached. Mutation inside async work should go through `runInAction(...)`.
5. **`static fromJSON(json, repo?)`** factory — tolerant of alternate field names (`version ?? buildNumber`), and threads an optional `repo` so hydrated objects can navigate.

**Legacy slices** (`build/`, `version/`, `testflight/`, `iap/`, `code-signing/`, etc.) still use the pre-repository shape: a free `fetch<Feature>(appId, mode)` function in `infrastructure/<Feature>.api.ts` plus a plain-value-object domain class. Keep them working as-is; migrate to the repository shape when you next touch one. Full playbook: `docs/features/README.md`.

**Adding a new feature**: scaffold the canonical shape above, register its page route in `src/App.tsx`, and add `tests/<feature>/<Feature>.test.ts` + `tests/<feature>/<Features>.test.ts`. Keep the slice closed: don't spread one feature's concerns across other folders.

### Routing & pages

`src/App.tsx` is the single router. All feature pages are `React.lazy` imports; add new built-in routes there. The shell (`Sidebar`, `Header`, `CommandLogModal`) wraps `<Routes>`. Providers stack: `ThemeProvider` → `DataModeProviderComponent` → `WorkspaceProvider` → `CommandLogProvider` → `BrowserRouter` → `PluginProvider`.

### Plugin system (`src/plugin/`)

`pluginRegistry` (singleton) accepts `PluginRegistration { id, name, version, pages?, sidebarItems?, widgets? }`. `App.tsx` appends `pluginRegistry.getPages()` as additional `<Route>`s; `Sidebar.tsx` reads `getSidebarItems()`; `PluginSlot` components render widgets by slot name. Plugins are lazy-loaded the same way as built-in pages.

### Styling

CSS lives in `src/styles/` (`theme.css`, `base.css`, `layout.css`, `components.css`, `utilities.css`) and is imported from `src/main.tsx` so Vite bundles/hashes it. Static runtime assets (icons, device frames) go in `public/` and resolve at absolute paths like `/frames/iPhone 17.png`.

### TypeScript notes

`tsconfig.json` has `allowImportingTsExtensions: true`, so imports explicitly include `.ts`/`.tsx` suffixes (`import { Build } from './Build.ts'`). Path alias `@/*` → `src/*` is wired in both `vite.config.ts` and `vitest.config.ts`. `strict` + `noUnusedLocals`/`noUnusedParameters` are on — prefix unused params with `_` rather than leaving them.
