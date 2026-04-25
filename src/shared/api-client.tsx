import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type DataMode = 'mock' | 'rest';

// ─── API base URL resolution ────────────────────────────────────────
//
// The UI is published as a static SPA at https://cc.asccli.app, but it
// talks to the asc CLI's web-server running on the *user's own machine*.
// Three deployment shapes:
//
//   1. `npm run dev`            → http://localhost:5173, Vite proxies /api/*
//                                 to http://localhost:8420.
//   2. `asc web-server` direct  → http://localhost:8420, same-origin.
//   3. https://cc.asccli.app    → must hit the user's local CLI. HTTPS
//                                 pages cannot fetch http://localhost
//                                 (mixed-content), so we rewrite to
//                                 https://localhost:8421 (asc's HTTPS
//                                 endpoint, self-signed cert that the
//                                 user trusts via the setup sheet).
//
// A single `fetch` interceptor is the chokepoint — every adapter, every
// affordance follow-up, and the DataMode probe all flow through it,
// without each call site having to know about the base URL.

/** localStorage key for an explicit user override (custom port, alt host). */
const API_BASE_OVERRIDE_KEY = 'asc.apiBaseUrl';

/** Default HTTPS endpoint exposed by `asc web-server` — only used when
 *  the page itself is served over HTTPS from a non-localhost origin. */
const DEFAULT_HTTPS_LOCAL = 'https://localhost:8421';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. User override wins. Stored without a trailing slash; we strip
  //    defensively so `${base}/api/v1` always produces a valid URL.
  try {
    const override = localStorage.getItem(API_BASE_OVERRIDE_KEY);
    if (override) return override.replace(/\/+$/, '');
  } catch {
    // SSR / sandboxed iframe — fall through to the default.
  }

  // 2. Same-origin when the page itself runs on localhost. Vite proxies
  //    `/api/*` in dev; the asc CLI serves the UI directly otherwise.
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return '';

  // 3. Public-domain UI (cc.asccli.app, etc.). Must be HTTPS to avoid
  //    mixed-content blocks. The user has to accept the self-signed cert
  //    once at https://localhost:8421 — the CliSetupSheet links there.
  return DEFAULT_HTTPS_LOCAL;
}

export function setApiBaseUrlOverride(url: string | null): void {
  try {
    if (url) localStorage.setItem(API_BASE_OVERRIDE_KEY, url);
    else localStorage.removeItem(API_BASE_OVERRIDE_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Rewrite a relative `/api/...` URL to the resolved API base. Anything
 * else (absolute URLs, third-party endpoints, plugin pages served outside
 * `/api/`) passes through untouched.
 *
 * Exported so that callers using a non-fetch transport — most notably
 * the plugin loader's dynamic `import()` — can route through the same
 * base resolution. The fetch interceptor handles `fetch()` automatically.
 */
export function resolveApiUrl(url: string): string {
  if (!url.startsWith('/api/')) return url;
  const base = getApiBaseUrl();
  return base ? `${base}${url}` : url;
}

/**
 * Resolve a WebSocket URL targeting `/api/...` against the local CLI.
 * Plugin code that does `new WebSocket('wss://' + location.host + '/api/sim/ws')`
 * would otherwise hit the public origin (which has no WebSocket server)
 * — we rewrite to the asc CLI's `wss://localhost:8421` (or `ws://`
 * when running over plain HTTP).
 *
 * Accepts both relative paths (`/api/...`) and already-absolute URLs.
 * Non-`/api/` URLs and third-party endpoints pass through.
 */
export function resolveWsUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return url;
  }
  if (!parsed.pathname.startsWith('/api/')) return url;

  const base = getApiBaseUrl();
  if (!base) return url;

  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    return url;
  }
  parsed.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.host = baseUrl.host;
  return parsed.toString();
}

let fetchInterceptorInstalled = false;
function installFetchInterceptor() {
  if (fetchInterceptorInstalled) return;
  if (typeof globalThis.fetch !== 'function') return;
  fetchInterceptorInstalled = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(resolveApiUrl(input), init);
    }
    if (input instanceof Request) {
      const rewritten = resolveApiUrl(input.url);
      if (rewritten !== input.url) {
        return originalFetch(new Request(rewritten, input), init);
      }
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

// ─── HTML element src/href interceptor ────────────────────────────────
//
// Plugin code that does `img.src = '/api/plugins/ASCPro/frames/foo.png'`
// or `<img src="/api/plugins/...">` doesn't go through `fetch`, so the
// browser resolves the URL against `window.location.origin` — wrong on
// the public-domain build.
//
// We catch this at the DOM-API layer: patch the `src`/`href` property
// setters on the prototypes that ship them, plus `Element.setAttribute`,
// so any `/api/...` URL the plugin assigns gets rewritten through
// `resolveApiUrl`. CSS `background-image: url(/api/...)` is the one
// surface this doesn't cover; plugins should use `<img>` for assets
// they want re-routed.

let assetUrlInterceptorInstalled = false;
function installAssetUrlInterceptor() {
  if (assetUrlInterceptorInstalled) return;
  if (typeof window === 'undefined') return;
  assetUrlInterceptorInstalled = true;

  // Patch the property setter on each element prototype that exposes a
  // resource attribute. Walking up the prototype chain handles cases
  // where the IDL property is defined on `HTMLElement` rather than the
  // specific subclass.
  const elements: Array<[unknown, 'src' | 'href']> = [
    [globalThis.HTMLImageElement?.prototype, 'src'],
    [globalThis.HTMLScriptElement?.prototype, 'src'],
    [globalThis.HTMLSourceElement?.prototype, 'src'],
    [globalThis.HTMLLinkElement?.prototype, 'href'],
    [globalThis.HTMLAnchorElement?.prototype, 'href'],
  ];
  for (const [proto, prop] of elements) {
    if (!proto) continue;
    patchUrlProperty(proto as object, prop);
  }

  // setAttribute is a separate code path — patching the property setter
  // catches `el.src = ...` but not `el.setAttribute('src', ...)`. Cover
  // both so we don't miss plugin code that uses either form.
  const ElementProto = globalThis.Element?.prototype;
  if (ElementProto && typeof ElementProto.setAttribute === 'function') {
    const original = ElementProto.setAttribute;
    ElementProto.setAttribute = function (name: string, value: string) {
      if ((name === 'src' || name === 'href') && typeof value === 'string') {
        return original.call(this, name, resolveApiUrl(value));
      }
      return original.call(this, name, value);
    };
  }
}

function patchUrlProperty(proto: object, prop: 'src' | 'href'): void {
  // The IDL property might be defined further up the prototype chain
  // (e.g. on HTMLElement). Walk until we find a descriptor with both
  // a getter and a setter.
  let current: object | null = proto;
  let descriptor: PropertyDescriptor | undefined;
  while (current) {
    descriptor = Object.getOwnPropertyDescriptor(current, prop);
    if (descriptor?.set && descriptor.get) break;
    current = Object.getPrototypeOf(current);
  }
  if (!descriptor?.set || !descriptor.get) return;
  const originalSet = descriptor.set;
  const originalGet = descriptor.get;

  Object.defineProperty(proto, prop, {
    configurable: true,
    enumerable: descriptor.enumerable,
    get(this: HTMLElement) { return originalGet.call(this); },
    set(this: HTMLElement, value: unknown) {
      const rewritten = typeof value === 'string' ? resolveApiUrl(value) : value;
      originalSet.call(this, rewritten);
    },
  });
}

// ─── WebSocket interceptor ────────────────────────────────────────────
//
// Plugins (notably ASC Pro's simulator stream) open WebSocket connections
// to `/api/sim/ws` on the asc CLI. The browser resolves these against
// `location.host`, so on the public-domain build they hit `cc.asccli.app`
// — which has no WebSocket endpoint. Wrap the constructor so any
// `/api/...` URL is routed to the user's local CLI on `wss://localhost:8421`
// (or `ws://localhost:8420` over plain HTTP).
//
// Class-extension is the cleanest path: it preserves the prototype chain,
// inherits the static `CONNECTING`/`OPEN`/`CLOSING`/`CLOSED` constants,
// and `instanceof WebSocket` keeps working for plugins that check.

let webSocketInterceptorInstalled = false;
function installWebSocketInterceptor() {
  if (webSocketInterceptorInstalled) return;
  if (typeof globalThis.WebSocket !== 'function') return;
  webSocketInterceptorInstalled = true;

  const OriginalWebSocket = globalThis.WebSocket;
  class WrappedWebSocket extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const raw = typeof url === 'string' ? url : url.toString();
      super(resolveWsUrl(raw), protocols);
    }
  }
  globalThis.WebSocket = WrappedWebSocket as unknown as typeof WebSocket;
}

installFetchInterceptor();
installAssetUrlInterceptor();
installWebSocketInterceptor();

// --- Data-mode context ---

const DataModeContext = createContext<{
  mode: DataMode;
  toggleMode: () => void;
  recheck: () => Promise<boolean>;
}>({ mode: 'mock', toggleMode: () => {}, recheck: async () => false });

/** Probe the asc backend at /api/v1. Resolves to true when reachable. */
async function probeBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const resp = await fetch('/api/v1', { signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function DataModeProviderComponent({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataMode>('mock');
  const toggleMode = useCallback(() => setMode(m => m === 'mock' ? 'rest' : 'mock'), []);

  /** Re-probe the backend. Called from the CLI setup sheet's "Try again"
   *  button after the user runs `asc web-server`. Flips to `rest` on
   *  success so the rest of the app starts hitting real endpoints. */
  const recheck = useCallback(async (): Promise<boolean> => {
    const ok = await probeBackend();
    setMode(ok ? 'rest' : 'mock');
    return ok;
  }, []);

  // Auto-detect backend on mount — single probe at startup.
  useEffect(() => {
    void recheck();
  }, [recheck]);

  return (
    <DataModeContext.Provider value={{ mode, toggleMode, recheck }}>
      {children}
    </DataModeContext.Provider>
  );
}

/** Returns the current data mode string ('mock' | 'rest') */
export const useDataMode = () => useContext(DataModeContext).mode;

/** Returns a function to toggle between mock and rest modes */
export const useToggleMode = () => useContext(DataModeContext).toggleMode;

/** Returns a function that re-probes /api/v1 and flips mode accordingly.
 *  Resolves with `true` when the backend is reachable. */
export const useRecheckMode = () => useContext(DataModeContext).recheck;

// --- Command-log context ---

export type CommandLogEntry = { type: 'prompt' | 'output' | 'error'; text: string };

const CommandLogContext = createContext<{
  entries: CommandLogEntry[];
  addEntry: (entry: CommandLogEntry) => void;
}>({ entries: [], addEntry: () => {} });

export function CommandLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<CommandLogEntry[]>([
    { type: 'output', text: 'Ready. Run commands from the UI to see logs here.' },
  ]);
  const addEntry = useCallback((entry: CommandLogEntry) => {
    setEntries(prev => [...prev, entry]);
  }, []);
  return (
    <CommandLogContext.Provider value={{ entries, addEntry }}>
      {children}
    </CommandLogContext.Provider>
  );
}

export const useCommandLog = () => useContext(CommandLogContext);

// --- API client ---

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Convert REST _links to flat affordances on every item in a response.
 *  Exported so adapters that need to do raw `fetch` (POST with non-JSON
 *  responses, follow Location, …) can apply the same normalization. */
export function normalizeLinks(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(normalizeLinks);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Convert _links → affordances
    if (obj._links && !obj.affordances) {
      const links = obj._links as Record<string, { href: string }>;
      const affordances: Record<string, string> = {};
      for (const [key, val] of Object.entries(links)) {
        affordances[key] = typeof val === 'string' ? val : val.href;
      }
      obj.affordances = affordances;
    }
    // Recurse into nested data
    if (obj.data) obj.data = normalizeLinks(obj.data);
    return obj;
  }
  return data;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

/**
 * In-flight GET deduplication — if the same URL is requested twice
 * concurrently, share one promise. Prevents the fan-out caused by React
 * StrictMode's double-invoked effects (and any user-level races).
 * Entries are removed as soon as the underlying fetch settles, so
 * subsequent calls hit the network normally.
 */
const inFlightGets = new Map<string, Promise<unknown>>();

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const existing = inFlightGets.get(path) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = (async () => {
      const { signal, cancel } = withTimeout(DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(path, { signal });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        const json = await res.json();
        return normalizeLinks(json) as T;
      } finally {
        cancel();
      }
    })();

    inFlightGets.set(path, promise);
    try {
      return await promise;
    } finally {
      inFlightGets.delete(path);
    }
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const { signal, cancel } = withTimeout(DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new ApiError(res.status, await res.text());
      return res.json();
    } finally {
      cancel();
    }
  },

  async runCommand(command: string): Promise<{ stdout: string; stderr: string; exit_code: number }> {
    return this.post('/api/run', { command: `asc ${command}` });
  },
};
