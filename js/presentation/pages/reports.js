// Page: Reports
import { showToast } from '../toast.js';

export function renderReports() {
  return `
    <div class="grid-3 mb-24">
      <div class="card">
        <div class="card-body padded" style="text-align:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="color:var(--accent);margin-bottom:8px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <div style="font-weight:600;margin-bottom:4px">Sales Report</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Download daily, weekly, or monthly sales data</div>
          <button class="btn btn-primary btn-sm" onclick="showToast('asc sales-reports download --report-type SALES','info')">Download</button>
        </div>
      </div>
      <div class="card">
        <div class="card-body padded" style="text-align:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="color:var(--success);margin-bottom:8px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <div style="font-weight:600;margin-bottom:4px">Finance Report</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Revenue, proceeds, and payment details</div>
          <button class="btn btn-success btn-sm" onclick="showToast('asc finance-reports download --report-type FINANCIAL','info')">Download</button>
        </div>
      </div>
      <div class="card">
        <div class="card-body padded" style="text-align:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="color:var(--info);margin-bottom:8px"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
          <div style="font-weight:600;margin-bottom:4px">Analytics</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">App usage, engagement, and performance</div>
          <button class="btn btn-sm" style="background:var(--info-bg);color:var(--info-text)" onclick="showToast('asc analytics-reports request','info')">Request</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Performance Metrics</span></div>
      <div class="card-body padded">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="showToast('asc perf-metrics list --metric-type LAUNCH','info')">Launch Time</button>
          <button class="btn btn-secondary btn-sm" onclick="showToast('asc perf-metrics list --metric-type HANG','info')">Hang Rate</button>
          <button class="btn btn-secondary btn-sm" onclick="showToast('asc perf-metrics list --metric-type DISK','info')">Disk Writes</button>
          <button class="btn btn-secondary btn-sm" onclick="showToast('asc perf-metrics list --metric-type MEMORY','info')">Memory</button>
          <button class="btn btn-secondary btn-sm" onclick="showToast('asc diagnostics list','info')">Diagnostics</button>
        </div>
      </div>
    </div>`;
}
