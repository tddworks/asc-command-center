import { useParams } from 'react-router-dom';
import { useApp } from '../App.hooks.ts';
import { AffordanceBar } from '../../shared/components/AffordanceBar.tsx';

export default function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const { app, loading, error } = useApp(appId!);

  if (loading) return <div className="spinner">Loading app...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!app) return <div className="empty-state">App not found</div>;

  return (
    <div>
      <h2>{app.displayName}</h2>
      <dl>
        <dt>SKU</dt><dd>{app.sku}</dd>
        <dt>Locale</dt><dd>{app.primaryLocale}</dd>
        <dt>Bundle ID</dt><dd>{app.bundleId}</dd>
      </dl>
      <AffordanceBar affordances={app.affordances} />
    </div>
  );
}
