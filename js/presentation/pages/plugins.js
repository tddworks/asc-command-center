// Page: Plugins — installed plugins + marketplace
import { DataProvider } from '../../../../shared/infrastructure/data-provider.js';
import { showToast } from '../toast.js';
import { escapeHTML, appColors } from '../helpers.js';

let activeTab = 'installed';

const pluginColors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#4F46E5','#EA580C'];

export function renderPlugins() {
  return `
    <div style="display:flex;gap:12px;margin-bottom:20px" id="pluginStats"></div>
    <div class="card">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="filter-group">
            <button class="filter-btn active" id="tabInstalled" onclick="switchPluginTab('installed')">Installed</button>
            <button class="filter-btn" id="tabMarket" onclick="switchPluginTab('market')">Marketplace</button>
          </div>
        </div>
        <div class="toolbar-right">
          <input class="form-input" type="text" placeholder="Search plugins..." id="pluginSearch" style="width:200px;height:32px;font-size:12px" oninput="filterPlugins(this.value)"/>
        </div>
      </div>
      <div id="pluginsContent">
        <div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div>
      </div>
    </div>`;
}

export async function loadPlugins() {
  activeTab = 'installed';
  window.switchPluginTab = switchTab;
  window.filterPlugins = filterPlugins;
  window.installPlugin = installPlugin;
  window.uninstallPlugin = uninstallPlugin;

  // Load both counts for stats
  const [installed, market] = await Promise.all([
    DataProvider.fetch('plugins list --pretty'),
    DataProvider.fetch('plugins market list --pretty'),
  ]);
  const installedCount = installed?.data?.length || 0;
  const availableCount = market?.data?.length || 0;

  document.getElementById('pluginStats').innerHTML = `
    <div class="stat-card" style="flex:1">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:10px;background:var(--primary);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="20" height="20"><path d="M12 2v6m0 0l3-3m-3 3l-3-3"/><rect x="4" y="8" width="16" height="14" rx="2"/><path d="M9 15h6"/></svg>
        </div>
        <div>
          <div style="font-size:24px;font-weight:700;line-height:1">${installedCount}</div>
          <div style="font-size:11px;color:var(--text-muted)">Installed</div>
        </div>
      </div>
    </div>
    <div class="stat-card" style="flex:1">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:10px;background:var(--success);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div>
          <div style="font-size:24px;font-weight:700;line-height:1">${availableCount}</div>
          <div style="font-size:11px;color:var(--text-muted)">Available</div>
        </div>
      </div>
    </div>`;

  renderInstalledCards(installed?.data || []);
}

async function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tabInstalled').classList.toggle('active', tab === 'installed');
  document.getElementById('tabMarket').classList.toggle('active', tab === 'market');
  document.getElementById('pluginSearch').value = '';
  document.getElementById('pluginsContent').innerHTML = `<div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div>`;
  if (tab === 'installed') {
    const result = await DataProvider.fetch('plugins list --pretty');
    renderInstalledCards(result?.data || []);
  } else {
    const result = await DataProvider.fetch('plugins market list --pretty');
    renderMarketCards(result?.data || []);
  }
}

function renderInstalledCards(plugins) {
  const el = document.getElementById('pluginsContent');
  if (!plugins.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" width="48" height="48" style="margin-bottom:12px"><path d="M12 2v6m0 0l3-3m-3 3l-3-3"/><rect x="4" y="8" width="16" height="14" rx="2"/><path d="M9 15h6"/></svg>
      <p style="color:var(--text-muted);margin:0 0 12px">No plugins installed</p>
      <button class="btn btn-sm btn-primary" onclick="switchPluginTab('market')">Browse Marketplace</button>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="grid-3" style="padding:16px">${plugins.map((p, i) => pluginCard(p, i)).join('')}</div>`;
}

function renderMarketCards(plugins) {
  const el = document.getElementById('pluginsContent');
  if (!plugins.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px">
      <p style="color:var(--text-muted)">No plugins available in the marketplace</p>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="grid-3" style="padding:16px">${plugins.map((p, i) => pluginCard(p, i)).join('')}</div>`;
}

function pluginCard(p, i) {
  const name = escapeHTML(p.name || p.id);
  const version = escapeHTML(p.version || '');
  const desc = escapeHTML(p.description || '');
  const author = p.author ? escapeHTML(p.author) : '';
  const color = pluginColors[i % pluginColors.length];
  const initial = (p.name || p.id).charAt(0).toUpperCase();
  const cats = (p.categories || []).map(c => `<span class="platform-badge">${escapeHTML(c)}</span>`).join(' ');
  const installed = p.isInstalled;

  const action = installed
    ? `<button class="btn btn-sm btn-secondary" style="font-size:10px;color:var(--danger);border-color:var(--danger)" onclick="uninstallPlugin('${escapeHTML(p.slug || p.id)}')">Uninstall</button>`
    : `<button class="btn btn-sm btn-primary" onclick="installPlugin('${escapeHTML(p.id)}')">Install</button>`;

  const repoLink = p.repositoryURL
    ? `<a href="${escapeHTML(p.repositoryURL)}" target="_blank" rel="noopener" style="color:var(--text-muted);font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:3px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Repository
      </a>`
    : '';

  return `<div class="app-card" style="cursor:default;display:flex;flex-direction:column">
    <div class="app-card-top" style="margin-bottom:8px">
      <div class="app-icon" style="background:${color};width:44px;height:44px;font-size:18px;border-radius:10px">${initial}</div>
      <div class="app-card-info" style="flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="app-card-name">${name}</div>
          ${action}
        </div>
        <div class="app-card-bundle">${version}${author ? ' · ' + author : ''}</div>
      </div>
    </div>
    ${desc ? `<div style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:auto;flex:1">${desc}</div>` : '<div style="flex:1"></div>'}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="display:flex;gap:4px;flex-wrap:wrap">${cats}</div>
      ${repoLink}
    </div>
  </div>`;
}

async function refreshAll() {
  // Refresh stats + current tab
  const [installed, market] = await Promise.all([
    DataProvider.fetch('plugins list --pretty'),
    DataProvider.fetch('plugins market list --pretty'),
  ]);
  const installedCount = installed?.data?.length || 0;
  const availableCount = market?.data?.length || 0;
  const statsEl = document.getElementById('pluginStats');
  if (statsEl) {
    statsEl.querySelectorAll('div[style*="font-size:24px"]').forEach((el, i) => {
      el.textContent = i === 0 ? installedCount : availableCount;
    });
  }
  if (activeTab === 'installed') renderInstalledCards(installed?.data || []);
  else renderMarketCards(market?.data || []);
}

function setButtonLoading(btn, label) {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px"><span class="spinner" style="width:12px;height:12px;border-width:2px;margin:0"></span>${label}</span>`;
}

function resetButton(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = btn.dataset.originalText || 'Install';
}

async function installPlugin(name) {
  const btn = event?.target?.closest('button');
  setButtonLoading(btn, 'Installing...');
  try {
    await DataProvider.fetch(`plugins install --name ${name} --pretty`);
    showToast(`${name} installed successfully`, 'success');
  } catch {
    showToast(`Failed to install ${name}`, 'error');
  }
  await refreshAll();
}

async function uninstallPlugin(name) {
  const btn = event?.target?.closest('button');
  setButtonLoading(btn, 'Removing...');
  try {
    await DataProvider.fetch(`plugins uninstall --name ${name}`);
    showToast(`${name} uninstalled`, 'success');
  } catch {
    showToast(`Failed to uninstall ${name}`, 'error');
  }
  await refreshAll();
}

function filterPlugins(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#pluginsContent .app-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}
