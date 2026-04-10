import { useState } from 'react';
import { useSubmission } from '../Submission.hooks.ts';
import { AffordanceBar } from '../../shared/components/AffordanceBar.tsx';

const stateColors: Record<string, string> = {
  READY_FOR_REVIEW: 'var(--accent)',
  WAITING_FOR_REVIEW: '#f59e0b',
  IN_REVIEW: '#3b82f6',
  REJECTED: '#ef4444',
  ACCEPTED: '#22c55e',
};

export default function SubmissionPage() {
  const [versionId, setVersionId] = useState('');
  const [checkedVersionId, setCheckedVersionId] = useState('');
  const { submission, loading, error } = useSubmission(checkedVersionId || 'v-1');

  return (
    <div>
      <h2>Submission</h2>

      <div style={{ marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Version ID"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--text)',
            flex: 1,
            maxWidth: 300,
          }}
        />
        <button
          className="affordance-btn"
          onClick={() => setCheckedVersionId(versionId)}
          disabled={!versionId}
        >
          Check Readiness
        </button>
      </div>

      {loading && <div className="spinner">Loading submission...</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {submission && !loading && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 20,
            background: 'var(--surface)',
            maxWidth: 500,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>Submission {submission.id}</span>
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: stateColors[submission.state] ?? 'var(--border)',
                color: 'white',
              }}
            >
              {submission.displayState}
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Version: {submission.versionId}
          </div>
          <AffordanceBar affordances={submission.affordances} />
        </div>
      )}
    </div>
  );
}
