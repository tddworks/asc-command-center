// Page: Screenshots
import { showToast } from '../toast.js';

export function renderScreenshots() {
  return `
    <div class="card mb-24">
      <div class="card-header">
        <span class="card-title">Screenshot Sets</span>
        <button class="btn btn-sm btn-primary" onclick="showToast('asc screenshot-sets create','info')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Set</button>
      </div>
      <div class="table-wrapper">
        <table><thead><tr><th>Display Type</th><th>Locale</th><th>Count</th><th style="text-align:right">Actions</th></tr></thead><tbody>
          <tr><td><span class="cell-primary">IPHONE_67</span></td><td>en-US</td><td>6</td><td class="text-right"><button class="btn btn-sm btn-secondary">View</button> <button class="btn btn-sm btn-secondary">Upload</button></td></tr>
          <tr><td><span class="cell-primary">IPHONE_65</span></td><td>en-US</td><td>6</td><td class="text-right"><button class="btn btn-sm btn-secondary">View</button> <button class="btn btn-sm btn-secondary">Upload</button></td></tr>
          <tr><td><span class="cell-primary">IPAD_PRO_129</span></td><td>en-US</td><td>4</td><td class="text-right"><button class="btn btn-sm btn-secondary">View</button> <button class="btn btn-sm btn-secondary">Upload</button></td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">AI Screenshot Generation</span>
      </div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Generate marketing screenshots with AI using <code>asc app-shots</code></p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="showToast('asc app-shots generate --plan plan.json','info')">Generate</button>
          <button class="btn btn-secondary" onclick="showToast('asc app-shots translate --to zh --to ja','info')">Translate</button>
          <button class="btn btn-secondary" onclick="showToast('asc app-shots html --plan plan.json','info')">HTML Export</button>
        </div>
      </div>
    </div>`;
}
