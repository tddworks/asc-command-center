export interface ProductTab {
  key: string;
  label: string;
}

interface Props {
  tabs: readonly ProductTab[];
  active: string;
  onChange(key: string): void;
}

/** Shared tab-strip used by IAP detail and Subscription detail pages. */
export function ProductTabBar({ tabs, active, onChange }: Props) {
  return (
    <div className="card" style={{ marginBottom: 12, padding: 0 }}>
      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 16px',
              cursor: 'pointer',
              color: active === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: active === t.key ? 600 : 500,
              borderBottom: active === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
