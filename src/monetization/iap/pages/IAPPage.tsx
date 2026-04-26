import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { iaps } from '../iapsInstance.ts';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { CreateIAPModal } from '../components/CreateIAPModal.tsx';
import { IAPDetail } from '../components/IAPDetail.tsx';

const STATUS_CLASS: Record<string, string> = {
  success: 'live',
  info: 'pending',
  warning: 'pending',
  danger: 'rejected',
  neutral: '',
};

function IAPRow({ iap }: { iap: InAppPurchase }) {
  const submit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await iap.submit(); }
    catch (err) { console.warn('[iap] submit failed:', err); }
  };
  const unsubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await iap.unsubmit(); }
    catch (err) { console.warn('[iap] unsubmit failed:', err); }
  };
  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!iap.canDelete) return;
    if (!window.confirm(`Delete "${iap.referenceName}"?`)) return;
    try { await iaps.remove(iap); }
    catch (err) { console.warn('[iap] delete failed:', err); }
  };

  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => iaps.select(iap)}>
      <td className="cell-primary">{iap.referenceName}</td>
      <td className="cell-mono">{iap.productId}</td>
      <td><span className="platform-badge">{iap.displayType}</span></td>
      <td>
        <span className={`status ${STATUS_CLASS[iap.statusTone]}`}>
          {iap.statusLabel}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          {iap.canSubmit && (
            <button className="btn btn-primary btn-sm" onClick={submit}>Submit</button>
          )}
          {iap.canUnsubmit && (
            <button className="btn btn-secondary btn-sm" onClick={unsubmit}>Cancel</button>
          )}
          {iap.canDelete && (
            <button className="btn btn-secondary btn-sm" onClick={remove}>Delete</button>
          )}
        </div>
      </td>
    </tr>
  );
}

const ObservedIAPRow = observer(IAPRow);

function IAPPage() {
  const [createOpen, setCreateOpen] = useState(false);

  if (!workspace.hydrated || !iaps.loaded) {
    return <div className="loading"><span className="spinner" /><span>Loading in-app purchases...</span></div>;
  }
  if (iaps.error) {
    return <div className="error">Error: {iaps.error.message}</div>;
  }

  // Detail mode — selected IAP takes over the page
  if (iaps.selectedIap) {
    return <IAPDetail iap={iaps.selectedIap} />;
  }

  const canCreate = !!workspace.currentApp;

  const showOnboarding = iaps.count === 0 && canCreate;

  return (
    <>
      {showOnboarding && (
        <div
          className="card"
          style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}
        >
          <div className="card-body">
            <h4 style={{ marginBottom: 4 }}>👋 Get started with In-App Purchases</h4>
            <p className="muted" style={{ marginBottom: 8 }}>
              Add your first IAP, then complete the four submit-readiness steps:
              localization, pricing, availability, and review screenshot.
            </p>
            <ol className="muted" style={{ paddingLeft: 20, marginBottom: 0 }}>
              <li>Create an IAP and pick its type.</li>
              <li>Add at least one localization with a display name.</li>
              <li>Set a base price — Apple equalises every territory.</li>
              <li>Submit for review.</li>
            </ol>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <h3>In-App Purchases</h3>
            <span className="muted" style={{ marginLeft: 8 }}>
              {iaps.count} total · {iaps.pendingCount} in review · {iaps.needsActionCount} need action
            </span>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreate}
              title={canCreate ? 'Create a new in-app purchase' : 'Pick an app first'}
            >
              + New IAP
            </button>
          </div>
        </div>
        {iaps.list.length === 0 ? (
          <div className="card-body"><span className="muted">No in-app purchases for this app yet.</span></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Reference Name</th>
                  <th>Product ID</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {iaps.list.map((iap) => (
                  <ObservedIAPRow key={iap.id} iap={iap} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateIAPModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export default observer(IAPPage);
