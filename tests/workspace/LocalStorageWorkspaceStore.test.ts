import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageWorkspaceStore } from '../../src/workspace/infrastructure/LocalStorage.store.ts';

describe('LocalStorageWorkspaceStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns empty pin when nothing is stored', () => {
    const store = new LocalStorageWorkspaceStore();
    expect(store.read()).toEqual({ appId: null, versionId: null });
  });

  it('round-trips a pin through localStorage', () => {
    const store = new LocalStorageWorkspaceStore();
    store.write({ appId: 'a-1', versionId: 'v-2' });
    expect(store.read()).toEqual({ appId: 'a-1', versionId: 'v-2' });
  });

  it('tolerates corrupt JSON by returning an empty pin', () => {
    window.localStorage.setItem('asc.workspace.focus', 'not-json{');
    const store = new LocalStorageWorkspaceStore();
    expect(store.read()).toEqual({ appId: null, versionId: null });
  });
});
