import type { FocusPin, WorkspaceStore } from '../WorkspaceStore.ts';

/** In-memory WorkspaceStore for tests and SSR defaults. */
export class InMemoryWorkspaceStore implements WorkspaceStore {
  private pin: FocusPin;

  constructor(initial: Partial<FocusPin> = {}) {
    this.pin = { appId: initial.appId ?? null, versionId: initial.versionId ?? null };
  }

  read(): FocusPin {
    return { ...this.pin };
  }

  write(pin: FocusPin): void {
    this.pin = { ...pin };
  }
}
