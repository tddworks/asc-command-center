import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { subscriptionGroups } from '../subscriptionGroupsInstance.ts';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import type { Subscription } from '../Subscription.ts';
import type { SubscriptionGroup } from '../SubscriptionGroup.ts';
import { CreateSubscriptionGroupModal } from '../components/CreateSubscriptionGroupModal.tsx';
import { CreateSubscriptionModal } from '../components/CreateSubscriptionModal.tsx';
import { GroupLocalizationsPanel } from '../components/GroupLocalizationsPanel.tsx';
import { SubscriptionDetail } from '../components/SubscriptionDetail.tsx';
import { StatPill } from '../../../shared/components/StatPill.tsx';

const STATUS_CLASS: Record<string, string> = {
  success: 'live',
  info: 'pending',
  warning: 'pending',
  danger: 'rejected',
  neutral: '',
};

function TierRow({
  sub, group, isFirst, isLast,
}: {
  sub: Subscription;
  group: SubscriptionGroup;
  isFirst: boolean;
  isLast: boolean;
}) {
  const move = async (direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = group.subscriptions.map((s) => s.id);
    const idx = ids.indexOf(sub.id);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    try { await group.reorderSubscriptions(ids); }
    catch (err) { console.warn('[subscription] reorder failed:', err); }
  };

  const submit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await sub.submit(); }
    catch (err) { console.warn('[subscription] submit failed:', err); }
  };
  const unsubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await sub.unsubmit(); }
    catch (err) { console.warn('[subscription] unsubmit failed:', err); }
  };
  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sub.canDelete) return;
    if (!window.confirm(`Delete tier "${sub.name}"?`)) return;
    try { await group.removeSubscription(sub); }
    catch (err) { console.warn('[subscription] delete failed:', err); }
  };

  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => subscriptionGroups.selectTier(sub)}>
      <td className="cell-primary">{sub.name}</td>
      <td className="cell-mono">{sub.productId}</td>
      <td>{sub.periodLabel}</td>
      <td>{sub.groupLevel ?? '—'}</td>
      <td>{sub.isFamilySharable ? 'Yes' : 'No'}</td>
      <td>
        <span className={`status ${STATUS_CLASS[sub.statusTone]}`}>{sub.statusLabel}</span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          {group.canReorderSubscriptions && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => move('up', e)}
                disabled={isFirst}
                title="Move up"
              >
                ↑
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => move('down', e)}
                disabled={isLast}
                title="Move down"
              >
                ↓
              </button>
            </>
          )}
          {sub.canSubmit && <button className="btn btn-primary btn-sm" onClick={submit}>Submit</button>}
          {sub.canUnsubmit && <button className="btn btn-secondary btn-sm" onClick={unsubmit}>Cancel</button>}
          {sub.canDelete && <button className="btn btn-secondary btn-sm" onClick={remove}>Delete</button>}
        </div>
      </td>
    </tr>
  );
}

const ObservedTierRow = observer(TierRow);

function GroupCard({
  group,
  onAddTier,
}: {
  group: SubscriptionGroup;
  onAddTier: (group: SubscriptionGroup) => void;
}) {
  const [locsOpen, setLocsOpen] = useState(false);
  const remove = async () => {
    if (!group.canDelete) return;
    if (!window.confirm(`Delete group "${group.referenceName}"?`)) return;
    try { await subscriptionGroups.remove(group); }
    catch (err) { console.warn('[subscription-group] delete failed:', err); }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="toolbar">
        <div className="toolbar-left" style={{ gap: 12 }}>
          <h3>{group.referenceName}</h3>
          <StatPill
            tone="neutral"
            count={group.tierCount}
            label={group.tierCount === 1 ? 'tier' : 'tiers'}
          />
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setLocsOpen((open) => !open)}
            disabled={!group.canViewGroupLocalizations}
            title={group.canViewGroupLocalizations ? 'Group localizations' : 'Backend does not expose localizations'}
          >
            {locsOpen ? 'Hide Localizations' : 'Localizations'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onAddTier(group)}
            disabled={!group.canCreateSubscription}
            title={group.canCreateSubscription ? 'Add a subscription tier' : 'Backend does not allow adding tiers'}
          >
            + Add Subscription
          </button>
          {group.canDelete && (
            <button className="btn btn-secondary btn-sm" onClick={remove}>Delete Group</button>
          )}
        </div>
      </div>
      {group.subscriptions.length === 0 ? (
        <div className="card-body"><span className="muted">No tiers yet.</span></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Product ID</th>
                <th>Period</th>
                <th>Level</th>
                <th>Family</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {group.subscriptions.map((sub, idx, arr) => (
                <ObservedTierRow
                  key={sub.id}
                  sub={sub}
                  group={group}
                  isFirst={idx === 0}
                  isLast={idx === arr.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {locsOpen && <GroupLocalizationsPanel group={group} />}
    </div>
  );
}

const ObservedGroupCard = observer(GroupCard);

function SubscriptionPage() {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [tierTarget, setTierTarget] = useState<SubscriptionGroup | null>(null);

  if (!workspace.hydrated || !subscriptionGroups.loaded) {
    return <div className="loading"><span className="spinner" /><span>Loading subscriptions...</span></div>;
  }
  if (subscriptionGroups.error) {
    return <div className="error">Error: {subscriptionGroups.error.message}</div>;
  }

  // Detail mode — selected tier takes over the page
  if (subscriptionGroups.selectedTier) {
    return <SubscriptionDetail sub={subscriptionGroups.selectedTier} />;
  }

  const canCreateGroup = !!workspace.currentApp;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <div className="toolbar-left" style={{ gap: 12 }}>
            <h3>Subscription Groups</h3>
            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatPill
                tone="neutral"
                count={subscriptionGroups.count}
                label={subscriptionGroups.count === 1 ? 'Group' : 'Groups'}
              />
              <StatPill
                tone="neutral"
                count={subscriptionGroups.totalTierCount}
                label={subscriptionGroups.totalTierCount === 1 ? 'Tier' : 'Tiers'}
              />
            </div>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCreateGroupOpen(true)}
              disabled={!canCreateGroup}
              title={canCreateGroup ? 'Create a new subscription group' : 'Pick an app first'}
            >
              + New Group
            </button>
          </div>
        </div>
      </div>

      {subscriptionGroups.list.length === 0 ? (
        <div className="card"><div className="card-body"><span className="muted">No subscription groups for this app.</span></div></div>
      ) : (
        subscriptionGroups.list.map((g) => (
          <ObservedGroupCard
            key={g.id}
            group={g}
            onAddTier={(group) => setTierTarget(group)}
          />
        ))
      )}

      <CreateSubscriptionGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
      />
      <CreateSubscriptionModal
        open={tierTarget !== null}
        group={tierTarget}
        onClose={() => setTierTarget(null)}
      />
    </>
  );
}

export default observer(SubscriptionPage);
