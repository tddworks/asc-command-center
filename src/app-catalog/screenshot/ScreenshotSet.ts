import { makeAutoObservable } from 'mobx';
import type { Screenshot } from './Screenshot.ts';
import { displayTypeForId, type DisplayTypeMeta } from './ScreenshotDisplayType.ts';

export interface ScreenshotSetInit {
  id: string;
  displayTypeId: string;
  screenshots: Screenshot[];
}

/**
 * A screenshot set is one `AppScreenshotSet` resource — grouping all
 * screenshots for a given display type (e.g. iPhone 6.7") within one
 * version+locale. Observable so child list mutations (future upload/delete)
 * propagate without re-fetching.
 */
export class ScreenshotSet {
  readonly id: string;
  readonly displayTypeId: string;
  screenshots: Screenshot[];

  constructor(init: ScreenshotSetInit) {
    this.id = init.id;
    this.displayTypeId = init.displayTypeId;
    this.screenshots = [...init.screenshots].sort((a, b) => a.order - b.order);
    makeAutoObservable(this, { id: false, displayTypeId: false });
  }

  /** Meta for the display type — labels, dimensions, max count. May be null for unknown ids. */
  get meta(): DisplayTypeMeta | null {
    return displayTypeForId(this.displayTypeId);
  }

  get isEmpty(): boolean {
    return this.screenshots.length === 0;
  }

  get count(): number {
    return this.screenshots.length;
  }

  get canAddMore(): boolean {
    const max = this.meta?.maxScreenshots ?? 10;
    return this.screenshots.length < max;
  }

  get remainingSlots(): number {
    const max = this.meta?.maxScreenshots ?? 10;
    return Math.max(0, max - this.screenshots.length);
  }
}
