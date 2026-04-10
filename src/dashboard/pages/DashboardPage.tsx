import { useApps } from '../../app/App.hooks.ts';
import { AppCard } from '../../app/components/AppCard.tsx';

export default function DashboardPage() {
  const { apps, loading } = useApps();

  return (
    <div>
      <h2>Dashboard</h2>
      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <div className="grid-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
