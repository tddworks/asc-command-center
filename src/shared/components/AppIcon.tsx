import type { App } from '../../app-catalog/app/App.ts';

const PALETTE = [
  '#2563EB', '#7C3AED', '#059669', '#D97706',
  '#DC2626', '#0891B2', '#4F46E5', '#EA580C',
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface Props {
  app: App;
  /** CSS pixel size of the rendered icon. Controls both the <img> size and
   *  the template-URL substitution when using Apple's ImageAsset template. */
  size?: number;
  /** Additional class name for layout tweaks. */
  className?: string;
}

/**
 * Renders an app's icon. Prefers the real icon URL when the domain has one
 * (via `app.iconSrc`); falls back to a deterministic colored rounded square
 * with the first letter of the app name.
 */
export function AppIcon({ app, size = 28, className }: Props) {
  const src = app.iconSrc(size * 2); // request 2x for retina
  const radius = Math.max(4, Math.round(size * 0.22));

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  const color = PALETTE[hashCode(app.id) % PALETTE.length];
  const initial = app.name.charAt(0).toUpperCase();
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: radius,
        background: color,
        color: '#fff',
        fontWeight: 700,
        fontSize: Math.round(size * 0.46),
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}
