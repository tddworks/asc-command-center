import { useState } from 'react';
import { useCertificates, useBundleIds, useProfiles, useDevices } from '../CodeSigning.hooks.ts';
import { AffordanceBar } from '../../shared/components/AffordanceBar.tsx';

type Tab = 'bundleIds' | 'certificates' | 'devices' | 'profiles';

const TAB_LABELS: Record<Tab, string> = {
  bundleIds: 'Bundle IDs',
  certificates: 'Certificates',
  devices: 'Devices',
  profiles: 'Profiles',
};

export default function CodeSigningPage() {
  const [tab, setTab] = useState<Tab>('certificates');

  return (
    <div>
      <h2>Code Signing</h2>
      <div className="filter-bar" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            className={`affordance-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={tab === t ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {tab === 'certificates' && <CertificatesTab />}
      {tab === 'bundleIds' && <BundleIdsTab />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'profiles' && <ProfilesTab />}
    </div>
  );
}

function CertificatesTab() {
  const { certificates, loading, error } = useCertificates();
  if (loading) return <div className="spinner">Loading certificates...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Serial</th>
          <th>Status</th>
          <th>Expires</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {certificates.map((c) => (
          <tr key={c.id}>
            <td>{c.name}</td>
            <td>{c.certificateType}</td>
            <td><code>{c.serialNumber}</code></td>
            <td>{c.status}</td>
            <td>{c.expirationDate}</td>
            <td><AffordanceBar affordances={c.affordances} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BundleIdsTab() {
  const { bundleIds, loading, error } = useBundleIds();
  if (loading) return <div className="spinner">Loading bundle IDs...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Identifier</th>
          <th>Platform</th>
          <th>Seed ID</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {bundleIds.map((b) => (
          <tr key={b.id}>
            <td>{b.name}</td>
            <td><code>{b.identifier}</code></td>
            <td>{b.platform}</td>
            <td>{b.seedId}</td>
            <td><AffordanceBar affordances={b.affordances} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DevicesTab() {
  const { devices, loading, error } = useDevices();
  if (loading) return <div className="spinner">Loading devices...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>UDID</th>
          <th>Class</th>
          <th>Model</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {devices.map((d) => (
          <tr key={d.id}>
            <td>{d.name}</td>
            <td><code>{d.udid}</code></td>
            <td>{d.deviceClass}</td>
            <td>{d.model}</td>
            <td>{d.status}</td>
            <td><AffordanceBar affordances={d.affordances} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProfilesTab() {
  const { profiles, loading, error } = useProfiles();
  if (loading) return <div className="spinner">Loading profiles...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>State</th>
          <th>Expires</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {profiles.map((p) => (
          <tr key={p.id}>
            <td>{p.name}</td>
            <td>{p.profileType}</td>
            <td>{p.profileState}</td>
            <td>{p.expirationDate}</td>
            <td><AffordanceBar affordances={p.affordances} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
