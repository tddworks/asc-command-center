import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { AffordanceBar } from '../../../shared/components/AffordanceBar.tsx';
import { AppIcon } from '../../../shared/components/AppIcon.tsx';
import { VersionManagementDialog } from '../../../release/version/components/VersionManagementDialog.tsx';

function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const workspace = useWorkspace();
  const [manageOpen, setManageOpen] = useState(false);

  if (!workspace || !workspace.hydrated) {
    return <div className="spinner">Loading app...</div>;
  }

  const app = workspace.apps.find((a) => a.id === appId);
  if (!app) return <div className="empty-state">App not found</div>;

  return (
    <div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <AppIcon app={app} size={40} />
            <h3>{app.name}</h3>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setManageOpen(true)}
              disabled={!app.canCreateVersion}
              title={app.canCreateVersion
                ? 'Create or update a version'
                : 'Backend does not expose a createVersion affordance'}
            >
              <span aria-hidden style={{ marginRight: 6 }}>⚙</span>
              Manage Versions
            </button>
          </div>
        </div>
        <div className="card-body">
          <dl>
            <dt>Bundle ID</dt><dd>{app.bundleId}</dd>
            <dt>SKU</dt><dd>{app.sku}</dd>
            <dt>Locale</dt><dd>{app.primaryLocale}</dd>
          </dl>
          <AffordanceBar affordances={app.affordances} />
        </div>
      </div>

      {manageOpen && (
        <VersionManagementDialog
          app={app}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

export default observer(AppDetail);
