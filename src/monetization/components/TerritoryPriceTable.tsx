import type { TerritoryPriceLike } from './LocalizableProduct.ts';
import { territoryFlag } from '../../shared/territoryDirectory.ts';

interface Props<P extends TerritoryPriceLike> {
  prices: P[];
  /** Territory id to highlight with the `highlightLabel` badge (e.g. the IAP
   *  base territory). Subscriptions don't have a base territory and pass
   *  `undefined`. */
  highlightTerritoryId?: string;
  /** Badge text shown alongside the highlighted row (e.g. "BASE"). */
  highlightLabel?: string;
}

/**
 * Shared territory pricing table used by IAP + Subscription pricing tabs.
 * Mirrors iOS's `TappableTerritoryPriceList` molecule: flag + display name
 * (with optional highlight badge) + ISO id + currency + formatted price.
 */
export function TerritoryPriceTable<P extends TerritoryPriceLike>({
  prices,
  highlightTerritoryId,
  highlightLabel,
}: Props<P>) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Territory</th>
            <th>ID</th>
            <th>Currency</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {prices.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 16 }}>
                No matching territories.
              </td>
            </tr>
          ) : (
            prices.map((p) => {
              const flag = territoryFlag(p.territoryId);
              const isHighlighted = p.territoryId === highlightTerritoryId;
              return (
                <tr key={p.territoryId}>
                  <td className="cell-primary">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {flag && (
                        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{flag}</span>
                      )}
                      <span>{p.territoryName}</span>
                      {isHighlighted && highlightLabel && (
                        <span className="platform-badge" style={{ marginLeft: 2 }}>{highlightLabel}</span>
                      )}
                    </span>
                  </td>
                  <td className="cell-mono">{p.territoryId}</td>
                  <td>{p.currency}</td>
                  <td>{p.formattedPrice}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
