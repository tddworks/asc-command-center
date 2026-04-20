import { useEffect, useState } from 'react';
import { Dashboard } from './Dashboard.ts';
import { repositoryFor } from './infrastructure/Dashboard.api.ts';
import { useDataMode } from '../shared/api-client.tsx';

export function useDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repositoryFor(mode)
      .then((repo) => repo.load())
      .then((d) => { if (!cancelled) setDashboard(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  return { dashboard, loading, error };
}
