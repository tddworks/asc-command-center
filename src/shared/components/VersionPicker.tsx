import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../workspace/ASCWorkspace.hooks.tsx';

/**
 * Global version picker — lives in the app header so every page (App Info,
 * Versions, Builds, Submissions, …) shares a single selection. Renders as a
 * small "VERSION 1.0 · Preparing" pill with a native-select affordance.
 * Calls `workspace.selectVersion(id)` which cascades through MobX to every
 * observer-wrapped consumer.
 */
function VersionPicker() {
  const workspace = useWorkspace();
  const app = workspace?.currentApp;
  const version = app?.selectedVersion;

  if (!workspace?.hydrated || !app || !version || app.versions.length === 0) {
    return null;
  }

  return (
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
  );
}

export default observer(VersionPicker);
