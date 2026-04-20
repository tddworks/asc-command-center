import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, useDataMode } from './api-client.tsx';

/**
 * "Current selected app" — the app the user is focused on. Drives any view
 * that wants per-app scope (Dashboard submission tiles, future per-app
 * detail pages, etc.).
 *
 * Persisted to localStorage so a reload doesn't reset the pin. On first load
 * with nothing stored, auto-selects the first app returned by `/api/v1/apps`
 * (in REST mode) or a mock default (in mock mode).
 */

const STORAGE_KEY = 'asc.currentAppId';

type AppSummary = { id: string; name: string; bundleId: string };

interface CurrentAppValue {
  currentAppId: string | null;
  currentApp: AppSummary | null;
  setCurrentAppId: (id: string | null) => void;
  availableApps: AppSummary[];
  loading: boolean;
}

const CurrentAppContext = createContext<CurrentAppValue>({
  currentAppId: null,
  currentApp: null,
  setCurrentAppId: () => {},
  availableApps: [],
  loading: true,
});

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — silently no-op */
  }
}

export function CurrentAppProvider({ children }: { children: ReactNode }) {
  const mode = useDataMode();
  const [currentAppId, setIdState] = useState<string | null>(() => readStored());
  const [availableApps, setAvailableApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const setCurrentAppId = useCallback((id: string | null) => {
    setIdState(id);
    writeStored(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async (): Promise<AppSummary[]> => {
      if (mode === 'mock') {
        return [
          { id: 'app-1', name: 'WeatherApp', bundleId: 'com.example.weather' },
          { id: 'app-2', name: 'FitnessTracker', bundleId: 'com.example.fitness' },
        ];
      }
      const json = await apiClient.get<{
        data: Array<{ id: string; name?: string; bundleId?: string }>;
      }>('/api/v1/apps');
      return json.data.map((a) => ({
        id: a.id,
        name: a.name ?? '',
        bundleId: a.bundleId ?? '',
      }));
    };

    load()
      .then((apps) => {
        if (cancelled) return;
        setAvailableApps(apps);

        // If nothing is stored, or stored id isn't in the list, default to
        // the first available app. This is the "asc init's project app"
        // behaviour — users who haven't pinned anything get a sensible scope.
        const stored = readStored();
        const match = stored && apps.some((a) => a.id === stored) ? stored : apps[0]?.id ?? null;
        if (match !== stored) writeStored(match);
        setIdState(match);
      })
      .catch(() => {
        if (!cancelled) setAvailableApps([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const currentApp = availableApps.find((a) => a.id === currentAppId) ?? null;

  return (
    <CurrentAppContext.Provider
      value={{ currentAppId, currentApp, setCurrentAppId, availableApps, loading }}
    >
      {children}
    </CurrentAppContext.Provider>
  );
}

export const useCurrentApp = () => useContext(CurrentAppContext);
