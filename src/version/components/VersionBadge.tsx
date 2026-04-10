import { Version } from '../Version.ts';

interface Props {
  version: Version;
}

export function VersionBadge({ version }: Props) {
  return (
    <span className="version-badge">
      {version.isLive && <span className="badge badge-green">Live</span>}
      {version.isEditable && <span className="badge badge-blue">Editable</span>}
      {version.isPending && <span className="badge badge-yellow">Pending</span>}
      {version.isRejected && <span className="badge badge-red">Rejected</span>}
      {version.canSubmit && <button className="btn btn-sm">Submit</button>}
      {version.canRelease && <button className="btn btn-sm">Release</button>}
    </span>
  );
}
