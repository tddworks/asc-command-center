/**
 * Dark overlay rendered on top of an in-flight upload preview, mirroring
 * iOS's `UploadProgressView`. We don't have real progress events for
 * fetch-based uploads, so this is indeterminate — spinner + state label.
 */
export function UploadOverlay({ label = 'Uploading…' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'rgba(0,0,0,0.45)',
        color: 'white',
        borderRadius: 'inherit',
      }}
    >
      <span
        className="spinner"
        style={{
          width: 22,
          height: 22,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.4)',
          borderTopColor: 'white',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
        {label}
      </span>
    </div>
  );
}
