// Page: Iris (Private API)
import { DataProvider } from '../../../../shared/infrastructure/data-provider.js';
import { escapeHTML } from '../helpers.js';

export function renderIris() {
  return `
    <div class="toolbar" style="padding:0 0 16px;border:none">
      <div class="toolbar-left">
        <h3 style="margin:0;font-size:14px;color:var(--text-secondary)">Cookie-based authentication — auto-extracted from browser</h3>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-secondary" onclick="runAffordance('asc iris status --pretty')">Check Status</button>
        <button class="btn btn-primary" onclick="showIrisCreateModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create App
        </button>
      </div>
    </div>
    <div id="irisStatus" style="margin-bottom:16px"></div>
    <div id="irisApps">
      <div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div>
    </div>`;
}

export async function loadIris() {
  // Load status
  try {
    const status = await DataProvider.fetch('iris status');
    if (status?.data?.[0]) {
      const s = status.data[0];
      document.getElementById('irisStatus').innerHTML = `
        <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px">
          <div class="auth-dot" style="background:var(--success)"></div>
          <div>
            <strong>Iris session active</strong>
            <span style="color:var(--text-muted);margin-left:8px">source: ${escapeHTML(s.source)} · ${s.cookieCount} cookies</span>
          </div>
        </div>`;
    }
  } catch {
    document.getElementById('irisStatus').innerHTML = `
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px">
        <div class="auth-dot" style="background:var(--danger)"></div>
        <div>
          <strong>No iris session</strong>
          <span style="color:var(--text-muted);margin-left:8px">Log in to appstoreconnect.apple.com in your browser</span>
        </div>
      </div>`;
  }

  // Load apps
  try {
    const result = await DataProvider.fetch('iris apps list');
    if (result?.data) {
      renderIrisApps(result.data);
    }
  } catch {
    document.getElementById('irisApps').innerHTML = '<div class="empty-state">Could not load iris apps</div>';
  }
}

function renderIrisApps(apps) {
  document.getElementById('irisApps').innerHTML = apps.length ? `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Bundle ID</th><th>SKU</th><th>Platforms</th><th>ID</th>
      </tr></thead>
      <tbody>
        ${apps.map(app => `<tr>
          <td><strong>${escapeHTML(app.name)}</strong></td>
          <td class="cell-mono">${escapeHTML(app.bundleId)}</td>
          <td>${escapeHTML(app.sku || '-')}</td>
          <td>${(app.platforms || []).map(p => `<span class="platform-badge">${p}</span>`).join(' ')}</td>
          <td class="cell-mono">${app.id}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<div class="empty-state">No apps found. Create one with the button above.</div>';
}

window.showIrisCreateModal = function() {
  window.runAffordance('asc iris apps create --name "My App" --bundle-id com.example.app --sku MYSKU --pretty');
};
