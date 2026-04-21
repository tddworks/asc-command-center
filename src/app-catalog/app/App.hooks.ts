import { useState, useEffect } from 'react';
import { App } from './App.ts';
import { Apps } from './Apps.ts';
import { repositoryFor } from './infrastructure/App.api.ts';
import { useDataMode } from '../../shared/api-client.tsx';

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repositoryFor(mode)
      .then((repo) => new Apps(repo).list())
      .then((list) => { if (!cancelled) setApps(list); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  return { apps, loading, error };
}

export function useApp(appId: string) {
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repositoryFor(mode)
      .then((repo) => new Apps(repo).get(appId))
      .then((found) => { if (!cancelled) setApp(found); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appId, mode]);

  return { app, loading, error };
}
