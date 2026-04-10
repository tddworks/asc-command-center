import { BetaGroup } from '../BetaGroup.ts';
import { AffordanceBar } from '../../shared/components/AffordanceBar.tsx';

interface Props {
  group: BetaGroup;
}

export function BetaGroupCard({ group }: Props) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{group.name}</h3>
        <span className={`badge ${group.isInternal ? 'badge-blue' : 'badge-green'}`}>
          {group.typeBadge}
        </span>
        {group.hasPublicLink && (
          <span className="badge badge-yellow">Public Link</span>
        )}
      </div>
      {group.hasPublicLink && (
        <p style={{ fontSize: '0.85em', color: 'var(--text-muted)', margin: '4px 0' }}>
          {group.publicLink}
        </p>
      )}
      <AffordanceBar affordances={group.affordances} />
    </div>
  );
}
