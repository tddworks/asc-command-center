/**
 * Persisted focus pin — what app/version the user had open last session.
 * Platform concerns (localStorage, SQLite, memory) live in adapters.
 */
export interface FocusPin {
  appId: string | null;
  versionId: string | null;
}

export interface WorkspaceStore {
  read(): FocusPin;
  write(pin: FocusPin): void;
}
