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

On mount, `DataModeProviderComponent` probes `GET /api/v1` with a 2s timeout and flips to `rest` if the backend responds. The mode can also be toggled from the header (`useToggleMode`). Every data-fetching hook reads `useDataMode()` and passes it into the infrastructure function, which branches to mock vs REST. **Never fetch directly from components — always go through the feature's `infrastructure/*.api.ts`.**

`apiClient.get` runs responses through `normalizeLinks()`, which converts HAL-style `_links: { action: { href } }` into a flat `affordances: Record<string, string>` on each resource (and recurses into nested `data`). Domain classes then check capabilities via `'actionName' in this.affordances`.

`apiClient.runCommand(cmd)` POSTs `{ command: "asc <cmd>" }` to `/api/run` — this is how UI actions invoke the CLI. Output should flow into the `CommandLogContext` (surfaced via the header's command-log modal).

### TDD & rich domain design

This codebase follows **Chicago-school (state-based) TDD** over a **rich domain model**. The domain class owns the behavior; components and infrastructure are thin.

- **Rich domain** — `src/<feature>/<Feature>.ts` is the only place business rules live. Components do not compute `build.processingState === 'VALID' && !build.expired`; they read `build.isUsable`. Route handlers do not inspect `_links` directly; they check `build.canAddToTestFlight`. If you catch yourself writing domain logic inside a `.tsx`, move it onto the class and expose it as a getter.
- **State-based tests, no mocks of your own code** — see `tests/build/Build.test.ts`: construct the real object with raw state, call a getter, assert the boolean. Do not mock the domain class, and do not assert on method call sequences. Mocking is reserved for infrastructure boundaries (network, the `asc` CLI via `apiClient`).
- **TDD loop** — red/green/refactor per behavior. Add one failing test that expresses the intent in domain terms (`isUsable`, `canDoX`, `displayName`), make it pass with the minimum change, then refactor. Each `<Feature>.test.ts` should have three groupings mirroring the domain: semantic booleans, capability checks, and `fromJSON` hydration (including the permissive shape that tolerates mock vs REST field-name differences).
- **Hooks and infra are integration-covered, not unit-tested** — `<Feature>.hooks.ts` is a thin wrapper over `fetchX(mode)`; exercise it through page-level tests when needed rather than mocking React.

### Feature module layout

Every domain area under `src/` (e.g., `build/`, `version/`, `testflight/`, `iap/`, `code-signing/`, ~20 total) follows this pattern:

```
src/<feature>/
  <Feature>.ts              # Domain class: readonly fields, semantic booleans,
                            # capability getters (check `affordances`), `fromJSON` factory.
  <Feature>.hooks.ts        # React hooks (e.g. useBuilds) — reads useDataMode(),
                            # delegates to infrastructure/*.api.ts
  infrastructure/
    <Feature>.api.ts        # `if (mode === 'mock') { import mock } else apiClient.get(...)`
    <Feature>.mock.ts       # Deterministic fixtures
  pages/                    # Route-level components (lazy-loaded in App.tsx)
  components/               # Leaf UI for that feature
```

Domain classes (e.g., `src/build/Build.ts`) are the canonical place for business logic. They expose three kinds of members:
1. **Semantic booleans** — `isValid`, `isUsable`, `isExpired` — named for intent, not raw enum values.
2. **Capability checks** — `canAddToTestFlight` → `'addToTestFlight' in this.affordances`. These gate UI actions based on what the backend says is allowed.
3. **`static fromJSON(json)`** factory — tolerant of alternate field names (`version ?? buildNumber`), so both mock and REST shapes deserialize cleanly.

Adding a new feature: scaffold the same five-file shape. Tests live in `tests/<feature>/` and primarily exercise the domain class.

### Routing & pages

`src/App.tsx` is the single router. All feature pages are `React.lazy` imports; add new built-in routes there. The shell (`Sidebar`, `Header`, `CommandLogModal`) wraps `<Routes>`. Providers stack: `ThemeProvider` → `DataModeProviderComponent` → `CommandLogProvider` → `BrowserRouter` → `PluginProvider`.

### Plugin system (`src/plugin/`)

`pluginRegistry` (singleton) accepts `PluginRegistration { id, name, version, pages?, sidebarItems?, widgets? }`. `App.tsx` appends `pluginRegistry.getPages()` as additional `<Route>`s; `Sidebar.tsx` reads `getSidebarItems()`; `PluginSlot` components render widgets by slot name. Plugins are lazy-loaded the same way as built-in pages.

### Styling

CSS lives in `src/styles/` (`theme.css`, `base.css`, `layout.css`, `components.css`, `utilities.css`) and is imported from `src/main.tsx` so Vite bundles/hashes it. Static runtime assets (icons, device frames) go in `public/` and resolve at absolute paths like `/frames/iPhone 17.png`.

### TypeScript notes

`tsconfig.json` has `allowImportingTsExtensions: true`, so imports explicitly include `.ts`/`.tsx` suffixes (`import { Build } from './Build.ts'`). Path alias `@/*` → `src/*` is wired in both `vite.config.ts` and `vitest.config.ts`. `strict` + `noUnusedLocals`/`noUnusedParameters` are on — prefix unused params with `_` rather than leaving them.
