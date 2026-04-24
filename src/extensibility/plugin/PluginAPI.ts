/**
 * The host-side contract exposed to plugin code via `window.ascPluginAPI`.
 *
 * Split along independent axes so each has one reason to change:
 *   host.runtime   — React / MobX version upgrades
 *   host.domain    — observable domain classes
 *   host.workspace — session model
 *   host.apiClient — REST to asc-cli
 *   host.settings  — per-plugin persisted settings (CLI + keychain)
 *   host.ui        — host design-system primitives
 *
 * Everything here is a *public API*. Changes that remove or rename fields
 * require a major `PLUGIN_API_VERSION` bump and a matching `apiVersion`
 * update in plugins that target it.
 */

import type * as React       from 'react';
import type * as ReactDom    from 'react-dom';
import type * as Mobx        from 'mobx';
import type * as MobxReactLite from 'mobx-react-lite';

import type { App }     from '../../app-catalog/app/App.ts';
import type { AppInfo } from '../../app-catalog/app-info/AppInfo.ts';
import type { AppInfoLocalization } from '../../app-catalog/app-info/AppInfoLocalization.ts';
import type { Version } from '../../release/version/Version.ts';
import type { VersionLocalization } from '../../release/version/VersionLocalization.ts';
import type { AgeRatingDeclaration } from '../../app-catalog/age-rating/AgeRatingDeclaration.ts';
import type { ASCWorkspace } from '../../workspace/ASCWorkspace.ts';

import type { PluginRegistration } from './Plugin.ts';

/** Host plugin-API semver. Bump the major when a breaking change removes
 *  or renames a field in this file. Bump the minor on additive changes. */
export const PLUGIN_API_VERSION = '1.0.0';

// ── Top-level ────────────────────────────────────────────────────────

export interface PluginAPI {
  /** Semver of the plugin API itself. Plugins can gate their `activate`
   *  behaviour on this at runtime. */
  readonly version: string;

  /** Register contributions. Idempotent per plugin `id` — calling twice
   *  replaces the previous registration, which is handy for HMR. */
  register(registration: PluginRegistration): void;

  /** Host-exposed namespaces. */
  host: {
    runtime:   HostRuntime;
    domain:    HostDomain;
    workspace: WorkspaceAccess;
    apiClient: HostApiClient;
    settings:  PluginSettings;
    ui:        HostUI;
  };
}

// ── host.runtime ─────────────────────────────────────────────────────

/** React/MobX runtime handles. Plugins use these instead of bundling their
 *  own copies — keeps bundle sizes tiny and guarantees a single React
 *  reconciler across host + plugins. */
export interface HostRuntime {
  react: typeof React;
  reactDom: typeof ReactDom;
  mobx: typeof Mobx;
  mobxReactLite: typeof MobxReactLite;
}

// ── host.domain ──────────────────────────────────────────────────────

/** Observable domain class constructors + types plugins can reuse. Grows
 *  additively. Removal is a major bump. */
export interface HostDomain {
  App: typeof App;
  AppInfo: typeof AppInfo;
  AppInfoLocalization: typeof AppInfoLocalization;
  Version: typeof Version;
  VersionLocalization: typeof VersionLocalization;
  AgeRatingDeclaration: typeof AgeRatingDeclaration;
}

// ── host.workspace ───────────────────────────────────────────────────

/** Narrow projection of ASCWorkspace for plugin consumption. Plugins get
 *  the observable fields they need without seeing internals. */
export interface WorkspaceAccess {
  readonly workspace: ASCWorkspace;
  /** Shortcut for `workspace.currentApp`. */
  currentApp(): App | null;
  /** Shortcut for `workspace.currentApp?.selectedVersion`. */
  selectedVersion(): Version | null;
}

// ── host.apiClient ───────────────────────────────────────────────────

/** Thin REST helper pre-wired to the same asc-cli base the host uses.
 *  Plugins that hit *external* services (e.g. OpenAI) should use `fetch`
 *  directly; this helper is for calls to asc-cli's own API. */
export interface HostApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

// ── host.settings ────────────────────────────────────────────────────

/** Plugin-scoped persisted settings store. Backed by asc-cli on disk
 *  (plaintext JSON at `~/.asc/plugin-settings/<id>.json`). Browser falls
 *  back to localStorage when the asc-cli endpoints aren't deployed yet;
 *  otherwise production always round-trips through asc-cli so settings
 *  survive browser wipes and sync across browsers on the same machine.
 *
 *  NOTE: plaintext only. We intentionally do not offer keychain storage
 *  for "secret" fields — the tradeoff was that it adds API surface and
 *  CLI complexity for marginal benefit (macOS-only, no iOS/other).
 *  Plugins that hold long-lived credentials should tell the user the
 *  file lives at `~/.asc/plugin-settings/<id>.json` and ensure the user
 *  trusts the machine. */
export interface PluginSettings {
  /** Load the current settings blob. Returns `{}` if nothing is stored. */
  load<T extends Record<string, unknown>>(pluginId: string): Promise<T>;

  /** Save the settings blob. Overwrites prior contents. */
  save<T extends Record<string, unknown>>(pluginId: string, value: T): Promise<void>;

  /** Subscribe to external writes (another tab, CLI edit). Returns an
   *  unsubscribe function. Implementation may poll — plugins should not
   *  assume sub-second latency. */
  subscribe(pluginId: string, onChange: () => void): () => void;
}

// ── host.ui ──────────────────────────────────────────────────────────

/** Host design-system primitives re-exported so plugin UIs inherit the
 *  app's look-and-feel by default and don't drift visually. */
export interface HostUI {
  /** Design tokens exposed as CSS custom-property *names* (e.g. `--accent`)
   *  so plugins compose with the same palette the host uses. Values come
   *  from the live stylesheet; the plugin reads them via `getComputedStyle`
   *  if it needs the resolved colour. */
  tokens: Readonly<Record<string, string>>;

  components: {
    Card: React.FC<{ children?: React.ReactNode; className?: string }>;
    Modal: React.FC<{
      open: boolean;
      onClose: () => void;
      title?: string;
      children?: React.ReactNode;
    }>;
    FormGroup: React.FC<{
      label: string;
      hint?: string;
      htmlFor?: string;
      children?: React.ReactNode;
    }>;
    Button: React.FC<
      React.ButtonHTMLAttributes<HTMLButtonElement> & {
        tone?: 'primary' | 'secondary' | 'danger';
        size?: 'sm' | 'md';
      }
    >;
  };
}
