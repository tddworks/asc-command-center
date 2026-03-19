// Presentation: App state + command log
import { escapeHTML } from './helpers.js';

export const state = {
  currentPage: 'dashboard',
  apps: [],
  versions: [],
  builds: [],
  selectedApp: null,
  commandLog: [],
};

export function logCommand(cmd) {
  state.commandLog.push({ type: 'cmd', text: cmd, time: new Date() });
  updateLogUI();
}

export function logOutput(text) {
  state.commandLog.push({ type: 'output', text, time: new Date() });
  updateLogUI();
}

export function logError(text) {
  state.commandLog.push({ type: 'error', text, time: new Date() });
  updateLogUI();
}

function updateLogUI() {
  const el = document.getElementById('cmdLogContent');
  if (!el) return;
  el.innerHTML = state.commandLog.slice(-30).map(entry => {
    if (entry.type === 'cmd') return `<div><span class="cmd-prompt">$</span> ${escapeHTML(entry.text)}</div>`;
    if (entry.type === 'error') return `<div class="cmd-error">${escapeHTML(entry.text)}</div>`;
    return `<div class="cmd-output">${escapeHTML(entry.text)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}
