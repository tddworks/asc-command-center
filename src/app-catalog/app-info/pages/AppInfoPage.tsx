import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { useAppInfo } from '../AppInfo.hooks.ts';
import LocalizationsTable from '../components/LocalizationsTable.tsx';
import AppInfoSaveBar from '../components/AppInfoSaveBar.tsx';

// Placeholder category list — swap to a real `/app-categories` fetch once the
// category-registry slice is in place (see Known limitations in app-info.md).
const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'WEATHER', label: 'Weather' },
  { id: 'HEALTH_AND_FITNESS', label: 'Health & Fitness' },
  { id: 'PRODUCTIVITY', label: 'Productivity' },
  { id: 'UTILITIES', label: 'Utilities' },
  { id: 'FOOD_AND_DRINK', label: 'Food & Drink' },
  { id: 'SPORTS', label: 'Sports' },
  { id: 'DEVELOPER_TOOLS', label: 'Developer Tools' },
  { id: 'BUSINESS', label: 'Business' },
];

function AppInfoPage() {
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const { appInfo, loading, error } = useAppInfo(currentApp?.id ?? null);

  if (!workspace?.hydrated) {
    return <div className="spinner">Loading…</div>;
  }

  if (!currentApp) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No app selected</h3>
          <p>Pick an app from the sidebar to view its metadata.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="spinner">Loading app info…</div>;

  if (error || !appInfo) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Couldn't load App Info</h3>
          <p>{error?.message ?? 'Unknown error.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-info-page">
      <div className="app-info-header">
        <h2>App Info · {currentApp.name}</h2>
        <p className="text-muted" style={{ fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12 }}>
          {currentApp.bundleId}
        </p>
      </div>

      {/* ── Overview ── */}
      <section className="card app-info-section">
        <div className="toolbar">
          <div className="toolbar-left"><h3>Overview</h3></div>
        </div>
        <div className="card-body padded">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name (primary locale)</label>
              <input
                className="form-control"
                value={appInfo.localizationFor(appInfo.primaryLocale)?.name ?? ''}
                onChange={(e) => {
                  const loc = appInfo.localizationFor(appInfo.primaryLocale);
                  if (loc) loc.setName(e.target.value);
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subtitle (primary locale)</label>
              <input
                className="form-control"
                value={appInfo.localizationFor(appInfo.primaryLocale)?.subtitle ?? ''}
                onChange={(e) => {
                  const loc = appInfo.localizationFor(appInfo.primaryLocale);
                  if (loc) loc.setSubtitle(e.target.value || null);
                }}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bundle ID</label>
              <input className="form-control" value={currentApp.bundleId} readOnly disabled />
            </div>
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input className="form-control" value={currentApp.sku} readOnly disabled />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Primary Locale</label>
              <input className="form-control" value={appInfo.primaryLocale} readOnly disabled />
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="card app-info-section">
        <div className="toolbar">
          <div className="toolbar-left"><h3>Categories</h3></div>
        </div>
        <div className="card-body padded">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Primary</label>
              <select
                className="form-control select-styled"
                value={appInfo.primaryCategoryId ?? ''}
                onChange={(e) => appInfo.setPrimaryCategory(e.target.value || null)}
              >
                <option value="">— none —</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Secondary</label>
              <select
                className="form-control select-styled"
                value={appInfo.secondaryCategoryId ?? ''}
                onChange={(e) => appInfo.setSecondaryCategory(e.target.value || null)}
              >
                <option value="">— none —</option>
                {CATEGORIES
                  .filter((c) => c.id !== appInfo.primaryCategoryId)
                  .map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ── Localizations ── */}
      <section className="card app-info-section">
        <div className="toolbar">
          <div className="toolbar-left"><h3>Localizations</h3></div>
        </div>
        <div className="card-body padded">
          <LocalizationsTable appInfo={appInfo} />
        </div>
      </section>

      {/* ── Privacy & Support ── */}
      <section className="card app-info-section" style={{ marginBottom: 80 }}>
        <div className="toolbar">
          <div className="toolbar-left"><h3>Privacy & Support</h3></div>
        </div>
        <div className="card-body padded">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Privacy Policy URL</label>
              <input
                className="form-control"
                placeholder="https://..."
                value={appInfo.privacyPolicyUrl ?? ''}
                onChange={(e) => appInfo.setPrivacyPolicyUrl(e.target.value || null)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Support URL</label>
              <input
                className="form-control"
                placeholder="https://..."
                value={appInfo.supportUrl ?? ''}
                onChange={(e) => appInfo.setSupportUrl(e.target.value || null)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Marketing URL</label>
              <input
                className="form-control"
                placeholder="https://..."
                value={appInfo.marketingUrl ?? ''}
                onChange={(e) => appInfo.setMarketingUrl(e.target.value || null)}
              />
            </div>
          </div>
        </div>
      </section>

      <AppInfoSaveBar appInfo={appInfo} />
    </div>
  );
}

export default observer(AppInfoPage);
