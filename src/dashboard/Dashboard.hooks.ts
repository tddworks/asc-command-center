import { useEffect, useState } from 'react';
import { Dashboard } from './Dashboard.ts';
import { repositoryFor } from './infrastructure/Dashboard.api.ts';
import { useDataMode } from '../shared/api-client.tsx';
import { useCurrentApp } from '../shared/current-app.tsx';

export function useDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();
  const { currentAppId, loading: currentAppLoading } = useCurrentApp();

  useEffect(() => {
    // Wait for current-app resolution before firing — avoids an initial
    // load with currentAppId=null and then a re-load as soon as the first
    // app is auto-picked.
    if (currentAppLoading) return;

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
  }, [mode, currentAppId, currentAppLoading]);

  return { dashboard, loading, error };
}
