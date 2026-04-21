import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { useAppInfo } from '../AppInfo.hooks.ts';
import type { AppInfo } from '../AppInfo.ts';
import type { AppInfoLocalization } from '../AppInfoLocalization.ts';
import { SectionHeader } from '../../../shared/components/SectionHeader.tsx';
import { SubSection } from '../../../shared/components/SubSection.tsx';
import { FieldCard } from '../../../shared/components/FieldCard.tsx';
import { RadioCard } from '../../../shared/components/RadioCard.tsx';

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
  { id: 'PHOTOGRAPHY', label: 'Photography' },
];

// ─── Icons (inline SVG, no new deps) ─────────────────────────────────

const Icon = {
  appSquare: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h8v8H8z"/></svg>,
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  dice: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>,
  paper: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>,
  no: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>,
  yes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
};

function AppInfoPage() {
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const selectedVersion = currentApp?.selectedVersion ?? null;
  const { appInfo, loading, error } = useAppInfo(
    currentApp?.id ?? null,
    selectedVersion?.state ?? null,
    currentApp?.primaryLocale ?? null,
  );

  if (!workspace?.hydrated) return <div className="spinner">Loading…</div>;

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
    <div className="app-info-wrap">
      <AppMetadataSection appInfo={appInfo} />
      <LocalizationsSection appInfo={appInfo} />
      <PrivacyComplianceSection appInfo={appInfo} />
      <StickySaveBar appInfo={appInfo} />
    </div>
  );
}

// ─── App Metadata ───────────────────────────────────────────────────

const AppMetadataSection = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const primary = appInfo.localizationFor(appInfo.primaryLocale);

  return (
    <section className="ai-section-wrap">
      <SectionHeader
        icon={Icon.appSquare}
        tone="blue"
        title="App Metadata"
        subtitle="What Apple shows on the App Store listing."
      />
      <div className="card">
        <SubSection icon={Icon.appSquare} tone="blue" title="Names & categories">
          <FieldCard
            icon={Icon.appSquare}
            tone="blue"
            label="App Name"
            required
            hint="Required · The name shown on the App Store and on iPhone home screens."
          >
            <input
              className="form-input"
              value={primary?.name ?? ''}
              placeholder="My App"
              onChange={(e) => primary?.setName(e.target.value)}
            />
          </FieldCard>
          <FieldCard
            icon={Icon.appSquare}
            tone="yellow"
            label="Subtitle"
            hint="Optional · Up to 30 characters summarizing what the app does."
          >
            <input
              className="form-input"
              value={primary?.subtitle ?? ''}
              placeholder="A short description"
              onChange={(e) => primary?.setSubtitle(e.target.value || null)}
            />
          </FieldCard>
          <div className="ai-grid-2">
            <FieldCard
              icon={Icon.appSquare}
              tone="green"
              label="Primary Category"
              required
              hint="Main App Store listing. Required for review."
            >
              <select
                className="form-input select-styled"
                value={appInfo.primaryCategoryId ?? ''}
                onChange={(e) => appInfo.setPrimaryCategory(e.target.value || null)}
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </FieldCard>
            <FieldCard
              icon={Icon.appSquare}
              tone="purple"
              label="Secondary Category"
              hint="Optional · Places you in a second browse lane."
            >
              <select
                className="form-input select-styled"
                value={appInfo.secondaryCategoryId ?? ''}
                onChange={(e) => appInfo.setSecondaryCategory(e.target.value || null)}
              >
                <option value="">— None —</option>
                {CATEGORIES
                  .filter((c) => c.id !== appInfo.primaryCategoryId)
                  .map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </FieldCard>
          </div>
        </SubSection>
      </div>
    </section>
  );
});

// ─── Localizations ──────────────────────────────────────────────────

const LocalizationsSection = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLocale, setNewLocale] = useState('');

  const startAdd = () => { setAdding(true); setNewLocale(''); };
  const commitAdd = () => {
    const locale = newLocale.trim();
    if (!locale) return;
    try {
      appInfo.addLocalization(locale);
      setAdding(false);
      setNewLocale('');
      setEditingLocale(locale);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <section className="ai-section-wrap">
      <SectionHeader
        icon={Icon.globe}
        tone="purple"
        title="Localizations"
        subtitle="Per-locale name and subtitle. Users see whichever matches their device."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={startAdd}>
            + Add Locale
          </button>
        }
      />
      <div className="card">
        {adding && (
          <div className="ai-add-locale">
            <input
              className="form-input"
              style={{ maxWidth: 240 }}
              placeholder="Locale code (e.g. fr-FR)"
              value={newLocale}
              onChange={(e) => setNewLocale(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd();
                else if (e.key === 'Escape') { setAdding(false); setNewLocale(''); }
              }}
              autoFocus
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={commitAdd}>Add</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setNewLocale(''); }}>Cancel</button>
          </div>
        )}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Locale</th>
                <th>Name</th>
                <th>Subtitle</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appInfo.localizations.map((loc) => (
                <LocaleTableRow
                  key={loc.locale}
                  localization={loc}
                  isPrimary={loc.locale === appInfo.primaryLocale}
                  editing={editingLocale === loc.locale}
                  onEdit={() => setEditingLocale(loc.locale)}
                  onDone={() => setEditingLocale(null)}
                  onDelete={
                    loc.locale !== appInfo.primaryLocale
                      ? () => {
                          if (!confirm(`Remove ${loc.locale}?`)) return;
                          appInfo.removeLocalization(loc.locale);
                          if (editingLocale === loc.locale) setEditingLocale(null);
                        }
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
});

interface LocaleRowProps {
  localization: AppInfoLocalization;
  isPrimary: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onDelete?: () => void;
}

const LocaleTableRow = observer(({ localization, isPrimary, editing, onEdit, onDone, onDelete }: LocaleRowProps) => {
  return (
    <tr>
      <td className="cell-primary">
        {localization.locale}
        {isPrimary && (
          <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>PRIMARY</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="form-input"
            value={localization.name}
            placeholder="Name"
            onChange={(e) => localization.setName(e.target.value)}
          />
        ) : (
          localization.name || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="form-input"
            value={localization.subtitle ?? ''}
            placeholder="Subtitle"
            onChange={(e) => localization.setSubtitle(e.target.value || null)}
          />
        ) : (
          localization.subtitle || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {editing ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onDone}>Done</button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>Edit</button>
          )}
          {onDelete && (
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
          )}
        </div>
      </td>
    </tr>
  );
});

// ─── Privacy & Compliance ──────────────────────────────────────────

const PrivacyComplianceSection = observer(({ appInfo }: { appInfo: AppInfo }) => {
  return (
    <section className="ai-section-wrap">
      <SectionHeader
        icon={Icon.lock}
        tone="green"
        title="Privacy & Compliance"
        subtitle="Privacy policies, age rating, and compliance declarations."
      />
      <div className="card">
        <SubSection icon={Icon.shield} tone="green" title="Privacy Policies">
          <FieldCard
            icon={Icon.link}
            tone="green"
            label="Privacy Policy URL"
            required
            hint={appInfo.privacyPolicyUrl ? undefined : 'Required · Apple rejects submissions without it.'}
          >
            <input
              className="form-input"
              placeholder="https://yourwebsite.com/privacy"
              value={appInfo.privacyPolicyUrl ?? ''}
              onChange={(e) => appInfo.setPrivacyPolicyUrl(e.target.value || null)}
            />
          </FieldCard>
          <FieldCard
            icon={Icon.link}
            tone="green"
            label="Privacy Choices URL"
            hint="Optional · Consider adding a Privacy Choices URL for California users."
          >
            <input
              className="form-input"
              placeholder="https://yourwebsite.com/privacy-choices"
              value={appInfo.privacyChoicesUrl ?? ''}
              onChange={(e) => appInfo.setPrivacyChoicesUrl(e.target.value || null)}
            />
          </FieldCard>
        </SubSection>

        <SubSection icon={Icon.dice} tone="green" title="Age Rating">
          <button type="button" className="age-rating-card" onClick={() => alert('Age rating editor is not implemented yet — coming soon.')}>
            <span className="age-rating-badge">4+</span>
            <span className="age-rating-text">
              <span className="age-rating-title">Ages 4+ and Up</span>
              <span className="age-rating-sub">Age Rating · No objectionable content</span>
            </span>
            <span className="age-rating-chevron" aria-hidden>{Icon.chevron}</span>
          </button>
          <p className="ai-note">
            Click to select the appropriate age rating for your app's content.
          </p>
        </SubSection>

        <SubSection
          icon={Icon.paper}
          tone="pink"
          title="Content Rights"
          sublabel="Third-party Content Declaration"
        >
          <RadioCard
            name="content-rights"
            selectedTone="blue"
            value={appInfo.contentRightsDeclaration}
            onChange={(id) => appInfo.setContentRightsDeclaration(id)}
            options={[
              {
                id: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
                icon: Icon.no,
                iconTone: 'neutral',
                title: 'No, it does not contain, show, or access third-party content',
              },
              {
                id: 'USES_THIRD_PARTY_CONTENT',
                icon: Icon.yes,
                iconTone: 'neutral',
                title: 'Yes, it contains, shows, or accesses third-party content, and I have the necessary rights',
              },
            ]}
          />
        </SubSection>
      </div>
    </section>
  );
});

// ─── Sticky save bar ───────────────────────────────────────────────

const StickySaveBar = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!appInfo.hasUnsavedChanges && !saving) return null;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await appInfo.save();
      setMsg({ kind: 'ok', text: 'Saved' });
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <div className="save-bar-inner">
        <span className="save-bar-status">
          {msg?.kind === 'error'
            ? <span className="save-bar-error">Save failed: {msg.text}</span>
            : msg?.kind === 'ok' ? <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{msg.text}</span>
            : <span>You have unsaved changes</span>}
        </span>
        <div className="save-bar-actions">
          <button type="button" className="btn btn-secondary" onClick={() => appInfo.discard()} disabled={saving}>
            Discard
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default observer(AppInfoPage);
