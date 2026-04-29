import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { iaps } from '../iapsInstance.ts';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { CreateIAPModal } from '../components/CreateIAPModal.tsx';
import { IAPDetail } from '../components/IAPDetail.tsx';
import { StatPill } from '../../../shared/components/StatPill.tsx';

const STATUS_CLASS: Record<string, string> = {
  success: 'live',
  info: 'pending',
  warning: 'pending',
  danger: 'rejected',
  neutral: '',
};

function IAPRow({ iap }: { iap: InAppPurchase }) {
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

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left" style={{ gap: 12 }}>
            <h3>In-App Purchases</h3>
            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatPill tone="neutral" count={iaps.count} label={iaps.count === 1 ? 'IAP' : 'IAPs'} />
              {iaps.pendingCount > 0 && (
                <StatPill tone="info" count={iaps.pendingCount} label="In Review" />
              )}
              {iaps.needsActionCount > 0 && (
                <StatPill tone="warning" count={iaps.needsActionCount} label="Needs Action" />
              )}
            </div>
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
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <h3>No in-app purchases yet</h3>
            <p>
              Add your first IAP, then complete localization, pricing, availability, and a review screenshot before submitting.
            </p>
            <ol
              className="muted"
              style={{
                textAlign: 'left',
                display: 'inline-block',
                margin: '0 auto 16px',
                paddingLeft: 20,
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              <li>Create an IAP and pick its type.</li>
              <li>Add at least one localization with a display name.</li>
              <li>Set a base price — Apple equalises every territory.</li>
              <li>Submit for review.</li>
            </ol>
            <div>
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
