import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { workspace } from '../../workspace/workspaceInstance.ts';
import { VersionManagementDialog } from '../../release/version/components/VersionManagementDialog.tsx';

/**
 * Global version picker — lives in the app header so every page (App Info,
 * Versions, Builds, Submissions, …) shares a single selection and a single
 * place to create or update versions.
 *
 * Renders three things:
 *   • A version-selection pill (only when at least one version is loaded).
 *   • A "Manage Versions" icon button — always visible while an app is
 *     selected, so users can create the first version on a fresh app.
 *   • The VersionManagementDialog when the manage button is clicked.
 *
 * Disabled state on the manage button reflects the backend's
 * `createVersion` capability — when the affordance is missing we still
 * render the icon but tooltip-explain why it's off.
 */
function VersionPicker() {
  const [manageOpen, setManageOpen] = useState(false);

  if (!workspace.hydrated) return null;
  const app = workspace.currentApp;
  if (!app) return null;

  const version = app.selectedVersion;

  return (
    <div className="version-picker-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {version && app.versions.length > 0 && (
        <label className="version-picker">
          <span className="version-picker-label">Version</span>
          <span className="version-picker-pill">
            <span className="version-picker-text">
              {version.versionString}
              <span className="version-picker-sep" aria-hidden> · </span>
              <span className="version-picker-status">{version.statusLabel}</span>
            </span>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="5 6 8 9 11 6"/>
            </svg>
            <select
              aria-label="Select version"
              value={version.id}
              onChange={(e) => workspace.selectVersion(e.target.value)}
            >
              {app.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionString} · {v.statusLabel}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}

      <button
        type="button"
        className="header-btn"
        title={app.canManageVersions
          ? (app.canCreateVersion
              ? 'Manage versions — create or update'
              : 'Manage versions — update existing')
          : 'Nothing to manage — no editable version and no createVersion affordance'}
        aria-label="Manage versions"
        disabled={!app.canManageVersions}
        onClick={() => setManageOpen(true)}
      >
        {/* "Layers / stack" glyph — reads as version management. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
      </button>

      {manageOpen && (
        <VersionManagementDialog
          app={app}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

export default observer(VersionPicker);
