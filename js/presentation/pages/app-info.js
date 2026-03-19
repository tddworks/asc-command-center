// Page: App Info (static metadata form)
import { showToast } from '../toast.js';

export function renderAppInfo() {
  return `
    <div class="card mb-24">
      <div class="card-header"><span class="card-title">App Metadata</span></div>
      <div class="card-body padded">
        <div class="form-group"><label class="form-label">App Name</label><input class="form-input" placeholder="PhotoSync Pro"/></div>
        <div class="form-row mb-16">
          <div class="form-group"><label class="form-label">Subtitle</label><input class="form-input" placeholder="Sync photos everywhere"/></div>
          <div class="form-group"><label class="form-label">Primary Category</label>
            <select class="form-input select-styled"><option>Photography</option><option>Utilities</option><option>Productivity</option></select>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Privacy Policy URL</label><input class="form-input" placeholder="https://example.com/privacy"/></div>
        <button class="btn btn-primary" onclick="showToast('Metadata updated','success')">Save Changes</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Localizations</span>
        <button class="btn btn-sm btn-primary" onclick="showToast('asc app-info-localizations create','info')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Locale</button>
      </div>
      <div class="table-wrapper">
        <table><thead><tr><th>Locale</th><th>Name</th><th>Subtitle</th><th style="text-align:right">Actions</th></tr></thead><tbody>
          <tr><td><span class="cell-primary">en-US</span></td><td>PhotoSync Pro</td><td>Sync photos everywhere</td><td class="text-right"><button class="btn btn-sm btn-secondary">Edit</button></td></tr>
          <tr><td><span class="cell-primary">zh-Hans</span></td><td>PhotoSync Pro</td><td>--</td><td class="text-right"><button class="btn btn-sm btn-secondary">Edit</button> <button class="btn btn-sm btn-danger">Delete</button></td></tr>
        </tbody></table>
      </div>
    </div>`;
}
