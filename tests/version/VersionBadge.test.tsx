import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionBadge } from '../../src/version/components/VersionBadge.tsx';
import { Version, VersionState } from '../../src/version/Version.ts';

describe('VersionBadge', () => {

  it('shows green Live badge for ready for sale version', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.ReadyForSale, 'IOS', {});

    render(<VersionBadge version={v} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows Editable badge for prepare for submission', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});

    render(<VersionBadge version={v} />);

    expect(screen.getByText('Editable')).toBeInTheDocument();
  });

  it('shows Pending badge when waiting for review', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.WaitingForReview, 'IOS', {});

    render(<VersionBadge version={v} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Rejected badge for rejected version', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.Rejected, 'IOS', {});

    render(<VersionBadge version={v} />);

    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows Submit button when version can submit', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {
      submitForReview: 'asc versions submit --id v-1',
    });

    render(<VersionBadge version={v} />);

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('does not show Submit button when server omits affordance', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});

    render(<VersionBadge version={v} />);

    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('shows Release button when version can release', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PendingDeveloperRelease, 'IOS', {
      releaseVersion: 'asc versions release --id v-1',
    });

    render(<VersionBadge version={v} />);

    expect(screen.getByRole('button', { name: /release/i })).toBeInTheDocument();
  });
});
