import { useReports } from '../Report.hooks.ts';

const categoryColors: Record<string, string> = {
  sales: '#22c55e',
  finance: '#3b82f6',
  analytics: '#a855f7',
  performance: '#f59e0b',
};

export default function ReportsPage() {
  const { reports, loading, error } = useReports();

  if (loading) return <div className="spinner">Loading reports...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>Reports</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {reports.map((r) => (
          <div
            key={r.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  background: categoryColors[r.category] ?? 'var(--border)',
                  color: 'white',
                  textTransform: 'uppercase',
                }}
              >
                {r.category}
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', flex: 1 }}>
              {r.description}
            </div>
            <button
              className="affordance-btn"
              title={r.command}
              style={{ alignSelf: 'flex-start' }}
            >
              Run
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
