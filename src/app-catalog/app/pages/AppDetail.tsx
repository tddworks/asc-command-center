import { useParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { AffordanceBar } from '../../../shared/components/AffordanceBar.tsx';
import { AppIcon } from '../../../shared/components/AppIcon.tsx';

function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const workspace = useWorkspace();

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
    </div>
  );
}

export default observer(AppDetail);
