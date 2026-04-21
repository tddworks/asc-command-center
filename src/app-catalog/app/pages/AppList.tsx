import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { AppCard } from '../components/AppCard.tsx';

function AppList() {
  const workspace = useWorkspace();

  if (!workspace || !workspace.hydrated) {
    return <div className="spinner">Loading apps...</div>;
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
