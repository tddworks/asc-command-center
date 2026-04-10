import { useDashboard } from '../Dashboard.hooks.ts';
import { AppCard } from '../../app/components/AppCard.tsx';
import { BuildRow } from '../../build/components/BuildRow.tsx';

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading } = useDashboard();

  if (loading || !data) return <div className="spinner">Loading dashboard...</div>;

  return (
    <div>
      <h2>Dashboard</h2>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Apps" value={data.totalApps} color="var(--text)" />
        <StatCard label="Live on Store" value={data.liveVersions} color="var(--green)" />
        <StatCard label="Valid Builds" value={data.recentBuilds} color="var(--blue)" />
        <StatCard label="Pending Review" value={data.pendingReviews} color="var(--yellow)" />
      </div>

      {/* Apps */}
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Apps</h3>
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {data.apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>

      {/* Recent Builds */}
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Recent Builds</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Build</th>
            <th>Usable</th>
            <th>Status</th>
            <th>Expired</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.builds.slice(0, 5).map((b) => (
            <BuildRow key={b.id} build={b} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
