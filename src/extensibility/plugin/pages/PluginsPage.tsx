import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { installedPlugins } from '../installedPluginsInstance.ts';
import type { InstalledPlugin } from '../InstalledPlugin.ts';
import { useToast } from '../../../shared/components/Toast.tsx';

const PLUGIN_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#EA580C'];

type Tab = 'installed' | 'market';

const PluginsPage = observer(function PluginsPage() {
  const [tab, setTab] = useState<Tab>('installed');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (installedPlugins.loaded) return;
    void installedPlugins.refreshAll();
  }, []);

  // Marketplace search is server-side: debounce the input and call
  // `searchMarket` so the backend's `?q=…` endpoint owns the matching.
  // Installed search stays client-side because the list is already in
  // memory and the user expects instant feedback.
  useEffect(() => {
    if (tab !== 'market') return;
    const handle = setTimeout(() => {
      void installedPlugins.searchMarket(query);
    }, 200);
    return () => clearTimeout(handle);
  }, [tab, query]);

  const list = tab === 'installed' ? installedPlugins.installed : installedPlugins.marketplace;

  const filtered = useMemo(() => {
    if (tab === 'market') return list; // server already filtered
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((p) => {
      const haystack = `${p.name} ${p.slug} ${p.id} ${p.description ?? ''} ${p.author ?? ''} ${p.categories.join(' ')}`;
      return haystack.toLowerCase().includes(needle);
    });
  }, [list, query, tab]);

  return (
    <div>
      <PluginStats />

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="filter-group">
              <button
                type="button"
                className={`filter-btn ${tab === 'installed' ? 'active' : ''}`}
                onClick={() => { setTab('installed'); setQuery(''); }}
              >
                Installed
              </button>
              <button
                type="button"
                className={`filter-btn ${tab === 'market' ? 'active' : ''}`}
                onClick={() => { setTab('market'); setQuery(''); }}
              >
                Marketplace
              </button>
            </div>
          </div>
          <div className="toolbar-right">
            <input
              type="text"
              className="form-input"
              placeholder="Search plugins…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 220, height: 32, fontSize: 12 }}
            />
          </div>
        </div>

        <PluginsContent
          tab={tab}
          plugins={filtered}
          onSwitchTab={setTab}
        />
      </div>
    </div>
  );
});

const PluginStats = observer(function PluginStats() {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      <StatCard
        value={installedPlugins.installedCount}
        label="Installed"
        color="var(--accent)"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="20" height="20">
            <path d="M12 2v6m0 0l3-3m-3 3l-3-3"/>
            <rect x="4" y="8" width="16" height="14" rx="2"/>
            <path d="M9 15h6"/>
          </svg>
        }
      />
      <StatCard
        value={installedPlugins.updatesCount}
        label="Updates"
        color={installedPlugins.hasUpdates ? '#D97706' : '#6B7280'}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="20" height="20">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
            <polyline points="21 3 21 8 16 8"/>
          </svg>
        }
      />
      <StatCard
        value={installedPlugins.marketplaceCount}
        label="Available"
        color="#059669"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="20" height="20">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        }
      />
    </div>
  );
});

function StatCard({ value, label, color, icon }: { value: number; label: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="stat-card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

const PluginsContent = observer(function PluginsContent({
  tab, plugins, onSwitchTab,
}: {
  tab: Tab;
  plugins: InstalledPlugin[];
  onSwitchTab: (t: Tab) => void;
}) {
  const { isLoading, loaded, error } = installedPlugins;

  if (!loaded && isLoading) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <div className="spinner" style={{ margin: '24px auto' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state" style={{ padding: 32 }}>
        <h3>Couldn't load plugins</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  if (plugins.length === 0) {
    if (tab === 'installed') {
      return (
        <div className="empty-state" style={{ padding: 40 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"
               width="48" height="48" style={{ marginBottom: 12 }}>
            <path d="M12 2v6m0 0l3-3m-3 3l-3-3"/>
            <rect x="4" y="8" width="16" height="14" rx="2"/>
            <path d="M9 15h6"/>
          </svg>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 12px' }}>No plugins installed</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onSwitchTab('market')}>
            Browse Marketplace
          </button>
        </div>
      );
    }
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <p style={{ color: 'var(--text-muted)' }}>No plugins available in the marketplace</p>
      </div>
    );
  }

  return (
    <div className="grid-3" style={{ padding: 16 }}>
      {plugins.map((p, i) => (
        <PluginCard key={p.slug || p.id} plugin={p} accentColor={PLUGIN_COLORS[i % PLUGIN_COLORS.length]} />
      ))}
    </div>
  );
});

const PluginCard = observer(function PluginCard({
  plugin, accentColor,
}: {
  plugin: InstalledPlugin;
  accentColor: string;
}) {
  const showToast = useToast();
  // Busy can match the plugin's slug/id (install/uninstall) OR the
  // PluginUpdate's name (apply-update). Cover all three.
  const update = plugin.isInstalled ? installedPlugins.updateFor(plugin) : undefined;
  const busy =
    installedPlugins.busy === plugin.slug ||
    installedPlugins.busy === plugin.id ||
    (update !== undefined && installedPlugins.busy === update.name);

  const handleInstall = async () => {
    try {
      await installedPlugins.install(plugin);
      showToast(`${plugin.name} installed`, 'success');
    } catch (err) {
      showToast(`Install failed: ${(err as Error).message}`, 'error');
    }
  };

  const handleUninstall = async () => {
    if (!confirm(`Uninstall ${plugin.name}?`)) return;
    try {
      await installedPlugins.uninstall(plugin);
      showToast(`${plugin.name} uninstalled`, 'success');
    } catch (err) {
      showToast(`Uninstall failed: ${(err as Error).message}`, 'error');
    }
  };

  const handleUpdate = async () => {
    if (!update) return;
    try {
      await installedPlugins.applyUpdate(update);
      showToast(`${plugin.name} updated to v${update.latestVersion}`, 'success');
    } catch (err) {
      showToast(`Update failed: ${(err as Error).message}`, 'error');
    }
  };

  const initial = plugin.iconLetter;
  const subtitle = [plugin.version ? `v${plugin.version}` : '', plugin.author].filter(Boolean).join(' · ');

  return (
    <div className="app-card" style={{ cursor: 'default', display: 'flex', flexDirection: 'column' }}>
      <div className="app-card-top" style={{ marginBottom: 8 }}>
        <div className="app-icon" style={{
          background: accentColor, width: 44, height: 44, fontSize: 18, borderRadius: 10,
        }}>
          {initial}
        </div>
        <div className="app-card-info" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div className="app-card-name">{plugin.name}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {update && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleUpdate}
                  disabled={busy}
                  title={`Update to v${update.latestVersion}`}
                  style={{ background: '#D97706', borderColor: '#D97706' }}
                >
                  {busy ? 'Updating…' : 'Update'}
                </button>
              )}
              {plugin.isInstalled ? (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleUninstall}
                  disabled={busy}
                  style={{ fontSize: 10, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  {busy ? 'Removing…' : 'Uninstall'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleInstall}
                  disabled={busy}
                >
                  {busy ? 'Installing…' : 'Install'}
                </button>
              )}
            </div>
          </div>
          {subtitle && <div className="app-card-bundle">{subtitle}</div>}
          {update && (
            <div style={{ fontSize: 11, color: '#D97706', marginTop: 2, fontWeight: 600 }}>
              ↑ Update available · {update.versionDelta}
            </div>
          )}
        </div>
      </div>

      <div style={{
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
        marginBottom: 'auto', flex: 1,
      }}>
        {plugin.description ?? <span style={{ color: 'var(--text-muted)' }}>No description.</span>}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {plugin.categories.map((c) => (
            <span key={c} className="platform-badge">{c}</span>
          ))}
        </div>
        {plugin.repositoryURL && (
          <a
            href={plugin.repositoryURL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--text-muted)', fontSize: 11, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Repository
          </a>
        )}
      </div>
    </div>
  );
});

export default PluginsPage;
