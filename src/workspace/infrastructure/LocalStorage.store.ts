import type { FocusPin, WorkspaceStore } from '../WorkspaceStore.ts';

const KEY = 'asc.workspace.focus';

/** Browser-backed WorkspaceStore. Falls back to a transient no-op when
 *  `window.localStorage` isn't available (SSR, tests, private mode). */
export class LocalStorageWorkspaceStore implements WorkspaceStore {
  read(): FocusPin {
    if (typeof window === 'undefined') return empty();
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<FocusPin>;
      return {
        appId: parsed.appId ?? null,
        versionId: parsed.versionId ?? null,
      };
    } catch {
      return empty();
    }
  }

  write(pin: FocusPin): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(pin));
    } catch {
      /* storage unavailable — silently drop */
    }
  }
}

function empty(): FocusPin {
  return { appId: null, versionId: null };
}
