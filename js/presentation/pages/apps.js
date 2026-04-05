// Page: Apps
import { DataProvider } from '../../../../shared/infrastructure/data-provider.js';
import { enrichApp } from '../../../../shared/domain/enrichers.js';
import { state } from '../state.js';
import { showToast } from '../toast.js';
import { escapeHTML, appColors } from '../helpers.js';

export function renderApps() {
  return `
    <div class="toolbar" style="padding:0 0 16px;border:none">
      <div class="toolbar-left">
        <div class="search-box" style="width:320px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Filter apps..." oninput="filterApps(this.value)"/>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" onclick="showToast('Run: asc apps create','info')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New App</button>
      </div>
    </div>
    <div class="grid-3" id="appsGrid">
      <div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div>
    </div>`;
}

function getAppColor(i) { return appColors[i % appColors.length]; }

export async function loadApps() {
  // Prefer REST API (in-process, HATEOAS links) over CLI bridge (subprocess)
  const result = DataProvider._mode === 'rest'
    ? await DataProvider.get('/api/v1/apps')
    : await DataProvider.fetch('apps list');
  if (result?.data) {
    state.apps = result.data.map(app => enrichApp(app));
    renderAppCards(state.apps);
  }
}

function renderAppCards(apps) {
  document.getElementById('appsGrid').innerHTML = apps.length ? apps.map((app, i) => `
    <div class="app-card" onclick="selectApp('${app.id}')">
      <div class="app-card-top">
        <div class="app-icon" style="background:${getAppColor(i)}">${(app.displayName || app.name)[0]}</div>
        <div class="app-card-info">
          <div class="app-card-name">${escapeHTML(app.displayName || app.name)}</div>
          <div class="app-card-bundle">${escapeHTML(app.bundleId)}</div>
        </div>
      </div>
      <div class="app-card-meta">
        ${app.primaryLocale ? `<span class="app-meta-item">${app.primaryLocale}</span>` : ''}
        <span class="app-meta-item" style="margin-left:auto"><span class="cell-mono">${app.id}</span></span>
      </div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
        ${Object.entries(app.affordances || {}).filter(([k]) => !k.startsWith('list')).map(([key, value]) => {
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          // REST mode: value is {href, method}. CLI mode: value is command string.
          const cmdStr = typeof value === 'object' ? JSON.stringify(value) : value;
          return `<button class="btn btn-sm btn-secondary" style="font-size:10px;padding:2px 8px" onclick="event.stopPropagation();appAffordance('${escapeHTML(key)}','${app.id}','${escapeHTML(app.name || '')}','${escapeHTML(cmdStr)}')">${escapeHTML(label)}</button>`;
        }).join('')}
      </div>
    </div>`).join('') : '<div class="empty-state"><h3>No apps found</h3><p>Run <code>asc apps list</code> to fetch your apps</p></div>';
}

function filterApps(q) {
  const filtered = state.apps.filter(a =>
    a.name.toLowerCase().includes(q.toLowerCase()) ||
    a.bundleId.toLowerCase().includes(q.toLowerCase())
  );
  renderAppCards(filtered);
}

function selectApp(id, navigateToVersions = true) {
  state.selectedApp = state.apps.find(a => a.id === id);
  updateAppNav();
  if (navigateToVersions) {
    showToast(`Selected: ${state.selectedApp?.name}`, 'success');
    // navigate is on window
    window.navigate('versions');
  }
}

function updateAppNav() {
  const app = state.selectedApp;
  const icon = document.getElementById('navAppIcon');
  const name = document.getElementById('navAppName');
  const bundle = document.getElementById('navAppBundle');
  if (app) {
    const idx = state.apps.indexOf(app);
    icon.textContent = (app.name || '?')[0];
    icon.style.background = appColors[(idx >= 0 ? idx : 0) % appColors.length];
    name.textContent = app.name || app.displayName || 'App';
    bundle.textContent = app.bundleId || '';
    bundle.style.display = '';
  } else {
    icon.textContent = '?';
    icon.style.background = 'var(--text-muted)';
    name.textContent = 'Apps';
    bundle.textContent = '';
    bundle.style.display = 'none';
  }
}

export async function loadAppsForSelector() {
  const result = DataProvider._mode === 'rest'
    ? await DataProvider.get('/api/v1/apps')
    : await DataProvider.fetch('apps list');
  if (result?.data) {
    state.apps = result.data.map(app => enrichApp(app));
    if (state.apps.length && !state.selectedApp) {
      state.selectedApp = state.apps[0];
    }
    updateAppNav();
  }
}

// --- Affordance Handler Registry (plugins extend this) ---

window.appAffordanceHandlers = window.appAffordanceHandlers || {};

window.appAffordance = function (key, id, name, cmdOrLink) {
  const handler = window.appAffordanceHandlers[key];
  if (handler) {
    handler(id, name, cmdOrLink);
  } else {
    // Try to parse as REST link first
    let link = null;
    try { link = JSON.parse(cmdOrLink); } catch {}
    if (link?.href) {
      // REST mode: follow the HATEOAS link
      showToast(`Following: ${link.method} ${link.href}...`, 'info');
      DataProvider.follow(link)
        .then(result => {
          if (result) showToast(`${key} succeeded`, 'success');
        })
        .catch(() => showToast(`${key} failed`, 'error'));
    } else {
      // CLI mode: execute command
      showToast(`Running: ${cmdOrLink}...`, 'info');
      DataProvider.fetch(cmdOrLink.replace(/^asc\s+/, ''))
        .then(() => showToast(`${key} succeeded`, 'success'))
        .catch(() => showToast(`${key} failed`, 'error'));
    }
  }
};

// Expose to window for inline onclick
window.selectApp = selectApp;
window.filterApps = filterApps;
