import { useState, useMemo } from 'react';
import { useSimulators } from '../Simulator.hooks.ts';
import type { Simulator } from '../Simulator.ts';
import { apiClient, useDataMode } from '../../shared/api-client.tsx';

type DeviceFilter = 'all' | 'iphone' | 'ipad';
type RuntimeFilter = 'latest' | 'all';

function SimRow({ sim }: { sim: Simulator }) {
  const mode = useDataMode();
  const dot = sim.isBooted ? 'var(--success)' : 'var(--text-muted)';

  const handleAction = async (_key: string, command: string) => {
    if (mode === 'mock') return;
    try {
      await apiClient.runCommand(command.replace(/^asc /, ''));
    } catch { /* ignore */ }
  };

  const actions = Object.entries(sim.affordances).filter(([k]) => k !== 'listSimulators');

  return (
    <tr>
      <td><strong>{sim.name}</strong></td>
      <td>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: dot, marginRight: 6, verticalAlign: 'middle' }} />
        {sim.state}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sim.displayRuntime}</td>
      <td style={{ textAlign: 'right' }}>
        {actions.map(([key, cmd]) => (
          <button
            key={key}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 4 }}
            onClick={() => handleAction(key, cmd)}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </td>
    </tr>
  );
}

function DeviceSection({ title, devices }: { title: string; devices: Simulator[] }) {
  if (devices.length === 0) return null;
  return (
    <>
      <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase' as const }}>{title}</div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
            <th>Runtime</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((s) => <SimRow key={s.udid} sim={s} />)}
        </tbody>
      </table>
    </>
  );
}

export default function SimulatorPage() {
  const { simulators, loading, error } = useSimulators();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DeviceFilter>('iphone');
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>('latest');

  const filtered = useMemo(() => {
    let devices = simulators;
    if (search) devices = devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter === 'iphone') devices = devices.filter((d) => /iphone/i.test(d.name));
    else if (typeFilter === 'ipad') devices = devices.filter((d) => /ipad/i.test(d.name));

    if (runtimeFilter === 'latest' && devices.length > 0) {
      const runtimes = [...new Set(devices.map((d) => d.displayRuntime || d.runtime))].sort().reverse();
      if (runtimes.length) devices = devices.filter((d) => (d.displayRuntime || d.runtime) === runtimes[0]);
    }
    return devices;
  }, [simulators, search, typeFilter, runtimeFilter]);

  const booted = filtered.filter((d) => d.isBooted);
  const available = filtered.filter((d) => !d.isBooted);
  const bootedCount = simulators.filter((d) => d.isBooted).length;

  if (loading) return <div className="spinner">Loading simulators...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      {/* Stat Cards */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
            </div>
            {bootedCount > 0 && <span className="stat-change up">Active</span>}
          </div>
          <div className="stat-value">{bootedCount}</div>
          <div className="stat-label">Booted</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
            </div>
          </div>
          <div className="stat-value">{simulators.length}</div>
          <div className="stat-label">Available</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
            </div>
            <span className="stat-change">Installed</span>
          </div>
          <div className="stat-value">Ready</div>
          <div className="stat-label">AXe Interaction</div>
        </div>
      </div>

      {/* Device List Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">iOS Simulators</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Search devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, width: 180, background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DeviceFilter)}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--bg)', color: 'var(--text-primary)' }}
            >
              <option value="all">All Devices</option>
              <option value="iphone">iPhones</option>
              <option value="ipad">iPads</option>
            </select>
            <select
              value={runtimeFilter}
              onChange={(e) => setRuntimeFilter(e.target.value as RuntimeFilter)}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--bg)', color: 'var(--text-primary)' }}
            >
              <option value="latest">Latest Runtime</option>
              <option value="all">All Runtimes</option>
            </select>
            <button className="btn btn-sm btn-secondary" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">No simulators found</div>
          ) : (
            <>
              <DeviceSection title="Running" devices={booted} />
              <DeviceSection title="Available" devices={available} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
