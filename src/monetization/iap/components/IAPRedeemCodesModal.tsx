import { useEffect, useMemo, useState } from 'react';

interface Props {
  /** CSV string returned by `InAppPurchaseOfferCode.downloadCodes`. Each
   *  line is either a bare code or `<code>,<redemption-url>`. */
  codes: string | null;
  /** Reference name of the offer code — used in the modal title and the
   *  filename when the user downloads the CSV. */
  offerCodeName: string;
  onClose: () => void;
}

/**
 * Read-only sheet that renders codes the user just generated, mirroring
 * iOS's `iOSIAPRedeemCodesSheet`. Offers two takeaways: copy to clipboard
 * (whole CSV) or download as a `.csv` file.
 */
export function IAPRedeemCodesModal({ codes, offerCodeName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!codes) return;
    setCopied(false);
  }, [codes]);

  const stats = useMemo(() => {
    if (!codes) return { total: 0, withUrl: 0 };
    const lines = codes.split('\n').filter((l) => l.length > 0);
    const withUrl = lines.filter((l) => l.includes(',https://')).length;
    return { total: lines.length, withUrl };
  }, [codes]);

  if (!codes) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[iap-offer-code] copy CSV failed:', err);
    }
  };

  const download = () => {
    const blob = new Blob([codes], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = offerCodeName.replace(/[^A-Za-z0-9_-]/g, '_') || 'offer-codes';
    a.href = url;
    a.download = `${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Codes for {offerCodeName}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {stats.total.toLocaleString('en-US')} code{stats.total === 1 ? '' : 's'}
            {stats.withUrl > 0 && ` · ${stats.withUrl.toLocaleString('en-US')} with redemption URLs`}
          </div>

          <textarea
            className="form-input"
            readOnly
            value={codes}
            spellCheck={false}
            style={{
              minHeight: 280,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              whiteSpace: 'pre',
              resize: 'vertical',
            }}
            onFocus={(e) => e.currentTarget.select()}
          />

          <div className="form-hint">
            Each line is one redeemable code. When a redemption URL is included,
            users can tap it to redeem directly in the App Store. Treat this list
            as sensitive — once shared, codes can be redeemed by anyone.
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>
          <button type="button" className="btn btn-secondary" onClick={copy}>
            {copied ? 'Copied!' : 'Copy CSV'}
          </button>
          <button type="button" className="btn btn-primary" onClick={download}>
            Download .csv
          </button>
        </div>
      </div>
    </div>
  );
}
