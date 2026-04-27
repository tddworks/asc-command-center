# Plugin System

How third-party code extends **asc-command-center** (the React SPA) by dropping
a `.plugin` bundle into `~/.asc/plugins/` and having the asc-cli web server
serve its UI scripts to the browser at boot.

This document is the canonical design reference. Implementation lives in
`src/extensibility/plugin/` (host) and each plugin's own repo (e.g.
`asc-pro/plugin/`). Before extending the plugin API, update this doc first.

## Design principles

- **SRP.** Every host-exposed surface has one reason to change. React
  version upgrades don't ripple through the plugin-settings API; adding a
  new domain class doesn't touch the runtime bridge. The `host` namespace
  is split along those axes, not bundled into a god object.
- **OCP.** Adding a new editable field or a new page toolbar must not
  require extending a hard-coded slot catalog, revising the plugin
  contract, or updating this doc. The slot types are few and generic; the
  variation rides on a typed `kind` discriminator that plugins filter on.
- **Drop-in install.** Users copy or build a `.plugin` folder into
  `~/.asc/plugins/` and restart asc-cli. No npm, no host rebuild.
- **One host, many plugins.** asc-cli is the single process that scans the
  folder and serves plugin files. asc-command-center (React) is just the
  browser client.
- **Shared runtime.** Plugins use the host's React / MobX / workspace; they
  do not bundle their own. A minimal plugin ships as a few tens of KB.
- **Host owns secrets.** API keys, tokens, and other plugin settings are
  persisted by asc-cli (optionally keychain-backed) — never in
  `localStorage`. A browser wipe must not destroy a user's AI API key.

## Current state of the code

| Piece | Where | Status |
|---|---|---|
| Plugin bundle discovery | `asc-cli` → `Sources/ASCPlugin/PluginLoader.swift` | ✅ scans `~/.asc/plugins`, parses `manifest.json` |
| Plugin file serving | `asc-cli` → `Sources/Infrastructure/Web/ASCWebServer.swift` | ✅ `GET /api/plugins` (list) + `GET /api/plugins/<slug>/<file>` |
| Plugin registry | `asc-command-center` → `src/extensibility/plugin/PluginRegistry.ts` | ✅ in-memory registry keyed by plugin id |
| Plugin types | `src/extensibility/plugin/Plugin.ts` | ✅ `PluginRegistration { pages, sidebarItems, widgets }` |
| Page route wiring | `src/App.tsx` (`pluginRegistry.getPages()`) | ✅ lazy-imports registered pages |
| Sidebar wiring | `src/shared/layout/Sidebar.tsx` | ✅ renders registered sidebar items |
| Capability-typed `<PluginSlot>` (props + `kind`) | `src/extensibility/plugin/{PluginSlot,slots}.ts` | ✅ widgets receive the slot's typed `SlotContext` as props |
| Plugin bootstrap fetch + script inject | `src/extensibility/plugin/PluginBootstrap.tsx` | ✅ fetches `/api/plugins`, dynamic-imports `*.bundle.js`, calls `activate(api)` |
| `window.ascPluginAPI` host bridge | `src/extensibility/plugin/installPluginAPI.ts` | ✅ installed before plugin scripts load; surfaces `register`, `host.runtime/ui/settings/apiClient` |
| Plugin lifecycle hooks (`activate` / `deactivate`) | `PluginBootstrap` | ✅ stores returned `PluginHandle`, calls `deactivate()` on unload |
| Plugin settings store (asc-cli-backed) | `src/extensibility/plugin/settingsClient.ts` + `asc-cli` REST | ✅ `GET/PUT /api/plugin-settings/:id`, secret fields keychain-capable |
| Dev-mode plugin path override | `VITE_PLUGIN_PATH` env var | ✅ host fetches plugin JS from Vite dev server when set |

The host plugin surface is fully wired. New work is now in the plugins
themselves (e.g. asc-pro/plugin/ai-src) and adding new `kind` discriminators
to existing slots — both additive without touching the host contract.

## Architecture

```
╭────────────────────────╮        scans ~/.asc/plugins/
│  asc-cli (Swift)       │        parses manifest.json
│  ──────────────        │        serves /api/plugins + UI files
│  ASCWebServer          │        persists plugin settings (+ keychain)
│  PluginLoader          │───────────────────────────────────────────╮
│  PluginSettingsStore   │                                            │
╰────────────┬───────────╯                                            │
             │ HTTP                                                    │
             │ REST + /api/plugins + /api/plugin-settings              │
             ▼                                                          │
╭────────────────────────────────────────────────────────────────────╮ │
│  asc-command-center (React + MobX)                                 │ │
│                                                                     │ │
│  PluginBootstrap  ── fetch('/api/plugins') ─────────────────────────┤─╯
│       │                                                              │
│       │  install window.ascPluginAPI (before any plugin script)       │
│       │  for each ui file: <script src="/api/plugins/..."/>           │
│       ▼                                                              │
│  window.ascPluginAPI = {                                             │
│    register, lifecycle,                                              │
│    host: { runtime, domain, workspace, apiClient, settings, ui }    │
│  }                                                                   │
│       ▲                                                              │
│       │  plugin module: `export function activate(api) { ... }`       │
│       │  host calls activate(api) after load; plugin calls register  │
│                                                                      │
│  PluginRegistry  ◄── register ──  plugin/ui/*.js                    │
│       │                                                              │
│  ┌────┴────────┬──────────────┬────────────────────────────────────┐│
│  │   Routes    │   Sidebar    │   <PluginSlot> mount points       ││
│  │  (App.tsx)  │  (Sidebar)   │   (scattered across pages)        ││
│  └─────────────┴──────────────┴────────────────────────────────────┘│
╰────────────────────────────────────────────────────────────────────╯
```

## Plugin bundle format

A plugin is a directory named `<Something>.plugin/` installed under
`~/.asc/plugins/`. Same shape as today — only the `ui/` files' *interior*
evolves.

```
ASCPro.plugin/
  manifest.json         ← name, version, server dylib, ui file list
  ASCPro.dylib          ← optional native host extension (CLI-side)
  ui/
    sim-stream.js       ← existing
    sim-list.js
    sim-input.js
    sim-stream.html
  frames/               ← optional static assets
```

### `manifest.json` schema

```json
{
  "name":           "ASC Pro",
  "version":        "1.1",
  "description":    "Simulator streaming + AI enhancement",
  "author":         "tddworks",
  "repositoryURL":  "https://github.com/tddworks/asc-registry",
  "categories":     ["simulators", "ai"],
  "server":         "ASCPro.dylib",
  "ui":             ["ui/sim-stream.js", "ui/ai-enhance.js", ...],
  "apiVersion":     "1"
}
```

`apiVersion` pins the host plugin-API contract the plugin was written
against. The host refuses to load plugins targeting a higher major than it
exposes, and logs a warning for minor mismatches.

## Plugin lifecycle

Plugins do **not** register via side-effects at script evaluation. Each
plugin's main entry exports a function:

```ts
// Plugin author writes this (TS, compiled to JS).
export function activate(api: PluginAPI): PluginHandle {
  const subscription = api.host.workspace.observe(...);

  api.register({
    id: 'asc-pro.ai',
    name: 'ASC Pro — AI',
    version: '1.0.0',
    pages: [...],
    widgets: [...],
  });

  return {
    deactivate() { subscription.dispose(); },
  };
}
```

Host-side `PluginBootstrap` loads the script, reads its default export,
calls `activate(api)`, stores the returned handle. Reload / unload call
`handle.deactivate()` and unregister the contributions.

Why: script-side-effect registration couples lifecycle to the script-tag
load order and leaves no way to clean up. A single `activate` function
isolates lifecycle responsibilities and opens space for HMR, test
harnesses, and "disable plugin" UX without host changes.

### `*.bundle.js` is the entry-point convention

Only files whose basename ends in `.bundle.js` are dynamic-imported by
the host. Everything else in `manifest.ui[]` — `.html`, images, plain
`.js` assets — is served by asc-cli at `/api/plugins/<slug>/<file>` but
never evaluated by the SPA. That split is load-bearing:

- **A `*.bundle.js` file is an ES module.** It must export `activate`
  (directly as a named export, or via default). The bootstrap calls
  that function and stores the returned `PluginHandle` for later
  `deactivate()`.
- **A plain `.js` file is an asset.** Plugins ship these for their own
  HTML pages to load via `<script src>` — the legacy simulator streaming
  code in asc-pro works this way: `stream.html` is a separate full-page
  window that loads `sim-stream.js` + `sim-input.js` itself. The SPA
  never touches them.

Why the suffix-based filter? Dynamic `import()` evaluates the file's top
level, so a non-module `.js` leaks its IIFE body into the SPA. An
earlier version of asc-pro did `document.body.appendChild(...)` at load
time and the injected DOM bled onto every page of the SPA. Gating on
`.bundle.js` makes the contract explicit: *if you want the host to load
it, name it that way*.

Inside a bundle, three rules still apply:

1. **No DOM mutation at import time.** All UI must be built through the
   React tree the host renders (pages, widgets, slot components). If a
   plugin needs imperative DOM, do it inside a React component under
   its registered page/widget, so unmounting cleans up.
2. **`activate` is the only entry point.** No network calls, no DOM
   work, no timers at top-level — put those inside `activate` so they
   are tied to the returned `deactivate`.
3. **No second React reconciler.** Bundles alias `react`, `react-dom`,
   `react/jsx-runtime`, and `mobx-react-lite` to shims that read their
   runtime handles from `window.ascPluginAPI.host.runtime`. The
   `plugin-sdk` ships these shims so individual plugins don't duplicate
   them.

### Shared plugin SDK

Inside `asc-pro/plugin/sdk/` there is a small, private SDK that every
asc-pro plugin consumes:

```
plugin/sdk/
├── pluginApiTypes.ts     — types mirroring the host contract (one copy)
├── shims/
│   ├── react.js          — re-exports window.ascPluginAPI.host.runtime.react
│   ├── react-dom.js
│   ├── jsx-runtime.js
│   └── mobx-react-lite.js
├── tsconfig.base.json    — strict, bundler resolution, JSX automatic
└── buildPlugin.sh        — esbuild driver (entry + output + aliases)
```

Each plugin's sub-directory is tiny:

```
plugin/<name>-src/
├── tsconfig.json         — { "extends": "../sdk/tsconfig.base.json" }
├── index.tsx             — imports PluginAPI from '../sdk/pluginApiTypes.ts'
└── ... feature files
```

And its build script collapses to three meaningful lines:

```bash
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/<name>-src"
OUT="$HERE/ui/<name>.bundle.js"
"$HERE/sdk/buildPlugin.sh" --name "<Name>" --entry "$SRC/index.tsx" --out "$OUT"
```

Why: before the SDK, every plugin shipped its own copies of the shims +
types, and drift between them was a bug waiting to happen. Centralising
them keeps runtime behaviour identical across plugins and makes adding a
new one a copy-of-two-files exercise.

## `window.ascPluginAPI`

```ts
declare global {
  interface Window {
    ascPluginAPI: PluginAPI;
  }
}

/** The contract the host exposes to every plugin script. Split along
 *  independent axes so a change to one (e.g. React upgrade) never forces
 *  a ripple through the others. */
export interface PluginAPI {
  /** Stable semver of the plugin API itself. Plugins check this against
   *  their manifest's `apiVersion` before calling `register`. */
  readonly version: string;

  /** Register contributions. Idempotent per-id — the last registration
   *  wins, which makes HMR during dev trivial. */
  register(reg: PluginRegistration): void;

  /** Host surfaces — each is a single-reason-to-change namespace. */
  host: {
    runtime:    HostRuntime;    // react, reactDom, mobx, mobxReactLite
    domain:     HostDomain;     // observable domain classes
    workspace:  WorkspaceAccess;// session: currentApp, selectedVersion, …
    apiClient:  HostApiClient;  // REST to asc-cli (shared with host code)
    settings:   PluginSettings; // persisted plugin settings (keychain-capable)
    ui:         HostUI;         // shared components & tokens (Card, btn class …)
  };
}
```

### `host.runtime` — React / MobX handles (SRP axis: browser framework upgrades)

```ts
interface HostRuntime {
  react:          typeof import('react');
  reactDom:       typeof import('react-dom');
  mobx:           typeof import('mobx');
  mobxReactLite:  typeof import('mobx-react-lite');
}
```

Plugins import React from here; they must **not** bundle their own.

### `host.domain` — observable types (SRP axis: domain evolution)

```ts
interface HostDomain {
  AppInfo:              typeof AppInfo;
  AppInfoLocalization:  typeof AppInfoLocalization;
  Version:              typeof Version;
  VersionLocalization:  typeof VersionLocalization;
  AgeRatingDeclaration: typeof AgeRatingDeclaration;
  App:                  typeof App;
  // Grows additively. Removing a class is a breaking `apiVersion` bump.
}
```

### `host.workspace` — session coordinator (SRP axis: user focus)

```ts
interface WorkspaceAccess {
  /** Current app the user is focused on. Observable. */
  readonly currentApp: App | null;
  readonly hydrated: boolean;
  selectApp(id: string): void;
  selectVersion(id: string): void;
}
```

### `host.apiClient` — REST to asc-cli (SRP axis: how the host speaks to the CLI)

```ts
interface HostApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  // delete / patch added only when a plugin needs them.
}
```

### `host.settings` — persisted plugin settings (SRP axis: secret storage)

**AI API keys live here, not in `localStorage`.** Backed by asc-cli; secret
fields can opt into macOS keychain storage.

```ts
interface PluginSettings {
  /** Load the settings blob for this plugin. Returns `{}` on first read.
   *  Schema is plugin-owned — the store is opaque JSON. */
  load<T extends Record<string, unknown>>(pluginId: string): Promise<T>;

  /** Save the settings blob. Fields whose name matches `secretFields`
   *  round-trip through the keychain instead of the plaintext JSON file. */
  save<T extends Record<string, unknown>>(
    pluginId: string,
    value: T,
    opts?: { secretFields?: readonly (keyof T)[] },
  ): Promise<void>;

  /** Subscribe to external changes (e.g. CLI rewrites the file). */
  subscribe(pluginId: string, onChange: () => void): () => void;
}
```

#### asc-cli side

A new REST endpoint serves reads/writes. Path shape:

```
GET  /api/plugin-settings/<pluginId>            → { settings, secrets: { key: "<redacted>" } }
PUT  /api/plugin-settings/<pluginId>            → replace the plaintext JSON
PUT  /api/plugin-settings/<pluginId>/secret     → { key, value } → keychain only
```

Storage layout on disk:

```
~/.asc/plugin-settings/
  asc-pro.ai.json          ← plaintext, readable JSON
  asc-pro.ai.secrets.idx   ← list of secret keys persisted in keychain
```

Secret values never appear in the plaintext JSON; the browser reads them
back through the same REST call.

### `host.ui` — shared visual primitives (SRP axis: host design system)

```ts
interface HostUI {
  /** Design tokens — colours, radii, spacing — as CSS custom property
   *  names so plugins don't hardcode palette literals. */
  tokens: Readonly<Record<string, string>>;

  /** Button / Card / Modal / FormGroup React components re-exported from
   *  the host so plugin UIs inherit the app's look-and-feel by default.
   *  Keeps plugins from drifting visually. */
  components: {
    Card:       React.FC<{ children: React.ReactNode; className?: string }>;
    Modal:      React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }>;
    FormGroup:  React.FC<{ label: string; hint?: string; children: React.ReactNode }>;
    Button:     React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' }>;
  };
}
```

### What the host does NOT expose

- `infrastructure/*` — the plugin speaks REST, not host internals.
- `pluginRegistry` itself — register via `ascPluginAPI.register`.
- Private helpers, hook internals, or anything under `shared/` that isn't
  explicitly re-exported via `host.ui`.

## Capability-typed widget slots (OCP refactor)

Instead of a growing catalog like `field.appInfo.name.trailing`,
`field.appInfo.subtitle.trailing`, `field.review.response.trailing`, …
the host ships a **small set of generic slot types** that every extensible
surface reuses, with the real variation carried in a typed `kind`
discriminator on the slot's context.

### Slot types

```ts
type SlotName =
  | 'text.edit'       // any editable text field (input / textarea)
  | 'page.toolbar'    // toolbar area of any page-level card
  | 'list.rowAction'; // any list row's trailing action area
```

Three slots. Adding a new editable text field anywhere in the app is just
another `<PluginSlot slot="text.edit" ctx={{ kind: 'appInfo.name', … }} />`
call. No new slot, no catalog bump, no doc update.

### Context shape per slot

`SlotContext` is a discriminated union — widgets pattern-match on `slot`
and then narrow on `kind`. Source of truth: `src/extensibility/plugin/
slots.ts`. The plugin SDK ships a mirror at `asc-pro/plugin/sdk/
pluginApiTypes.ts`.

```ts
type SlotContext =
  | TextEditSlotContext
  | PageToolbarSlotContext
  | ListRowSlotContext;

interface TextEditSlotContext {
  slot: 'text.edit';
  kind: TextEditKind;
  text: string;
  onChange(next: string): void;
  locale: string;
  /** Hint for the plugin's prompt (e.g. char limits on App Store fields). */
  maxLength?: number;
  /** Domain context — narrowly typed per kind group. The host populates
   *  whichever is relevant; widgets read what they need. */
  app?: App;
  appInfo?: AppInfo;
  version?: Version;
  review?: Review;
  /** Cross-locale fan-out targets, present only on the primary-locale
   *  instance of a field. See "Batch fan-out" below. */
  batch?: BatchTargets;
  /** Free-form contextual hints the host supplies for create-time and
   *  composite slots. See "The `meta` bag" below. */
  meta?: Record<string, string>;
}

type TextEditKind =
  // App Info
  | 'appInfo.name'
  | 'appInfo.subtitle'
  | 'appInfo.privacyPolicyUrl'
  // Version
  | 'version.description'
  | 'version.whatsNew'
  | 'version.keywords'
  | 'version.promotionalText'
  // Customer
  | 'review.response'
  // Monetization — localizations table inputs
  | 'iapLocalization.name'
  | 'iapLocalization.description'
  | 'subscriptionLocalization.name'
  | 'subscriptionLocalization.description'
  // Monetization — create-modal name fields
  | 'iapCreate.referenceName'
  | 'subscriptionCreate.name'
  | 'subscriptionGroupCreate.referenceName';
```

`TextEditKind` is the union of every field the host marks as
*text-editable*. Plugins filter on it; an AI widget registers for
`text.edit` and declines to render when `kind` isn't in its set:

```tsx
function AIEnhanceButton(ctx: SlotContext & { slot: 'text.edit' }) {
  if (!AI_ELIGIBLE_KINDS.has(ctx.kind)) return null;
  return <button>✨</button>;
}

api.register({
  widgets: [{ slot: 'text.edit', component: AIEnhanceButton }],
});
```

### Why this is OCP-clean

- **Host is closed for modification.** New text fields reuse
  `text.edit` — no host-side slot catalog change.
- **Plugins extend by filtering.** A plugin that wants to cover only
  marketing fields just adjusts its own `AI_ELIGIBLE_KINDS`.
- **Adding a new `kind` is additive.** Old plugins still work (they don't
  handle the new kind; new plugins opt in).

### Widget signature

Every widget for slot `S` is a React component typed as
`React.FC<SlotContext & { slot: S }>`. Nothing else. Widgets see
the field's current text and an `onChange` callback — they mutate host
state through normal React/MobX semantics.

### Batch fan-out (`BatchTargets`)

A `text.edit` slot mounted on a *primary-locale* instance of a field can
also carry a `batch` payload describing the same field on every sibling
locale. Widgets use it to expose a "fan one operation across all
locales" affordance — the asc-pro AI plugin's "Translate to all locales"
button is the canonical consumer.

```ts
interface BatchTargets {
  /** Locale code of the source row (e.g. `'en-US'`). */
  sourceLocale: string;
  /** Current text in the source row — what the widget feeds to AI. */
  sourceText: string;
  /** Sibling rows the widget will write to. */
  targets: readonly BatchTarget[];
}

interface BatchTarget {
  locale: string;
  /** What's already in the target field — lets the widget warn before
   *  overwriting. */
  current: string;
  /** Setter the widget calls with the produced string. */
  setText(v: string): void;
}
```

Hosts mount `batch` only on the primary-locale slot of a field; sibling
rows omit it so they expose only the single-field affordance. A widget
that ignores `batch` keeps working — it just shows the per-field button.

### The `meta` bag

`meta?: Record<string, string>` is a free-form contextual hint bag the
host populates for slots whose prompt depends on context the slot's
typed fields don't carry. Conventional keys:

| Key | Set on | Meaning |
|---|---|---|
| `iapType` | `iapCreate.referenceName` | One of `CONSUMABLE`, `NON_CONSUMABLE`, `NON_RENEWING_SUBSCRIPTION` — lets a "Suggest IAP Name" enhancement bias toward the right vocabulary (coins/gems vs premium-unlock vs seasonal-pass). |
| `groupName` | `subscriptionCreate.name` | The subscription group's reference name — gives the suggester context for tier names like "Pro Monthly". |
| `period` | `subscriptionCreate.name` | The pending billing period (`ONE_WEEK`, `ONE_MONTH`, `ONE_YEAR`, …). |

Plugins read what they understand and ignore unknown keys. New keys are
purely additive — neither host nor existing plugins need to change for a
new convention to land.

### Worked example: the "Suggest IAP Name" enhancement

End-to-end, here's how a context-driven suggestion plugs together:

```tsx
// Host: src/monetization/iap/components/CreateIAPModal.tsx
<PluginSlot
  slot="text.edit"
  ctx={{
    slot: 'text.edit',
    kind: 'iapCreate.referenceName',
    text: referenceName,
    onChange: setReferenceName,        // setting name auto-derives productId
    locale: 'en-US',
    app,                                // carries name + bundleId
    meta: { iapType: type },            // CONSUMABLE | NON_CONSUMABLE | …
  }}
/>
```

```ts
// Plugin: asc-pro/plugin/ai-src/enhancements.ts
export const iapNameSuggestion: Enhancement = {
  id: 'openai.iap_name_suggestion',
  displayName: 'Suggest IAP Name',
  category: 'marketing',
  kinds: ['iapCreate.referenceName'],
  prompt: ({ appName, bundleId, meta }) => `
You are an App Store in-app purchase naming expert.

App name: ${appName}
Bundle ID: ${bundleId}
IAP type:  ${describeType(meta?.iapType)}

Generate a creative, descriptive reference name (2-4 words). Output only
the reference name.`.trim(),
};
```

The host doesn't know about "AI"; the plugin doesn't know about
`InAppPurchase`. Both meet at `kind` + `meta`.

## Registration shape

```ts
export interface PluginRegistration {
  id: string;            // globally unique (e.g. 'asc-pro.ai')
  name: string;          // human-readable
  version: string;       // plugin version (semver)
  pages?:       PluginPage[];
  sidebarItems?: PluginSidebarItem[];
  widgets?:     PluginWidget[];
}

export interface PluginWidget {
  slot:      SlotName;
  component: React.FC<SlotContext>; // typed as the slot's context
  priority?: number;                 // lower renders earlier; default 100
}
```

The plugin `id` namespaces the settings store (`asc-pro.ai` ↔
`~/.asc/plugin-settings/asc-pro.ai.json`) and the registry key. One
plugin bundle can produce several registrations if it ships distinct
features.

## Boot sequence

```
1. App.tsx mounts inside WorkspaceProvider.
2. PluginBootstrap runs a useEffect:
     a. Install window.ascPluginAPI (with `register` no-op until registry is ready).
     b. fetch('/api/plugins')
        → [{ id, name, apiVersion, ui: ['/api/plugins/<slug>/ui/...'] }, ...]
     c. For each plugin:
         – compatible(apiVersion)?  warn or skip
         – for each .js entry: dynamic import()
         – const handle = mod.activate(api)
         – store handle for deactivation
     d. Flip `pluginsReady = true`.
3. Host React tree re-renders. Plugin pages become routes; widgets render
   inside every <PluginSlot> that matches their slot.
```

`dynamic import()` gives plugin scripts a proper ES-module scope (no
global leaks), a real `default` export for lifecycle, and free Vite HMR
in dev.

## Build + install (unchanged)

```
$ cd asc-pro && ./build-framework.sh
→ swiftc → ASCPro.dylib
→ esbuild plugin/ui/*.js (minify)
→ cp -r .build/ASCPro.plugin ~/.asc/plugins/ASCPro.plugin

Restart asc-cli  → refresh asc-command-center → new plugin registers.
```

## Dev-time workflow

- `VITE_PLUGIN_PATH=/abs/path/to/plugin/ui` — browser loads plugin JS from
  Vite's dev server instead of `/api/plugins`. HMR on edits.
- `./build-framework.sh --dev` — emit to `.build/ASCPro.plugin/` without
  copying to `~/.asc/plugins`. Combined with the env override, you never
  restart asc-cli.

## Security

- Plugin JS runs in the host's document context with full DOM access.
  Don't install untrusted plugins.
- **Secrets live in asc-cli (optionally keychain), not in localStorage.**
  `host.settings` is the only allowed persistence path for secret data.
- Plugins cannot reach the asc-cli dylib directly — only through REST
  endpoints the host already trusts.

## Versioning

Host exposes `ascPluginAPI.version` (semver). Plugin manifest carries
`apiVersion`. Semver rules:

- **Patch / minor** — backwards-compatible additions (new slot kinds, new
  domain classes, new settings helpers). Plugins keep working.
- **Major** — breaking change (a slot type removed, a domain field
  renamed). Plugins opt into new version explicitly.

The host's `PluginBootstrap` refuses to load a plugin whose `apiVersion`
major exceeds the host's version, and logs a descriptive error.

## Running a plugin end-to-end

```bash
# 1. Build the plugin bundle
cd asc-pro && ./build-framework.sh
# → ~/.asc/plugins/ASCPro.plugin/ui/ai.bundle.js

# 2. Boot the CLI's web server
cd asc-cli && swift run asc web
# /api/plugins lists ASCPro with the bundle's apiVersion

# 3. Start the SPA
cd asc-command-center && npm run dev
# PluginBootstrap fetches /api/plugins → dynamic-imports ai.bundle.js →
# plugin calls api.register() → ✨ AI buttons appear next to every
# eligible text field; Settings page at /ai-settings.
```

For HMR-friendly development without rebuilding the bundle:

```bash
VITE_PLUGIN_PATH=/abs/path/to/asc-pro/plugin/ui npm run dev
```

The host then fetches plugin JS from the local Vite dev server instead
of `/api/plugins/<slug>/...`, so edits in `plugin/<name>-src/*.ts(x)`
hot-reload through the SPA.

## Companion docs

- [`slots.md`](./slots.md) — kind-by-kind catalogue: every place the
  host renders `<PluginSlot>`, what context fields are populated, and
  what `meta` keys a plugin can read. Plugin authors should plan
  against this list.
- [`host-api.md`](./host-api.md) — versioned reference for
  `window.ascPluginAPI` extracted from `PluginAPI.ts`: each `host.*`
  namespace, what's *not* exposed, lifecycle, and the patch/minor/major
  bump policy.

## Open items (next slice of work)

- [ ] **Single source of truth for `TextEditKind`.** Today
  `slots.ts` (host) and `pluginApiTypes.ts` (plugin SDK) both declare
  the union — every new kind requires editing both. Collapsing this
  via build-time copy or a published `@asc/plugin-types` package is
  the highest-leverage cleanup remaining (see the SRP/OCP
  retrospective in `host-api.md`'s "What the host does not expose"
  section for context).
- [ ] **Typed `meta` per kind.** The conventional keys (`iapType`,
  `groupName`, `period`) are documented in prose only; a discriminated
  `MetaFor<K extends TextEditKind>` map would let plugin authors get
  autocomplete on `ctx.meta?.…` and the host get a compile-time check
  that it set the right keys.