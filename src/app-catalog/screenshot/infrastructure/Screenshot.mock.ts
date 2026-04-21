import { Screenshot } from '../Screenshot.ts';
import { ScreenshotSet } from '../ScreenshotSet.ts';
import type { ScreenshotRepository } from '../ScreenshotRepository.ts';
import { SCREENSHOT_DISPLAY_TYPES, type DisplayTypeMeta } from '../ScreenshotDisplayType.ts';

/**
 * In-memory ScreenshotRepository. Seeds a reasonable set for every required
 * iPhone + iPad display type so the UI has something to render. Non-required
 * types return an empty set (so the page can show "0 of N" placeholders).
 *
 * Uses SVG data URIs as stand-ins for uploaded screenshots — no binary
 * assets required, each one reflects the display type's label + dimensions.
 */
export class MockScreenshotRepository implements ScreenshotRepository {
  async listSets(_versionId: string, _locale: string): Promise<ScreenshotSet[]> {
    return SCREENSHOT_DISPLAY_TYPES
      .filter((t) => t.platform === 'IOS' || t.platform === 'IPAD_OS')
      .map((t) => new ScreenshotSet({
        id: `set-${t.apiId}`,
        displayTypeId: t.apiId,
        screenshots: t.required ? seedScreenshots(t) : [],
      }));
  }
}

function seedScreenshots(t: DisplayTypeMeta): Screenshot[] {
  // Three demo screenshots per required set.
  return Array.from({ length: 3 }, (_, i) =>
    new Screenshot({
      id: `ss-${t.apiId}-${i + 1}`,
      fileName: `${t.apiId.toLowerCase()}-${i + 1}.png`,
      templateUrl: placeholderSvg(t, i + 1),
      width: t.width,
      height: t.height,
      order: i + 1,
    }),
  );
}

/**
 * Returns a data: URL pointing to an inline SVG sized to the display type's
 * aspect ratio with a large index glyph — good enough to show ordering and
 * placement without any real image assets.
 */
function placeholderSvg(t: DisplayTypeMeta, index: number): string {
  // We ignore {w}/{h} placeholders in the mock — generate a fixed-size SVG
  // that the CSS thumbnail will scale to fit.
  const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
  const from = palette[index % palette.length];
  const to = palette[(index + 3) % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.width} ${t.height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="${t.width}" height="${t.height}" fill="url(#g)"/>
    <text x="50%" y="30%" text-anchor="middle" dominant-baseline="middle"
          font-family="-apple-system, sans-serif" font-size="${Math.round(t.width * 0.08)}"
          font-weight="700" fill="#fff" opacity="0.9">${t.label}</text>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
          font-family="-apple-system, sans-serif" font-size="${Math.round(t.width * 0.28)}"
          font-weight="800" fill="#fff">${index}</text>
    <text x="50%" y="75%" text-anchor="middle" dominant-baseline="middle"
          font-family="'SF Mono', Menlo, monospace" font-size="${Math.round(t.width * 0.035)}"
          fill="#fff" opacity="0.7">${t.width} × ${t.height}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
