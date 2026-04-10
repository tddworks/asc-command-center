import { useParams } from 'react-router-dom';
import { useVersions } from '../Version.hooks.ts';
import { VersionBadge } from '../components/VersionBadge.tsx';
import { AffordanceBar } from '../../shared/components/AffordanceBar.tsx';

export default function VersionList() {
  const { appId } = useParams<{ appId: string }>();
  const { versions, loading, error } = useVersions(appId!);

  if (loading) return <div className="spinner">Loading versions...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>Versions</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Platform</th>
            <th>State</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td>{v.versionString}</td>
              <td>{v.platform}</td>
              <td><VersionBadge version={v} /></td>
              <td><AffordanceBar affordances={v.affordances} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
