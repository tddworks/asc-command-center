import { observer } from 'mobx-react-lite';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import { AppCard } from '../components/AppCard.tsx';

function AppList() {
  if (!workspace.hydrated) {
    return <div className="loading"><span className="spinner" /><span>Loading apps...</span></div>;
  }

  return (
    <div>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"><h3>Apps</h3></div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="grid-3" style={{ padding: 16 }}>
            {workspace.apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default observer(AppList);
