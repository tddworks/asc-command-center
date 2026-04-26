import { observer } from 'mobx-react-lite';
import { iaps } from '../iapsInstance.ts';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import type { InAppPurchase } from '../InAppPurchase.ts';

const STATUS_CLASS: Record<string, string> = {
  success: 'live',
  info: 'pending',
  warning: 'pending',
  danger: 'rejected',
  neutral: '',
};

function IAPRow({ iap }: { iap: InAppPurchase }) {
  const submit = async () => {
    try { await iap.submit(); }
    catch (err) { console.warn('[iap] submit failed:', err); }
  };
  const unsubmit = async () => {
    try { await iap.unsubmit(); }
    catch (err) { console.warn('[iap] unsubmit failed:', err); }
  };
  const remove = async () => {
    if (!iap.canDelete) return;
    if (!window.confirm(`Delete "${iap.referenceName}"?`)) return;
    try { await iaps.remove(iap); }
    catch (err) { console.warn('[iap] delete failed:', err); }
  };

  return (
    <tr>
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
  if (!workspace.hydrated || !iaps.loaded) {
    return <div className="loading"><span className="spinner" /><span>Loading in-app purchases...</span></div>;
  }
  if (iaps.error) {
    return <div className="error">Error: {iaps.error.message}</div>;
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>In-App Purchases</h3>
          <span className="muted" style={{ marginLeft: 8 }}>
            {iaps.count} total · {iaps.pendingCount} in review · {iaps.needsActionCount} need action
          </span>
        </div>
      </div>
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
    </div>
  );
}

export default observer(IAPPage);
