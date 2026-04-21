import { useEffect, useState } from 'react';
import { AppInfo } from './AppInfo.ts';
import { AppInfos } from './AppInfos.ts';
import { repositoryFor } from './infrastructure/AppInfo.api.ts';
import { useDataMode } from '../../shared/api-client.tsx';

export function useAppInfo(appId: string | null) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(!!appId);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    if (!appId) {
      setAppInfo(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    repositoryFor(mode)
      .then((repo) => new AppInfos(repo).get(appId))
      .then((info) => { if (!cancelled) setAppInfo(info); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [appId, mode]);

  return { appInfo, loading, error };
}
