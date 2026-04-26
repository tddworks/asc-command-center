import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { subscriptionGroups } from '../subscriptionGroupsInstance.ts';
import { SubscriptionAvailabilityTab } from './SubscriptionAvailabilityTab.tsx';
import { SubscriptionLocalizationsTab } from './SubscriptionLocalizationsTab.tsx';
import { SubscriptionOffersTab } from './SubscriptionOffersTab.tsx';
import { SubscriptionPricingTab } from './SubscriptionPricingTab.tsx';
import { SubscriptionReviewTab } from './SubscriptionReviewTab.tsx';
import { InlineRename } from '../../../shared/components/InlineRename.tsx';

const STATUS_CLASS: Record<string, string> = {
  success: 'live',
  info: 'pending',
  warning: 'pending',
  danger: 'rejected',
  neutral: '',
};

type TabKey = 'localizations' | 'pricing' | 'availability' | 'review' | 'offers';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'localizations', label: 'Localizations' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'availability', label: 'Availability' },
  { key: 'review', label: 'Review' },
  { key: 'offers', label: 'Offers' },
];

interface Props {
  sub: Subscription;
}

function SubscriptionDetailImpl({ sub }: Props) {
  const [tab, setTab] = useState<TabKey>('localizations');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (sub.isLocalizationsLoaded) return;
    void sub.loadLocalizations().catch((err) => {
      console.warn('[subscription] loadLocalizations failed:', err);
    });
  }, [sub]);

  const back = () => subscriptionGroups.clearSelection();

  const submit = async () => {
    setSubmitError(null);
    try { await sub.submit(); }
    catch (err) { setSubmitError((err as Error).message); }
  };
  const unsubmit = async () => {
    setSubmitError(null);
    try { await sub.unsubmit(); }
    catch (err) { setSubmitError((err as Error).message); }
  };

  return (
    <div>
      {/* Sticky header */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar" style={{ alignItems: 'flex-start' }}>
          <div className="toolbar-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={back} style={{ marginBottom: 4 }}>
              ← Back to subscriptions
            </button>
            <InlineRename
              value={sub.name}
              canEdit={sub.canUpdate}
              onSave={(next) => sub.update({ name: next })}
              placeholder="Display name"
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="cell-mono">{sub.productId}</span>
              <span className="platform-badge">{sub.periodLabel}</span>
              {sub.isFamilySharable && <span className="platform-badge">Family</span>}
              <span className={`status ${STATUS_CLASS[sub.statusTone]}`}>{sub.statusLabel}</span>
            </div>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
            {sub.canSubmit && (
              <button type="button" className="btn btn-primary btn-sm" onClick={submit}>Submit for Review</button>
            )}
            {sub.canUnsubmit && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={unsubmit}>Cancel Submission</button>
            )}
          </div>
        </div>
        {submitError && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{submitError}</span>
          </div>
        )}
        {sub.canSubmit && !sub.hasAnyCompleteLocalization && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="form-hint" style={{ color: 'var(--danger-text)' }}>
              Add at least one localization with a display name before submitting for review.
            </span>
          </div>
        )}
      </div>

      {/* Needs-action banner — only when the tier needs developer action.
          ReadyToSubmit is a "click Submit" state, not a "fix something"
          state, so the banner stays hidden. */}
      {sub.needsAttention && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderLeft: '3px solid var(--warning-bg, #f59e0b)',
          }}
        >
          <div className="card-body">
            <strong>{sub.statusLabel}</strong>
            <span className="muted" style={{ marginLeft: 8 }}>
              Add a localization with a display name and set a price before submitting for review.
            </span>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="card" style={{ marginBottom: 12, padding: 0 }}>
        <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'transparent', border: 'none',
                padding: '10px 16px', cursor: 'pointer',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: tab === t.key ? 600 : 500,
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      {tab === 'localizations' && <SubscriptionLocalizationsTab sub={sub} />}
      {tab === 'pricing' && <SubscriptionPricingTab sub={sub} />}
      {tab === 'availability' && <SubscriptionAvailabilityTab sub={sub} />}
      {tab === 'review' && <SubscriptionReviewTab sub={sub} />}
      {tab === 'offers' && <SubscriptionOffersTab sub={sub} />}
    </div>
  );
}

export const SubscriptionDetail = observer(SubscriptionDetailImpl);
