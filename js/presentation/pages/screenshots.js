// Page: Screenshots — Version → Platform → Locale → Device → Screenshots
import { DataProvider } from '../../../../shared/infrastructure/data-provider.js';
import { state } from '../state.js';
import { showToast } from '../toast.js';
import { escapeHTML } from '../helpers.js';

// Page-local state
let versions = [];
let selectedVersionId = null;
let selectedPlatform = 'all';
let localizations = [];
let activeLocaleIdx = 0;
let screenshotSets = {}; // localizationId → [sets]
let screenshots = {};    // setId → [screenshots]
let expandedSetId = null;

// --- Platform detection from display type ---

const platformForType = {
  APP_IPHONE_67: 'iphone', APP_IPHONE_65: 'iphone', APP_IPHONE_61: 'iphone',
  APP_IPHONE_58: 'iphone', APP_IPHONE_55: 'iphone', APP_IPHONE_47: 'iphone',
  APP_IPHONE_40: 'iphone', APP_IPHONE_35: 'iphone',
  APP_IPAD_PRO_129: 'ipad', APP_IPAD_PRO_3GEN_129: 'ipad', APP_IPAD_PRO_3GEN_11: 'ipad',
  APP_IPAD_105: 'ipad', APP_IPAD_97: 'ipad',
  APP_DESKTOP: 'mac',
  APP_APPLE_TV: 'tv',
  APP_APPLE_VISION_PRO: 'vision',
  APP_WATCH_SERIES_10: 'watch', APP_WATCH_SERIES_7: 'watch',
  APP_WATCH_SERIES_4: 'watch', APP_WATCH_SERIES_3: 'watch',
  IMESSAGE_APP_IPHONE_67: 'imessage', IMESSAGE_APP_IPHONE_65: 'imessage',
  IMESSAGE_APP_IPAD_PRO_129: 'imessage',
};

// Aspect ratio for screenshot thumbnails (width/height for CSS aspect-ratio)
const aspectRatioForType = {
  iphone: '9/19.5',     // portrait phone
  ipad: '3/4',          // portrait tablet
  mac: '16/10',         // landscape desktop
  tv: '16/9',           // landscape TV
  vision: '16/9',       // landscape vision
  watch: '9/11',        // near-square watch
  imessage: '9/19.5',   // same as phone
};

const platformLabels = {
  all: 'All',
  iphone: 'iPhone',
  ipad: 'iPad',
  mac: 'Mac',
  tv: 'Apple TV',
  vision: 'Vision Pro',
  watch: 'Watch',
  imessage: 'iMessage',
};

function getPlatform(displayType) {
  return platformForType[displayType] || 'iphone';
}

function getAspectRatio(displayType) {
  return aspectRatioForType[getPlatform(displayType)] || '9/19.5';
}

// Grid column width varies by platform — landscape screenshots need wider cards
function getGridMinWidth(displayType) {
  const p = getPlatform(displayType);
  if (p === 'mac' || p === 'tv' || p === 'vision') return '220px';
  if (p === 'ipad') return '150px';
  return '120px';
}

export function renderScreenshots() {
  const appName = state.selectedApp?.name || 'PhotoSync Pro';
  return `
    <div class="card mb-24">
      <div class="toolbar">
        <div class="toolbar-left">
          <span style="font-size:13px;color:var(--text-muted)">App:</span>
          <span style="font-size:13px;font-weight:600">${escapeHTML(appName)}</span>
        </div>
        <div class="toolbar-right">
          <label style="font-size:12px;color:var(--text-muted);margin-right:6px">Version:</label>
          <select id="ssVersionPicker" onchange="ssPickVersion(this.value)" style="font-size:13px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text-primary)">
            <option value="">Loading...</option>
          </select>
        </div>
      </div>
    </div>

    <div id="ssPlatformBar" style="display:none" class="mb-24">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="filter-group" id="ssPlatformTabs"></div>
        <div class="filter-group" id="ssLocaleTabs"></div>
      </div>
    </div>

    <div id="ssContent">
      <div class="card"><div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div></div>
    </div>

    <div class="card mt-24">
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

export async function loadScreenshots() {
  const appId = state.selectedApp?.id || '6449071230';
  const result = await DataProvider.fetch(`versions list --app-id ${appId}`);
  versions = result?.data || [];

  const picker = document.getElementById('ssVersionPicker');
  if (!picker) return;

  if (versions.length === 0) {
    picker.innerHTML = '<option value="">No versions</option>';
    document.getElementById('ssContent').innerHTML = '<div class="card"><div class="empty-state"><p style="color:var(--text-muted)">No versions found for this app.</p></div></div>';
    return;
  }

  const editable = versions.find(v => v.isEditable);
  const defaultV = editable || versions[0];
  selectedVersionId = defaultV.id;

  picker.innerHTML = versions.map(v =>
    `<option value="${v.id}" ${v.id === selectedVersionId ? 'selected' : ''}>${escapeHTML(v.versionString)} (${formatState(v.state)})</option>`
  ).join('');

  await loadLocalizationsForVersion(selectedVersionId);
}

async function loadLocalizationsForVersion(versionId) {
  activeLocaleIdx = 0;
  selectedPlatform = 'all';
  screenshotSets = {};
  screenshots = {};
  expandedSetId = null;

  document.getElementById('ssContent').innerHTML = '<div class="card"><div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div></div>';

  const result = await DataProvider.fetch(`version-localizations list --version-id ${versionId}`);
  localizations = result?.data || [];

  if (localizations.length === 0) {
    document.getElementById('ssPlatformBar').style.display = 'none';
    document.getElementById('ssContent').innerHTML = `<div class="card"><div class="empty-state"><p style="color:var(--text-muted)">No localizations found. Create one first.</p><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showToast('asc version-localizations create --version-id ${versionId} --locale en-US','info')">+ Add Localization</button></div></div>`;
    return;
  }

  // Fetch sets for first locale to discover available platforms
  const firstLoc = localizations[0];
  if (!screenshotSets[firstLoc.id]) {
    const setsResult = await DataProvider.fetch(`screenshot-sets list --localization-id ${firstLoc.id}`);
    screenshotSets[firstLoc.id] = setsResult?.data || [];
  }

  renderFilterBars();
  renderDeviceCards(firstLoc);
}

function renderFilterBars() {
  const barEl = document.getElementById('ssPlatformBar');
  barEl.style.display = '';

  // Discover platforms from all cached sets
  const allSets = Object.values(screenshotSets).flat();
  const platforms = new Set(allSets.map(s => getPlatform(s.screenshotDisplayType)));

  // Platform tabs — only show if more than 1 platform
  const platformTabsEl = document.getElementById('ssPlatformTabs');
  if (platforms.size > 1) {
    const tabs = [['all', 'All'], ...Array.from(platforms).map(p => [p, platformLabels[p] || p])];
    platformTabsEl.innerHTML = tabs.map(([key, label]) =>
      `<button class="filter-btn ${key === selectedPlatform ? 'active' : ''}" onclick="ssPickPlatform('${key}', this)">${label}</button>`
    ).join('');
  } else {
    platformTabsEl.innerHTML = '';
  }

  // Locale tabs
  const localeTabsEl = document.getElementById('ssLocaleTabs');
  localeTabsEl.innerHTML = localizations.map((loc, i) =>
    `<button class="filter-btn ${i === activeLocaleIdx ? 'active' : ''}" onclick="ssPickLocale(${i}, this)">${escapeHTML(loc.locale)}</button>`
  ).join('');
}

async function loadSetsForLocale(idx) {
  activeLocaleIdx = idx;
  expandedSetId = null;
  const loc = localizations[idx];
  if (!loc) return;

  document.getElementById('ssContent').innerHTML = '<div class="card"><div class="empty-state"><div class="spinner" style="margin:24px auto"></div></div></div>';

  if (!screenshotSets[loc.id]) {
    const result = await DataProvider.fetch(`screenshot-sets list --localization-id ${loc.id}`);
    screenshotSets[loc.id] = result?.data || [];
  }

  // Update platform tabs after loading new locale's sets
  renderFilterBars();
  renderDeviceCards(loc);
}

function renderDeviceCards(loc) {
  let sets = screenshotSets[loc.id] || [];

  // Filter by selected platform
  if (selectedPlatform !== 'all') {
    sets = sets.filter(s => getPlatform(s.screenshotDisplayType) === selectedPlatform);
  }

  if (sets.length === 0) {
    const allEmpty = (screenshotSets[loc.id] || []).length === 0;
    const msg = allEmpty
      ? `No screenshot sets for <strong>${escapeHTML(loc.locale)}</strong>.`
      : `No <strong>${platformLabels[selectedPlatform] || selectedPlatform}</strong> screenshot sets for <strong>${escapeHTML(loc.locale)}</strong>.`;
    document.getElementById('ssContent').innerHTML = `
      <div class="card">
        <div class="empty-state">
          <p style="color:var(--text-muted)">${msg}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showToast('asc screenshot-sets create --localization-id ${loc.id} --display-type APP_IPHONE_67','info')">+ New Screenshot Set</button>
        </div>
      </div>`;
    return;
  }

  document.getElementById('ssContent').innerHTML = sets.map(set => {
    const deviceName = formatDisplayType(set.screenshotDisplayType);
    const isExpanded = expandedSetId === set.id;
    const shotsList = screenshots[set.id];

    return `
      <div class="card mb-16">
        <div class="card-header" style="cursor:pointer" onclick="ssToggleSet('${set.id}')">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:18px">${deviceIcon(set.screenshotDisplayType)}</span>
            <div>
              <span class="card-title" style="font-size:14px">${escapeHTML(deviceName)}</span>
              <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${set.screenshotsCount} screenshot${set.screenshotsCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();showToast('asc screenshots upload --set-id ${set.id} --file screenshot.png','info')">Upload</button>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();showToast('asc screenshot-sets create --localization-id ${loc.id} --display-type ${set.screenshotDisplayType}','info')">+ New Set</button>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="transition:transform 0.2s;transform:rotate(${isExpanded ? '180' : '0'}deg)"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        ${isExpanded ? renderScreenshotGrid(set.id, set.screenshotDisplayType, shotsList) : ''}
      </div>`;
  }).join('') + `
    <div style="text-align:center;padding:8px 0">
      <button class="btn btn-sm btn-secondary" onclick="showToast('asc screenshot-sets create --localization-id ${loc.id} --display-type APP_IPHONE_67','info')">+ Add Device Type</button>
    </div>`;
}

function renderScreenshotGrid(setId, displayType, shotsList) {
  if (!shotsList) {
    return `<div class="card-body padded"><div class="spinner" style="margin:12px auto"></div></div>`;
  }

  if (shotsList.length === 0) {
    return `<div class="card-body padded"><p style="color:var(--text-muted);font-size:13px">No screenshots yet. Upload one to get started.</p></div>`;
  }

  const ratio = getAspectRatio(displayType);
  const minW = getGridMinWidth(displayType);

  return `
    <div class="card-body padded" style="padding-top:0">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${minW},1fr));gap:12px;margin-top:12px">
        ${shotsList.map(sc => {
          const sizeKB = Math.round(sc.fileSize / 1024);
          const dims = sc.imageWidth && sc.imageHeight ? `${sc.imageWidth}\u00d7${sc.imageHeight}` : '';
          const stateClass = sc.assetState === 'COMPLETE' ? 'live' : sc.assetState === 'AWAITING_UPLOAD' ? 'pending' : 'processing';
          const stateLabel = sc.assetState === 'COMPLETE' ? 'Ready' : sc.assetState === 'AWAITING_UPLOAD' ? 'Awaiting' : 'Processing';
          return `
            <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg)">
              <div style="aspect-ratio:${ratio};background:var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">
                ${dims || 'No preview'}
              </div>
              <div style="padding:8px">
                <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(sc.fileName)}">${escapeHTML(sc.fileName)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${sizeKB} KB${dims ? ' \u00b7 ' + dims : ''}</div>
                <div style="margin-top:4px"><span class="status ${stateClass}" style="font-size:10px">${stateLabel}</span></div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// --- Helpers ---

function formatState(s) {
  const map = {
    'READY_FOR_SALE': 'Live',
    'PREPARE_FOR_SUBMISSION': 'Preparing',
    'WAITING_FOR_REVIEW': 'Waiting',
    'IN_REVIEW': 'In Review',
    'REJECTED': 'Rejected',
  };
  return map[s] || s?.replace(/_/g, ' ') || 'Unknown';
}

function formatDisplayType(dt) {
  const map = {
    'APP_IPHONE_67': 'iPhone 6.7"',
    'APP_IPHONE_65': 'iPhone 6.5"',
    'APP_IPHONE_61': 'iPhone 6.1"',
    'APP_IPHONE_58': 'iPhone 5.8"',
    'APP_IPHONE_55': 'iPhone 5.5"',
    'APP_IPHONE_47': 'iPhone 4.7"',
    'APP_IPHONE_40': 'iPhone 4"',
    'APP_IPHONE_35': 'iPhone 3.5"',
    'APP_IPAD_PRO_129': 'iPad Pro 12.9"',
    'APP_IPAD_PRO_3GEN_129': 'iPad Pro 12.9" (3rd gen)',
    'APP_IPAD_PRO_3GEN_11': 'iPad Pro 11"',
    'APP_IPAD_105': 'iPad 10.5"',
    'APP_IPAD_97': 'iPad 9.7"',
    'APP_APPLE_TV': 'Apple TV',
    'APP_APPLE_VISION_PRO': 'Apple Vision Pro',
    'APP_WATCH_SERIES_10': 'Apple Watch Series 10',
    'APP_WATCH_SERIES_7': 'Apple Watch Series 7',
    'APP_WATCH_SERIES_4': 'Apple Watch Series 4',
    'APP_WATCH_SERIES_3': 'Apple Watch Series 3',
    'APP_DESKTOP': 'Mac Desktop',
  };
  return map[dt] || dt?.replace(/^APP_/, '').replace(/_/g, ' ') || dt;
}

function deviceIcon(dt) {
  if (dt?.includes('IPHONE') || dt?.includes('IMESSAGE')) return '\u{1F4F1}';
  if (dt?.includes('IPAD')) return '\u{1F4F1}';
  if (dt?.includes('WATCH')) return '\u231A';
  if (dt?.includes('TV')) return '\u{1F4FA}';
  if (dt?.includes('VISION')) return '\u{1F453}';
  if (dt?.includes('DESKTOP') || dt?.includes('MAC')) return '\u{1F5A5}';
  return '\u{1F4F7}';
}

// --- Global handlers ---

window.ssPickVersion = async function(versionId) {
  selectedVersionId = versionId;
  await loadLocalizationsForVersion(versionId);
};

window.ssPickPlatform = function(platform, btn) {
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPlatform = platform;
  expandedSetId = null;
  const loc = localizations[activeLocaleIdx];
  if (loc) renderDeviceCards(loc);
};

window.ssPickLocale = async function(idx, btn) {
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  await loadSetsForLocale(idx);
};

window.ssToggleSet = async function(setId) {
  if (expandedSetId === setId) {
    expandedSetId = null;
  } else {
    expandedSetId = setId;
    if (!screenshots[setId]) {
      const loc = localizations[activeLocaleIdx];
      renderDeviceCards(loc); // re-render with spinner
      const result = await DataProvider.fetch(`screenshots list --set-id ${setId}`);
      screenshots[setId] = result?.data || [];
    }
  }
  const loc = localizations[activeLocaleIdx];
  renderDeviceCards(loc);
};
