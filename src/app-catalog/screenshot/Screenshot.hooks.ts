import { useEffect, useState } from 'react';
import { useDataMode } from '../../shared/api-client.tsx';
import { screenshotRepositoryFor } from './infrastructure/Screenshot.api.ts';
import type { ScreenshotSet } from './ScreenshotSet.ts';

export function useScreenshotSets(versionId: string | null, locale: string | null) {
  const [sets, setSets] = useState<ScreenshotSet[]>([]);
  const [loading, setLoading] = useState<boolean>(!!versionId);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    if (!versionId || !locale) {
      setSets([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    screenshotRepositoryFor(mode)
      .then((repo) => repo.listSets(versionId, locale))
      .then((list) => { if (!cancelled) setSets(list); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [versionId, locale, mode]);

  return { sets, loading, error };
}
