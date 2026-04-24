# Plugin System

How third-party code extends **asc-command-center** (the React SPA) by dropping
a `.plugin` bundle into `~/.asc/plugins/` and having the asc-cli web server
serve its UI scripts to the browser at boot.

This document is the canonical design reference. Implementation lives in
`src/extensibility/plugin/` (host) and each plugin's own repo (e.g.
`asc-pro/plugin/`). Before extending the plugin API, update this doc first.

## Why this shape

- **Drop-in install.** Users copy or build a `.plugin` folder into
  `~/.asc/plugins/` and restart the CLI. No npm, no build of the host.
- **One host, many plugins.** asc-cli is the single process that scans the
  folder and serves plugin files. asc-command-center (React) is just the
  browser client.
- **Browser-native.** Plugin code is plain JS served over HTTP; the browser
  loads scripts with `<script>` tags — no custom loader, no eval gymnastics.
- **Shared host runtime.** Plugins use the host's React / MobX / workspace
  via `window.ascPluginAPI`; they do not bundle their own. A minimal plugin
  ships as a few tens of KB.

## Current state of the code

| Piece | Where | Status |
|---|---|---|
| Plugin bundle discovery | `asc-cli` → `Sources/ASCPlugin/PluginLoader.swift` | ✅ scans `~/.asc/plugins`, parses `manifest.json` |
| Plugin file serving | `asc-cli` → `Sources/Infrastructure/Web/ASCWebServer.swift` | ✅ exposes `GET /api/plugins` (list) + `GET /api/plugins/<slug>/<file>` |
| Plugin registry | `asc-command-center` → `src/extensibility/plugin/PluginRegistry.ts` | ✅ in-memory registry keyed by plugin id |
| Plugin types | `src/extensibility/plugin/Plugin.ts` | ✅ `PluginRegistration { pages, sidebarItems, widgets }` |
| Page route wiring | `src/App.tsx` (`pluginRegistry.getPages()`) | ✅ lazy-imports registered pages |
| Sidebar wiring | `src/shared/layout/Sidebar.tsx` | ✅ renders registered sidebar items |
| Named widget rendering | `src/extensibility/plugin/PluginSlot.tsx` | ✅ renders widgets for a named slot |
| **Boot-time plugin fetch** | — | ❌ no code fetches `/api/plugins` and injects scripts |
| **`window.ascPluginAPI` bridge** | — | ❌ no global API for external scripts to call |
| **Typed field-level slots** | — | ❌ widgets have no props; only a slot name |
| **Dev-mode plugin paths** | — | ❌ can't point at a dev plugin without rebuild+install |

The missing pieces are entirely browser-side.

## Architecture

```
╭────────────────────────╮        scans ~/.asc/plugins/
│  asc-cli (Swift)       │        parses manifest.json
│  ──────────────        │        serves /api/plugins + UI files
│  ASCWebServer          │───────────────────────────────────────────╮
│  PluginLoader          │                                           │
╰────────────┬───────────╯                                           │
             │ HTTP                                                   │
             │ (REST + /api/plugins)                                   │
             ▼                                                         │
╭────────────────────────────────────────────────────────────────╮    │
│  asc-command-center (React + MobX)                             │    │
│                                                                 │    │
│  PluginBootstrap  ── fetch('/api/plugins') ─────────────────────┼────╯
│       │                                                          │
│       │  for each ui file: <script src="/api/plugins/..."/>       │
│       ▼                                                          │
│  window.ascPluginAPI = { register, host: { react, mobx, ...} }  │
│       ▲                                                          │
│       │ plugin script calls register({ pages, widgets, … })      │
│       │                                                          │
│  PluginRegistry  ◄── register ──  plugin/ui/*.js                │
│       │                                                          │
│  ┌────┴────────┬──────────────┬────────────────────────────────┐│
│  │   Routes    │   Sidebar    │   <PluginSlot> mount points   ││
│  │  (App.tsx)  │  (Sidebar)   │   (scattered across pages)    ││
│  └─────────────┴──────────────┴────────────────────────────────┘│
╰────────────────────────────────────────────────────────────────╯
```

## Plugin bundle format

A plugin is a directory named `<Something>.plugin/` installed under
`~/.asc/plugins/`. It contains:

```
ASCPro.plugin/
  manifest.json         ← name, version, server dylib (optional), ui file list
  ASCPro.dylib          ← optional native host extension (CLI-side only)
  ui/
    sim-stream.js       ← browser-side registration + widgets
    sim-list.js
    sim-input.js
    sim-stream.html     ← optional HTML template(s) served alongside
  frames/               ← optional static assets
  sim-capture           ← optional CLI executables
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
  "ui":             ["ui/sim-stream.js", "ui/ai-enhance.js", ... ]
}
```

The `ui` array is an **ordered list**; scripts are injected in order. A
plugin that wants one of its scripts to run before another (e.g. a
`ai-client.js` with shared helpers before `ai-enhance.js`) lists them in
that order.

Non-`.js` files referenced in `ui` (e.g. `sim-stream.html`) are served
unchanged and can be fetched on demand by the plugin's own code.

## Boot sequence (what needs adding)

```
1. App.tsx mounts inside WorkspaceProvider.
2. PluginBootstrap component runs a useEffect that:
     a. fetch('/api/plugins')
        → [{ name, ui: ['/api/plugins/asc-pro/ui/sim-stream.js', ...] }, ...]
     b. For each plugin, for each ui file with .js:
        create <script src="..."> and append to <head>.
        Record the pending-register state.
     c. Wait for all scripts to load (onload). Then mark `pluginsReady=true`.
3. Plugin script evaluates. It sees `window.ascPluginAPI` already installed
   by the host and calls:
       ascPluginAPI.register({
         id: 'asc-pro',
         name: 'ASC Pro',
         version: '1.1',
         pages: [...],
         sidebarItems: [...],
         widgets: [{ slot: 'field.appInfo.name.trailing', component: ... }],
       });
   The API forwards to `pluginRegistry.register(...)`.
4. Host React tree re-renders once `pluginsReady`. Registered pages appear
   as routes; sidebar items appear; `<PluginSlot>` mount points render
   their widgets.
```

The one-time boot fetch is cached by the browser; subsequent reloads refresh
plugin code when the user rebuilds with `build-framework.sh`.

## `window.ascPluginAPI`

This is the single global the host exposes. Installed **before** the
`<script>` tags are injected so plugin code always sees it on first
evaluation.

```ts
declare global {
  interface Window {
    ascPluginAPI: {
      /** Register this plugin's contributions. Idempotent on re-call — last
       *  registration wins, so hot-reload during dev Just Works. */
      register(registration: PluginRegistration): void;

      /** Host runtime handles. Plugins must NOT bundle their own React /
       *  mobx — they use these, which keeps bundle sizes tiny and keeps
       *  widgets on the same reconciliation root as the host. */
      host: {
        react:          typeof import('react');
        reactDom:       typeof import('react-dom');
        mobx:           typeof import('mobx');
        mobxReactLite:  typeof import('mobx-react-lite');

        /** Reactive handle to the user's current app + version. Plugin
         *  widgets and pages read from this the same way host components do. */
        workspace:      ASCWorkspace;

        /** Domain class constructors/types the plugin might consume. Only
         *  the stable ones are exposed — internal helpers stay private. */
        domain: {
          AppInfo:              typeof AppInfo;
          AppInfoLocalization:  typeof AppInfoLocalization;
          Version:              typeof Version;
          VersionLocalization:  typeof VersionLocalization;
          AgeRatingDeclaration: typeof AgeRatingDeclaration;
        };

        /** Convenience: thin HTTP helper pre-wired to the same REST path
         *  the host uses. Plugins that hit OpenAI-compatible endpoints
         *  should use `fetch` directly — this helper is for talking to
         *  asc-cli's own API. */
        apiClient: {
          get<T>(path: string): Promise<T>;
          post<T>(path: string, body: unknown): Promise<T>;
        };
      };
    };
  }
}
```

### Stability promises

- `host.react` / `host.reactDom` / `host.mobx` / `host.mobxReactLite` follow
  the host's installed version. Plugins should peg compatibility in their
  manifest once we add a `peerDependencies` field.
- `host.workspace` is the stable singleton; its observable fields are
  contractual. Breaking changes require a host major version bump.
- `host.domain` classes are observable and their public getters/setters are
  contractual.

### What the host does NOT expose

- Anything under `infrastructure/`. Plugins never speak HTTP to the
  backend directly through host internals; they go through
  `host.apiClient` or their own `fetch`.
- `pluginRegistry` itself. Plugins register via `ascPluginAPI.register`, not
  by touching the registry.

## Widget slot contract

Widget registration looks like:

```ts
widgets: [
  {
    slot: 'field.appInfo.name.trailing',
    component: () => import('./AIEnhanceButton.js'),
    priority: 100, // lower renders earlier; defaults to 100
  },
]
```

The host declares slots where widgets can mount:

```tsx
<PluginSlot
  slot="field.appInfo.name.trailing"
  ctx={{
    kind: 'field.appInfo.name',
    text: primary.name,
    onChange: (v) => primary.setName(v),
    locale: appInfo.primaryLocale,
    appInfo,
  }}
/>
```

Every widget for that slot receives `ctx` as its props. Context shape is
**typed per slot** so plugins know exactly what to expect. A widget
registered for slot X must accept that slot's `ctx` type; mismatches are a
plugin bug.

### Canonical slot catalog

Slots are namespaced `<surface>.<entity>.<field>[.<position>]`. The catalog
below is the set we ship day-one; adding a slot is a host change and needs
a doc update here so plugin authors can target it.

| Slot | Where it renders | `ctx` shape |
|---|---|---|
| `field.appInfo.name.trailing` | App Info → App Name input row | `{ text, onChange, locale, appInfo, appContext }` |
| `field.appInfo.subtitle.trailing` | App Info → Subtitle input row | same as above |
| `field.appInfo.privacyPolicyUrl.trailing` | App Info → Privacy Policy URL row | `{ text, onChange, locale, appInfo }` |
| `field.version.description.trailing` | Version page → Description textarea | `{ text, onChange, locale, version, releaseContext }` |
| `field.version.whatsNew.trailing` | Version page → What's New textarea | same |
| `field.version.keywords.trailing` | Version page → Keywords input | same |
| `field.version.promotionalText.trailing` | Version page → Promotional Text input | same |
| `field.review.responseBody.trailing` | Review response editor | `{ text, onChange, review, customerContext }` |
| `page.appInfo.toolbar` | Top of App Info page toolbar | `{ appInfo, app }` |
| `page.version.toolbar` | Top of Version page toolbar | `{ version, app }` |

`kind`, `text`, `onChange` are the load-bearing trio — any field-editing
widget (AI, dictionary lookup, custom paste, …) uses the same shape.

### Authoring a widget

```tsx
// ai-enhance.js (compiled from TS)
const { react: React } = window.ascPluginAPI.host;
const { observer } = window.ascPluginAPI.host.mobxReactLite;

const AIEnhanceButton = observer(function AIEnhanceButton(ctx) {
  const [open, setOpen] = React.useState(false);
  return React.createElement(
    'button',
    { onClick: () => setOpen(true), disabled: ctx.text.length === 0 },
    '✨ AI',
  );
});

window.ascPluginAPI.register({
  id: 'asc-pro',
  name: 'ASC Pro',
  version: '1.1',
  widgets: [
    { slot: 'field.appInfo.name.trailing',     component: () => ({ default: AIEnhanceButton }) },
    { slot: 'field.appInfo.subtitle.trailing', component: () => ({ default: AIEnhanceButton }) },
    // … one entry per targeted field
  ],
});
```

Plugins that prefer JSX compile their TS with esbuild; `build-framework.sh`
already does that for every file under `plugin/ui/*.js`. Compiled output is
plain JS, the runtime imports React from the host, bundle stays small.

## Build + install

Current flow (from `asc-pro/build-framework.sh`):

```
Sources/ASCPro/*.swift        ─┐
                                │  swiftc → ASCPro.dylib
plugin/manifest.json            ├─► .build/ASCPro.plugin/
plugin/ui/*.js (esbuild minify) │
plugin/frames/*.png             │
sim-capture (make)              │
Baguette (./build.sh)          ─┘

cp -r .build/ASCPro.plugin  ~/.asc/plugins/ASCPro.plugin
```

Restart asc-cli → browser reloads asc-command-center → `/api/plugins`
returns the new UI list → `<script>` tags get injected → registered
contributions appear.

No change to this pipeline: adding AI is just adding more `.js` files to
`plugin/ui/` and listing them in the manifest.

## Dev-time workflow

For plugin authors iterating fast, host supports two aids:

1. **Path override.** `VITE_PLUGIN_PATH=/abs/path/to/plugin/ui` makes the
   bootstrap fetch local files from Vite's dev server instead of
   `/api/plugins`. Editing a JS file triggers Vite HMR; plugin re-registers
   with the same id so the last registration wins.
2. **Skip-install rebuild.** `./build-framework.sh --dev` writes to
   `./.build/ASCPro.plugin/` but does not copy to `~/.asc/plugins/`. The
   plugin is picked up via (1).

Both aids are optional; production still uses the install path.

## Security notes

- Plugin JS runs in the host's document context with full DOM access. This
  is by design (widgets need to be normal React components). Do not install
  untrusted plugins.
- API keys (e.g. for the AI plugin) are the plugin's concern. Current
  pattern: `localStorage` under a namespaced key like `ascpro.ai.apiKey`.
- Plugins cannot reach the asc-cli dylib directly — only via the REST API
  the host already uses. Native capabilities are exposed as new REST
  endpoints when necessary.

## Versioning

Every `PluginRegistration` carries `version`. Host logs unknown field names
as warnings but does not reject — plugins are forward-compatible as long as
they don't rely on a field the host version doesn't render.

When breaking host-API changes happen, we bump the host's exposed
`ascPluginAPI.version` and plugins can inspect it before registering:

```js
if (window.ascPluginAPI.version < '2.0') {
  // fall back or bail with a clear console.error
}
```

## Example — the AI plugin (planned, see `docs/plugins/ai-plugin.md`)

Goals:

1. `✨ AI` button appears on every AI-eligible text field (via widgets).
2. Clicking opens a sheet listing enhancements (translate, improve, SEO,
   customer response) filtered by the field's `kind`.
3. Uses the host's React, MobX, and workspace observables.
4. Settings (OpenAI base URL, API key, model) stored in `localStorage`;
   surfaced via a registered page at `/ai-settings`.
5. Calls OpenAI-compatible endpoints from the browser. No new REST endpoint.

Shipped as extra JS files inside the existing `ASCPro.plugin` bundle — no
change to the plugin distribution model.

## Open items

- [ ] Typed `FieldSlotContext` kind-to-props map in `src/extensibility/plugin/slots.ts`.
- [ ] `PluginBootstrap` component that fetches + injects.
- [ ] `window.ascPluginAPI` installer (runs before bootstrap).
- [ ] Extend `<PluginSlot>` to forward `ctx` as widget props.
- [ ] Declare `peerDependencies` field on manifest for react/mobx version
      pinning once we have plugins from outside the repo.
- [ ] Versioned host API contract doc (`docs/plugins/host-api.md`).
