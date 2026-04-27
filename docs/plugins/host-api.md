# Host API Reference

The contract `window.ascPluginAPI` exposes to every plugin script. This
reference is extracted from
[`src/extensibility/plugin/PluginAPI.ts`](../../src/extensibility/plugin/PluginAPI.ts)
— treat that file as authoritative; this doc explains intent and
versioning policy.

For *what* a plugin contributes (pages / sidebar / widgets), see
[`README.md`](./README.md). For *which kinds* a `text.edit` widget can
opt into, see [`slots.md`](./slots.md).

---

## Versioning

```ts
import { PLUGIN_API_VERSION } from 'src/extensibility/plugin/PluginAPI.ts';
// → '0.17.2'
```

Pre-1.0 semver:

| Bump | Trigger | Plugin impact |
|---|---|---|
| **patch** (`0.17.x` → `0.17.y`) | Additive changes — new fields, new domain classes, new namespace entries. | None. Old plugins keep working. |
| **minor** (`0.17.x` → `0.18.0`) | Breaking changes — a field renamed, a method signature narrowed, a domain class removed. | Plugins must update their `apiVersion` and adapt. |
| **major** (`1.0.0`) | First stable cut. Switches to standard semver thereafter. | One-time migration. |

Plugins declare `"apiVersion": "0.17"` in their manifest. The host's
`PluginBootstrap` refuses to load a plugin whose major / minor exceeds
the host's, and logs a descriptive error. Patch mismatches log a
warning but allow load.

A plugin may also gate behaviour at runtime:

```ts
export function activate(api: PluginAPI): PluginHandle {
  if (api.version < '0.17.0') {
    console.warn('asc-pro/ai requires API ≥ 0.17.0');
    return {};
  }
  // ...
}
```

---

## Top-level shape

```ts
interface PluginAPI {
  readonly version: string;          // PLUGIN_API_VERSION
  register(reg: PluginRegistration): void;
  host: {
    runtime:   HostRuntime;
    domain:    HostDomain;
    workspace: WorkspaceAccess;
    apiClient: HostApiClient;
    settings:  PluginSettings;
    ui:        HostUI;
  };
}
```

`register` is **idempotent per plugin id** — calling it again replaces
the previous registration. That's load-bearing for HMR: edit a plugin
file, the bundle re-imports, `activate` runs again, the previous
contributions atomically replace themselves.

Each `host.*` namespace has *one reason to change*. Splitting them this
way keeps unrelated upgrades from rippling:

| Namespace | Changes when … |
|---|---|
| `runtime` | React / MobX major versions move. |
| `domain` | A new observable domain class lands. |
| `workspace` | The session model changes (currently: app + version focus). |
| `apiClient` | `apiClient.get/post` shape evolves. |
| `settings` | Persistence backend changes (e.g. moving from localStorage to asc-cli REST). |
| `ui` | Host design tokens or shared component shapes change. |

---

## `host.runtime`

```ts
interface HostRuntime {
  react:         typeof import('react');
  reactDom:      typeof import('react-dom');
  mobx:          typeof import('mobx');
  mobxReactLite: typeof import('mobx-react-lite');
}
```

Plugins **must** import React via these handles, not bundle their own.
Two reconcilers in one document break MobX observability and double the
bundle size. The plugin SDK's
[`shims/`](../../../asc-pro/plugin/sdk/shims/) folder ships drop-in
replacements that re-export the host runtime; `buildPlugin.sh` aliases
plugin imports to them automatically:

```ts
// In a plugin file — looks like a normal React import.
import * as React from 'react';
//              └── compile-time aliased to plugin/sdk/shims/react.js
//                  which reads window.ascPluginAPI.host.runtime.react
```

---

## `host.domain`

Observable domain class constructors plugins can hydrate (`fromJSON`)
and observe.

```ts
interface HostDomain {
  App:                  typeof App;
  AppInfo:              typeof AppInfo;
  AppInfoLocalization:  typeof AppInfoLocalization;
  Version:              typeof Version;
  VersionLocalization:  typeof VersionLocalization;
  AgeRatingDeclaration: typeof AgeRatingDeclaration;
}
```

**Patch-bump policy** — adding a class is additive. Removing or
renaming one requires a minor bump.

Plugins that need a domain object the host doesn't expose should read
the JSON via `host.apiClient.get` and parse it themselves; promoting a
slice's domain class into `HostDomain` is a host PR.

---

## `host.workspace`

The session-coordinator projection — which app + version the user is
focused on right now. Both methods return live values; pair with
`react.useSyncExternalStore` or wrap the consuming component in MobX's
`observer()` to react to focus changes.

```ts
interface WorkspaceAccess {
  /** Full ASCWorkspace observable — useful for plugins that want to
   *  subscribe to focus changes via mobx.autorun. */
  readonly workspace: ASCWorkspace;
  /** Shortcut for `workspace.currentApp`. */
  currentApp(): App | null;
  /** Shortcut for `workspace.currentApp?.selectedVersion`. */
  selectedVersion(): Version | null;
}
```

**Don't write to the workspace** — there's no setter on this surface
intentionally. Selection happens through the host's UI; a plugin
forcing a selection would yank the user's focus mid-task.

---

## `host.apiClient`

Thin REST helper pre-wired to the same asc-cli base the host uses, with
the same `_links → affordances` normalization the host applies. Use it
for asc-cli endpoints, not for external services.

```ts
interface HostApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}
```

For external APIs (OpenAI, etc.) plugins should use `fetch` directly —
that traffic shouldn't be entangled with the host's apiClient
behaviour (mode toggles, retries, link normalization).

---

## `host.settings`

Plugin-scoped persisted settings. Backed by asc-cli on disk
(`~/.asc/plugin-settings/<id>.json`); the browser falls back to
`localStorage` only when the asc-cli endpoints aren't deployed yet so
plugins keep working in dev. Production always round-trips through
asc-cli so settings survive browser wipes and sync across browsers on
the same machine.

```ts
interface PluginSettings {
  load<T extends Record<string, unknown>>(pluginId: string): Promise<T>;
  save<T extends Record<string, unknown>>(pluginId: string, value: T): Promise<void>;
  /** Subscribe to external writes (e.g. CLI edits the file in another
   *  process). Returns the unsubscribe function. */
  subscribe(pluginId: string, onChange: () => void): () => void;
}
```

**Plaintext only.** The store does not offer keychain-backed secret
fields — that surface was considered and dropped because it adds API
complexity for marginal benefit (macOS-only, doesn't generalize). A
plugin holding long-lived credentials should tell the user the file
lives at `~/.asc/plugin-settings/<id>.json` and ensure the user trusts
the machine.

`load()` returns `{}` on first read — there's no `exists` check, just
treat empty as "not configured yet".

---

## `host.ui`

Host design-system primitives plugins can drop into their UIs so they
don't drift visually from the rest of the app.

### Tokens

CSS custom-property *names* (not resolved values) so plugins compose
with the same palette the host paints with. Read the resolved colour at
runtime via `getComputedStyle`:

```ts
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue(api.host.ui.tokens.accent)
  .trim();  // → '#2563EB' (in light mode)
```

Stable token keys (sample — see
[`hostUI.tsx`](../../src/extensibility/plugin/hostUI.tsx) for the full
list):

| Key | CSS variable | Purpose |
|---|---|---|
| `accent` | `--accent` | Primary brand colour |
| `accentHover` | `--accent-hover` | Primary, hover state |
| `accentLight` | `--accent-light` | Tinted backgrounds |
| `bg`, `bgCard`, `bgHover` | `--bg-*` | Surface tones |
| `textPrimary`, `textSecondary`, `textMuted` | `--text-*` | Type tones |
| `border`, `borderLight` | `--border-*` | Divider tones |
| `success`, `warning`, `danger`, `info` | matching | Status tones |
| `radius`, `radiusSm`, `radiusLg` | `--radius*` | Corner radii |
| `shadow`, `shadowSm`, `shadowLg` | `--shadow*` | Elevation |

### Components

```ts
interface HostUI {
  tokens: Readonly<Record<string, string>>;
  components: {
    Card:      React.FC<{ children?; className? }>;
    Modal:     React.FC<{ open; onClose; title?; children? }>;
    FormGroup: React.FC<{ label; hint?; htmlFor?; children? }>;
    Button:    React.FC<ButtonHTMLAttributes & { tone?: 'primary' | 'secondary' | 'danger'; size?: 'sm' | 'md' }>;
  };
}
```

These wrap host CSS classes (`card`, `modal-*`, `btn`, `btn-primary`,
…) so a plugin writing its own JSX still inherits dark-mode handling,
hover states, and animation timings without copying CSS. Use them for
new UI; for existing iOS-style plugin sheets, the plugin can keep its
own components.

---

## What the host does **not** expose

- `infrastructure/*` — plugins speak REST (via `host.apiClient`), not
  host internals.
- `pluginRegistry` — register through `api.register`, never reach into
  the registry.
- Slice hooks (`useApp`, `useVersions`, …) — these are internal to host
  pages. Plugins read via `host.workspace` + `host.domain` + REST.
- `shared/` modules unless explicitly re-exported through `host.ui`.
- Test-only helpers (`reset*`, mock factories).

If a plugin needs something that isn't exposed, the answer is a
patch-bump host PR — not reaching into host internals — so the plugin
contract stays auditable.

---

## Plugin registration shape

```ts
interface PluginRegistration {
  id: string;            // globally unique, e.g. 'asc-pro.ai'
  name: string;          // human-readable label
  version: string;       // plugin semver
  pages?:        PluginPage[];
  sidebarItems?: PluginSidebarItem[];
  /** Discriminated union — each widget is typed against its slot's
   *  context. A `text.edit` widget cannot read `page.toolbar` fields
   *  by accident. */
  widgets?:      SomeWidget[];
}

interface PluginWidget<S extends SlotName> {
  slot: S;
  component: React.ComponentType<ContextFor<S>>;
  /** Lower renders earlier; default 100. */
  priority?: number;
}
```

The plugin `id` namespaces the settings store
(`~/.asc/plugin-settings/asc-pro.ai.json`) and the registry key. One
plugin bundle can call `register` multiple times if it ships distinct
features — the last call per id wins.

---

## Lifecycle

```ts
export function activate(api: PluginAPI): PluginHandle {
  const dispose = mobx.autorun(() => { /* ... */ });

  api.register({
    id: 'asc-pro.ai',
    name: 'ASC Pro — AI',
    version: '1.0.0',
    pages: [...],
    widgets: [...],
  });

  return {
    deactivate() { dispose(); },
  };
}
```

`activate` runs after dynamic-import; the host stores the returned
`PluginHandle` and calls `handle.deactivate()` on reload or disable.
Most plugins have nothing to clean up and can return `undefined`.

**Don't register at import time.** Top-level side effects bypass
lifecycle and can't be deactivated. The bootstrap explicitly looks for
the named `activate` export (or `default.activate`) — anything else is
ignored.

---

## Boot sequence (informational)

```
1. main.tsx → installPluginAPI({ settings, ui })
2. window.ascPluginAPI is live with `register` enqueueing into
   pluginRegistry.
3. PluginBootstrap useEffect fires:
     a. fetch('/api/plugins')
     b. for each plugin, dynamic-import each *.bundle.js entry
     c. const handle = mod.activate(api)
     d. store handle for later deactivation
4. Host re-renders. Plugin pages become routes; widgets show up in
   matching <PluginSlot> mounts; sidebar items appear.
```

Adding a plugin is therefore a pure runtime concern — no host rebuild
required.
