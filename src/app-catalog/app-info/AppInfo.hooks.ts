import { useEffect, useState } from 'react';
import { AppInfo } from './AppInfo.ts';
import { AppInfos } from './AppInfos.ts';
import { repositoryFor } from './infrastructure/AppInfo.api.ts';
import { useDataMode } from '../../shared/api-client.tsx';

/**
 * Loads all AppInfo rows for the app (one per version state) and returns
 * the row that matches `selectedVersionState` — the AppInfo lifecycle state
 * is usually what Apple calls the "appStoreState" here and maps 1:1 to the
 * Version.state. If no row matches, falls back to the first one.
 */
export function useAppInfo(appId: string | null, selectedVersionState: string | null) {
  const [list, setList] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(!!appId);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    if (!appId) {
      setList([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    repositoryFor(mode)
      .then((repo) => new AppInfos(repo).list(appId))
      .then((items) => { if (!cancelled) setList(items); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [appId, mode]);

  // Pick the AppInfo row whose appStoreState matches the version we're
  // looking at. Cheap derivation on every render — no extra re-fetch.
  const appInfo =
    list.find((i) => i.appStoreState === selectedVersionState) ??
    list[0] ??
    null;

  return { appInfo, loading, error };
}
