import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { useAppInfo } from '../../app-info/AppInfo.hooks.ts';
import { useScreenshotSets } from '../Screenshot.hooks.ts';
import { dimensions, type DisplayTypeMeta } from '../ScreenshotDisplayType.ts';
import type { Screenshot } from '../Screenshot.ts';
import type { ScreenshotSet } from '../ScreenshotSet.ts';

function ScreenshotPage() {
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const version = currentApp?.selectedVersion ?? null;

  // Locales for the language switcher come from the current AppInfo —
  // same source the App Info page uses.
  const { appInfo } = useAppInfo(
    currentApp?.id ?? null,
    version?.state ?? null,
    currentApp?.primaryLocale ?? null,
  );
  const availableLocales = appInfo?.localizations.map((l) => l.locale) ?? [];
  const defaultLocale = currentApp?.primaryLocale ?? availableLocales[0] ?? 'en-US';

  const [selectedLocale, setSelectedLocale] = useState<string>(defaultLocale);
  useEffect(() => { setSelectedLocale(defaultLocale); }, [defaultLocale, version?.id]);

  const { sets, loading, error } = useScreenshotSets(
    version?.id ?? null,
    selectedLocale,
  );

  if (!workspace?.hydrated) return <div className="spinner">Loading…</div>;

  if (!currentApp) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No app selected</h3>
          <p>Pick an app from the sidebar to view screenshots.</p>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No version available</h3>
          <p>Create a version before uploading screenshots.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Couldn't load screenshots</h3>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  // Group sets by platform so iPhone + iPad render as distinct sections.
  const iphoneSets = sets.filter((s) => s.meta?.platform === 'IOS');
  const ipadSets = sets.filter((s) => s.meta?.platform === 'IPAD_OS');

  return (
    <div className="app-info-wrap">
      <ScreenshotsHeaderCard
        primaryLocale={currentApp.primaryLocale}
        selectedLocale={selectedLocale}
        availableLocales={availableLocales}
        onLocaleChange={setSelectedLocale}
      />

      {loading && (
        <div className="card">
          <div className="card-body padded" style={{ color: 'var(--text-muted)' }}>
            Loading screenshot sets…
          </div>
        </div>
      )}

      {!loading && iphoneSets.length > 0 && (
        <PlatformSection title="iPhone" sets={iphoneSets} />
      )}
      {!loading && ipadSets.length > 0 && (
        <PlatformSection title="iPad" sets={ipadSets} />
      )}

      {!loading && sets.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <h3>No screenshot sets</h3>
            <p>No display types are configured for this version.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Header + language switcher ────────────────────────────────────

function ScreenshotsHeaderCard({
  primaryLocale, selectedLocale, availableLocales, onLocaleChange,
}: {
  primaryLocale: string;
  selectedLocale: string;
  availableLocales: string[];
  onLocaleChange: (locale: string) => void;
}) {
  const locales = availableLocales.length > 0 ? availableLocales : [primaryLocale];
  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>Screenshots</h3>
        </div>
        <div className="toolbar-right">
          <label className="language-switcher">
            <span className="language-switcher-label">Language</span>
            <span className="language-switcher-pill">
              <span>{selectedLocale}{selectedLocale === primaryLocale ? ' · primary' : ''}</span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="5 6 8 9 11 6"/>
              </svg>
              <select
                aria-label="Select language"
                value={selectedLocale}
                onChange={(e) => onLocaleChange(e.target.value)}
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {l}{l === primaryLocale ? ' · primary' : ''}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      </div>
      <div className="card-body padded" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Upload screenshots per device type for the selected language.
        Required sizes are marked; Apple needs at least one for each required type.
      </div>
    </div>
  );
}

// ─── Per-platform section (iPhone / iPad / …) ──────────────────────

function PlatformSection({ title, sets }: { title: string; sets: ScreenshotSet[] }) {
  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>{title}</h3>
          <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>
            {sets.length} display types
          </span>
        </div>
      </div>
      <div className="card-body padded" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sets.map((s) => <DisplayTypeRow key={s.id} set={s} />)}
      </div>
    </div>
  );
}

const DisplayTypeRow = observer(({ set }: { set: ScreenshotSet }) => {
  const meta = set.meta;
  if (!meta) return null;
  return (
    <div className="ss-row">
      <div className="ss-row-head">
        <div className="ss-row-title">
          <span>{meta.label}</span>
          {meta.required && <span className="ss-required-tag">Required</span>}
        </div>
        <div className="ss-row-sub">
          {dimensions(meta)} · {set.count} of {meta.maxScreenshots} · {meta.fullName}
        </div>
      </div>
      <div className="ss-thumb-row">
        {set.screenshots.map((s) => <Thumbnail key={s.id} shot={s} meta={meta} />)}
        {set.canAddMore && <AddSlot meta={meta} />}
      </div>
    </div>
  );
});

function Thumbnail({ shot, meta }: { shot: Screenshot; meta: DisplayTypeMeta }) {
  const src = shot.srcAt(140) ?? '';
  const aspectRatio = meta.width / meta.height;
  const w = 140;
  const h = Math.round(w / aspectRatio);
  return (
    <div className="ss-thumb" style={{ width: w, height: h }}>
      {src ? (
        <img src={src} alt={shot.fileName} width={w} height={h} />
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No preview</span>
      )}
    </div>
  );
}

function AddSlot({ meta }: { meta: DisplayTypeMeta }) {
  const aspectRatio = meta.width / meta.height;
  const w = 140;
  const h = Math.round(w / aspectRatio);
  return (
    <button
      type="button"
      className="ss-add-slot"
      style={{ width: w, height: h }}
      onClick={() => alert('Screenshot upload isn\'t wired yet — coming soon.')}
    >
      <span className="ss-add-slot-plus">+</span>
      <span className="ss-add-slot-label">Add</span>
    </button>
  );
}

export default observer(ScreenshotPage);
