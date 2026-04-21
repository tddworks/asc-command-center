import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../AppInfo.ts';

interface Props {
  appInfo: AppInfo;
}

function AppInfoSaveBar({ appInfo }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!appInfo.hasUnsavedChanges && !saving) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await appInfo.save();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <div className="save-bar-inner">
        <span className="save-bar-status">
          {error
            ? <span className="save-bar-error">Save failed: {error}</span>
            : <span>You have unsaved changes</span>}
        </span>
        <div className="save-bar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => appInfo.discard()}
            disabled={saving}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default observer(AppInfoSaveBar);
