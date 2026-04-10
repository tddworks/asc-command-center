import { useApps } from '../App.hooks.ts';
import { AppCard } from '../components/AppCard.tsx';

export default function AppList() {
  const { apps, loading, error } = useApps();

  if (loading) return <div className="spinner">Loading apps...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>Apps</h2>
      <div className="grid-3">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  );
}
