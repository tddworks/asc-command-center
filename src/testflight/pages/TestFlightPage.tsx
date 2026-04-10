import { useTestFlight } from '../TestFlight.hooks.ts';
import { BetaGroupCard } from '../components/BetaGroupCard.tsx';

export default function TestFlightPage({ appId = 'app-1' }: { appId?: string }) {
  const { betaGroups, loading, error } = useTestFlight(appId);

  if (loading) return <div className="spinner">Loading beta groups...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>TestFlight</h2>
      <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {betaGroups.map((g) => <BetaGroupCard key={g.id} group={g} />)}
      </div>
    </div>
  );
}
