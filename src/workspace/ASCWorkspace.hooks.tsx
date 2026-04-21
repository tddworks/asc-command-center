import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Apps } from '../app/Apps.ts';
import { repositoryFor } from '../app/infrastructure/App.api.ts';
import { useDataMode } from '../shared/api-client.tsx';
import { ASCWorkspace } from './ASCWorkspace.ts';
import { LocalStorageWorkspaceStore } from './infrastructure/LocalStorage.store.ts';

const WorkspaceContext = createContext<ASCWorkspace | null>(null);

/**
 * Builds a single ASCWorkspace per data-mode, hydrates it on mount, and
 * exposes it via context. Components read the workspace via `useWorkspace()`
 * and MUST be wrapped in `observer()` (from mobx-react-lite) to re-render
 * when fields mutate.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const mode = useDataMode();
  const [workspace, setWorkspace] = useState<ASCWorkspace | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const repo = await repositoryFor(mode);
      const ws = new ASCWorkspace(new Apps(repo), new LocalStorageWorkspaceStore());
      await ws.hydrate();
      if (!cancelled) setWorkspace(ws);
    })();

    return () => { cancelled = true; };
  }, [mode]);

  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Read the current ASCWorkspace. Returns `null` before hydration completes. */
export function useWorkspace(): ASCWorkspace | null {
  return useContext(WorkspaceContext);
}
