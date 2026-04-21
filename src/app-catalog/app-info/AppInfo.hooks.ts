import { useEffect, useState } from 'react';
import { AppInfo } from './AppInfo.ts';
import { AppInfos } from './AppInfos.ts';
import { repositoryFor } from './infrastructure/AppInfo.api.ts';
import { useDataMode } from '../../shared/api-client.tsx';

/**
 * Loads all AppInfo rows for the app (one per version state) and returns
 * the row that matches `selectedVersionState` — Apple calls that the
 * `appStoreState` on AppInfo and it maps 1:1 to Version.state. If no row
 * matches, falls back to the first one.
 *
 * `primaryLocale` is threaded to the REST adapter so it can seed an empty
 * primary-locale row when the backend returns none — the form always has a
 * valid target to bind to.
 */
export function useAppInfo(
  appId: string | null,
  selectedVersionState: string | null,
  primaryLocale: string | null,
) {
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
      .then((repo) => new AppInfos(repo).list(appId, { primaryLocale: primaryLocale ?? undefined }))
      .then((items) => { if (!cancelled) setList(items); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [appId, mode, primaryLocale]);

  // Pick the AppInfo row whose appStoreState matches the version we're
  // looking at. Cheap derivation on every render — no extra re-fetch.
  const appInfo =
    list.find((i) => i.appStoreState === selectedVersionState) ??
    list[0] ??
    null;

  return { appInfo, loading, error };
}
