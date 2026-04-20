import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../Dashboard.hooks.ts';
import { Dashboard } from '../Dashboard.ts';
import { BuildRow } from '../../build/components/BuildRow.tsx';
import type { Certificate } from '../../code-signing/Certificate.ts';

type Tone = 'urgent' | 'warn' | 'info' | 'calm';

interface TileProps {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  onClick?: () => void;
}

const TONE_STYLES: Record<Tone, { bg: string; fg: string; border: string }> = {
  urgent: { bg: 'rgba(220,38,38,0.08)',  fg: '#B91C1C', border: 'rgba(220,38,38,0.25)' },
  warn:   { bg: 'rgba(217,119,6,0.08)',  fg: '#B45309', border: 'rgba(217,119,6,0.25)' },
  info:   { bg: 'rgba(37,99,235,0.08)',  fg: '#1D4ED8', border: 'rgba(37,99,235,0.25)' },
  calm:   { bg: 'rgba(5,150,105,0.06)',  fg: '#047857', border: 'rgba(5,150,105,0.20)' },
};

function Tile({ label, value, hint, tone, onClick }: TileProps) {
  const s = TONE_STYLES[tone];
  return (
    <button
      className="stat-card"
      onClick={onClick}
      disabled={!onClick}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="stat-value" style={{ color: s.fg }}>{value}</div>
      <div className="stat-label" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>
    </button>
  );
}

function tilesFrom(dashboard: Dashboard) {
  const awaiting = dashboard.submissionsAwaitingReview;
  const issues = dashboard.submissionsWithIssues;
  const critical = dashboard.criticalCertificates.length;
  const warning = dashboard.warningCertificates.length;

  return [
    {
      key: 'issues',
      label: 'Unresolved submissions',
      value: issues === 0 ? '—' : String(issues),
      hint: issues === 0 ? 'Nothing rejected.' : `Need attention before resubmit.`,
      tone: (issues > 0 ? 'urgent' : 'calm') as Tone,
    },
    {
      key: 'awaiting',
      label: 'Awaiting Apple review',
      value: awaiting === 0 ? '—' : String(awaiting),
      hint: awaiting === 0 ? 'Nothing in the queue.' : 'In review or waiting for review.',
      tone: (awaiting > 0 ? 'warn' : 'calm') as Tone,
    },
    {
      key: 'certs',
      label: 'Certificates expiring',
      value: critical + warning === 0 ? '—' : String(critical + warning),
      hint: critical > 0
        ? `${critical} within 7 days.`
        : warning > 0
          ? `${warning} within 14 days.`
          : 'All valid for 14+ days.',
      tone: (critical > 0 ? 'urgent' : warning > 0 ? 'warn' : 'calm') as Tone,
    },
    {
      key: 'builds',
      label: 'Recent builds',
      value: String(dashboard.recentBuilds.length),
      hint: dashboard.recentBuilds.length === 0
        ? 'No builds uploaded recently.'
        : 'Across all apps, last 5.',
      tone: 'info' as Tone,
    },
  ];
}

function CertificateRow({ cert }: { cert: Certificate }) {
  const days = cert.daysUntilExpiration();
  const statusClass = cert.isExpiringCritical() ? 'rejected' : 'draft';
  return (
    <tr>
      <td className="cell-primary">{cert.name}</td>
      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
        {cert.certificateType}
      </td>
      <td><span className={`status ${statusClass}`}>
        {days <= 0 ? 'Expired today' : `${days} day${days === 1 ? '' : 's'}`}
      </span></td>
      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {cert.expirationDate.slice(0, 10)}
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const { dashboard, loading, error } = useDashboard();
  const navigate = useNavigate();

  if (loading || !dashboard) return <div className="spinner">Loading dashboard...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  const tiles = tilesFrom(dashboard);

  return (
    <div>
      <h2>Dashboard</h2>

      {/* Briefing — one-liner answering "what needs my attention?" */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        {dashboard.allClear ? (
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>All clear.</strong> Nothing awaiting review, no unresolved submissions, all certificates valid for at least 14 days.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>What needs you:</strong>{' '}
            {dashboard.submissionsWithIssues > 0 && (
              <span>
                <strong style={{ color: '#B91C1C' }}>{dashboard.submissionsWithIssues}</strong> submission
                {dashboard.submissionsWithIssues === 1 ? '' : 's'} with unresolved issues.{' '}
              </span>
            )}
            {dashboard.submissionsAwaitingReview > 0 && (
              <span>
                <strong>{dashboard.submissionsAwaitingReview}</strong> awaiting Apple review.{' '}
              </span>
            )}
            {dashboard.expiringCertificates.length > 0 && (
              <span>
                <strong>{dashboard.expiringCertificates.length}</strong> certificate
                {dashboard.expiringCertificates.length === 1 ? '' : 's'} expiring within 14 days.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Attention tiles */}
      <div className="dashboard-stats">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            label={t.label}
            value={t.value}
            hint={t.hint}
            tone={t.tone}
            onClick={
              t.key === 'issues' || t.key === 'awaiting'
                ? () => navigate('/submissions')
                : t.key === 'certs'
                  ? () => navigate('/code-signing')
                  : t.key === 'builds'
                    ? () => navigate('/builds')
                    : undefined
            }
          />
        ))}
      </div>

      {/* Two-column: expiring certs + recent builds */}
      <div className="grid-2">
        <div className="card">
          <h3>Expiring certificates</h3>
          {dashboard.expiringCertificates.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
              No certificates expiring in the next 14 days.
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
          <h3>Recent builds</h3>
          {dashboard.recentBuilds.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
              No recent build uploads. Kick off an archive or upload with <code>asc builds upload</code>.
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
