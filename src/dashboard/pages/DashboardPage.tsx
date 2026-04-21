import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../Dashboard.hooks.ts';
import { Dashboard } from '../Dashboard.ts';
import { BuildRow } from '../../release/build/components/BuildRow.tsx';
import type { Certificate } from '../../developer-tools/code-signing/Certificate.ts';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../workspace/ASCWorkspace.hooks.tsx';

// ─── Icons (stroke-2, matching the sidebar icon grammar) ─────────────────────

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconCube = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

// ─── StatCard — mirrors reference `.stat-card` markup ────────────────────────

type IconColor = 'blue' | 'green' | 'purple' | 'orange';

interface StatCardProps {
  icon: React.ReactNode;
  iconColor: IconColor;
  value: string;
  label: string;
  change?: { text: string; variant: 'up' | 'down' };
  onClick?: () => void;
}

function StatCard({ icon, iconColor, value, label, change, onClick }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className="stat-card"
      onClick={onClick}
      style={onClick ? { textAlign: 'left', cursor: 'pointer', font: 'inherit' } : undefined}
    >
      <div className="stat-header">
        <div className={`stat-icon ${iconColor}`}>{icon}</div>
        {change && <span className={`stat-change ${change.variant}`}>{change.text}</span>}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </Tag>
  );
}

// ─── Derive tile props from the Dashboard aggregate ──────────────────────────

function tilesFor(dashboard: Dashboard): StatCardProps[] {
  const issues = dashboard.submissionsWithIssues;
  const awaiting = dashboard.submissionsAwaitingReview;
  const critical = dashboard.criticalCertificates.length;
  const warning = dashboard.warningCertificates.length;

  return [
    {
      icon: <IconAlert />,
      iconColor: 'orange',
      value: String(issues),
      label: 'Unresolved submissions',
      change: issues > 0 ? { text: 'Action', variant: 'down' } : undefined,
    },
    {
      icon: <IconClock />,
      iconColor: 'purple',
      value: String(awaiting),
      label: 'Awaiting Apple review',
      change: awaiting > 0 ? { text: 'In queue', variant: 'up' } : undefined,
    },
    {
      icon: <IconShield />,
      iconColor: 'orange',
      value: String(critical + warning),
      label: 'Certificates expiring',
      change:
        critical > 0
          ? { text: 'Critical', variant: 'down' }
          : warning > 0
            ? { text: 'Soon', variant: 'up' }
            : undefined,
    },
    {
      icon: <IconCube />,
      iconColor: 'blue',
      value: String(dashboard.recentBuilds.length),
      label: 'Recent builds',
      change: dashboard.recentBuilds.length > 0 ? { text: 'Last 5', variant: 'up' } : undefined,
    },
  ];
}

// ─── Certificate row ─────────────────────────────────────────────────────────

function CertificateRow({ cert }: { cert: Certificate }) {
  const days = cert.daysUntilExpiration();
  const statusClass = cert.isExpiringCritical() ? 'rejected' : 'pending';
  const statusText = days <= 0
    ? 'Expired'
    : `${days} day${days === 1 ? '' : 's'}`;
  return (
    <tr>
      <td><span className="cell-primary">{cert.name}</span></td>
      <td><span className="cell-mono">{cert.certificateType}</span></td>
      <td><span className={`status ${statusClass}`}>{statusText}</span></td>
      <td>{cert.expirationDate.slice(0, 10)}</td>
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { dashboard, loading, error } = useDashboard();
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const navigate = useNavigate();

  if (error) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Couldn't load the dashboard</h3>
          <p style={{ marginBottom: 4 }}>{error.message}</p>
          <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            Check that the asc backend is running on localhost:8420, or toggle to mock data.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !dashboard) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '16px auto 12px' }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading fleet briefing…</p>
        </div>
      </div>
    );
  }

  const tiles = tilesFor(dashboard);

  const tileTargets: (string | undefined)[] = [
    '/submissions',
    '/submissions',
    '/code-signing',
    '/builds',
  ];

  return (
    <div>
      {/* Briefing — one-liner answering "what needs me?" */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body padded">
          {dashboard.allClear ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>All clear.</strong>{' '}
              Nothing awaiting review, no unresolved submissions, all certificates valid for at least 14 days.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>What needs you:</strong>{' '}
              {dashboard.submissionsWithIssues > 0 && (
                <>
                  <strong style={{ color: 'var(--danger-text)' }}>
                    {dashboard.submissionsWithIssues}
                  </strong>{' '}
                  submission{dashboard.submissionsWithIssues === 1 ? '' : 's'} with unresolved issues.{' '}
                </>
              )}
              {dashboard.submissionsAwaitingReview > 0 && (
                <>
                  <strong>{dashboard.submissionsAwaitingReview}</strong> awaiting Apple review.{' '}
                </>
              )}
              {dashboard.expiringCertificates.length > 0 && (
                <>
                  <strong>{dashboard.expiringCertificates.length}</strong> certificate
                  {dashboard.expiringCertificates.length === 1 ? '' : 's'} expiring within 14 days.
                </>
              )}
            </p>
          )}
          <p style={{
            margin: '8px 0 0', fontSize: 11,
            fontFamily: 'SF Mono, Menlo, monospace',
            color: 'var(--text-muted)', letterSpacing: '0.02em',
          }}>
            {currentApp
              ? <>Submissions scoped to <strong style={{ color: 'var(--text-secondary)' }}>{currentApp.name}</strong> <span style={{ opacity: 0.7 }}>({currentApp.bundleId})</span>. Builds &amp; certificates are fleet-wide.</>
              : <>No app pinned — submission tiles will show zero. Pin an app from the sidebar to scope them.</>
            }
          </p>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="dashboard-stats">
        {tiles.map((props, i) => (
          <StatCard
            key={props.label}
            {...props}
            onClick={tileTargets[i] ? () => navigate(tileTargets[i]!) : undefined}
          />
        ))}
      </div>

      {/* grid-2: expiring certs + recent builds */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Expiring certificates</span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => navigate('/code-signing')}
            >
              View all
            </button>
          </div>
          {dashboard.expiringCertificates.length === 0 ? (
            <div className="empty-state">
              <h3>All valid</h3>
              <p>No certificates expire in the next 14 days.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Expires</th>
                    <th>On</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.expiringCertificates.map((c) => (
                    <CertificateRow key={c.id} cert={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent builds</span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => navigate('/builds')}
            >
              View all
            </button>
          </div>
          {dashboard.recentBuilds.length === 0 ? (
            <div className="empty-state">
              <h3>No recent builds</h3>
              <p>Kick off an upload with <code>asc builds upload</code>.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Build</th>
                    <th>Version</th>
                    <th>Usable</th>
                    <th>Status</th>
                    <th>Expired</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentBuilds.map((b) => (
                    <BuildRow key={b.id} build={b} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default observer(DashboardPage);
