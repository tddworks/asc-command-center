// Presentation: Shared UI helpers
export const appColors = ['#2563EB','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#4F46E5','#EA580C'];

export function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function statusBadge(state) {
  const map = {
    'READY_FOR_SALE': ['live', 'Live'],
    'PREPARE_FOR_SUBMISSION': ['pending', 'Preparing'],
    'WAITING_FOR_REVIEW': ['review', 'Waiting'],
    'IN_REVIEW': ['review', 'In Review'],
    'REJECTED': ['rejected', 'Rejected'],
    'DEVELOPER_REJECTED': ['rejected', 'Dev Rejected'],
    'VALID': ['live', 'Valid'],
    'INVALID': ['rejected', 'Invalid'],
    'PROCESSING': ['processing', 'Processing'],
    'APPROVED': ['live', 'Approved'],
    'READY_TO_SUBMIT': ['pending', 'Ready'],
    'MISSING_METADATA': ['pending', 'Missing Metadata'],
    'DEVELOPER_ACTION_NEEDED': ['pending', 'Action Needed'],
    'PENDING_BINARY_APPROVAL': ['review', 'Pending Approval'],
    'DEVELOPER_REMOVED_FROM_SALE': ['draft', 'Dev Removed'],
    'REMOVED_FROM_SALE': ['draft', 'Removed'],
    'METADATA_REJECTED': ['rejected', 'Meta Rejected'],
    'PENDING_DEVELOPER_RELEASE': ['pending', 'Pending Release'],
    'PENDING_APPLE_RELEASE': ['pending', 'Pending Release'],
    'PROCESSING_FOR_APP_STORE': ['processing', 'Processing'],
    'PENDING_CONTRACT': ['pending', 'Pending Contract'],
    'ACTIVE': ['live', 'Active'],
    'SUCCEEDED': ['live', 'Succeeded'],
    'FAILED': ['rejected', 'Failed'],
    'ERRORED': ['rejected', 'Errored'],
    'CANCELED': ['draft', 'Canceled'],
    'PENDING': ['pending', 'Pending'],
    'RUNNING': ['processing', 'Running'],
    'COMPLETE': ['live', 'Complete'],
  };
  const [cls, label] = map[state] || ['draft', state?.replace(/_/g, ' ') || 'Unknown'];
  return `<span class="status ${cls}">${label}</span>`;
}
