export interface ScreenshotInit {
  id: string;
  fileName: string;
  /** ImageAsset template URL — contains `{w}`/`{h}`/`{f}` placeholders. */
  templateUrl: string | null;
  /** Source asset pixel dimensions reported by Apple. */
  width: number;
  height: number;
  /** 1-based order within the set. */
  order: number;
  /** Optional processing/upload state from the backend. */
  state?: string;
}

/**
 * One uploaded screenshot — a leaf in an `AppScreenshotSet`. Read-only from
 * the UI's perspective; editing means upload/replace/delete on the parent set.
 */
export class Screenshot {
  readonly id: string;
  readonly fileName: string;
  readonly templateUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly order: number;
  readonly state: string | undefined;

  constructor(init: ScreenshotInit) {
    this.id = init.id;
    this.fileName = init.fileName;
    this.templateUrl = init.templateUrl;
    this.width = init.width;
    this.height = init.height;
    this.order = init.order;
    this.state = init.state;
  }

  /** Resolve a concrete URL at the requested display size (CSS pixels). */
  srcAt(displayWidth: number): string | null {
    if (!this.templateUrl) return null;
    // Assume 2× retina by default for sharp thumbnails.
    const w = Math.round(displayWidth * 2);
    const h = Math.round((this.height / this.width) * w);
    return this.templateUrl
      .replace(/\{w\}/g, String(w))
      .replace(/\{h\}/g, String(h))
      .replace(/\{f\}/g, 'png');
  }
}
