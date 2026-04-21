import { useEffect, useState } from 'react';
import { Dashboard } from './Dashboard.ts';
import { repositoryFor } from './infrastructure/Dashboard.api.ts';
import { useDataMode } from '../shared/api-client.tsx';
import { useWorkspace } from '../workspace/ASCWorkspace.hooks.tsx';

export function useDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();
  const workspace = useWorkspace();
  const currentAppId = workspace?.currentApp?.id ?? null;
  const hydrated = workspace?.hydrated ?? false;

  useEffect(() => {
    // Wait for the workspace to hydrate before firing — avoids an initial
    // load with currentAppId=null and then a re-load as soon as the first
    // app is auto-picked.
    if (!hydrated) return;

    let cancelled = false;
    setLoading(true);
    repositoryFor(mode)
      .then((repo) => repo.load(currentAppId))
      .then((d) => {
        if (!cancelled) setDashboard(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, currentAppId, hydrated]);

  return { dashboard, loading, error };
}
