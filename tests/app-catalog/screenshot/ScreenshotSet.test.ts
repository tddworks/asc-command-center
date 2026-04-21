import { describe, it, expect } from 'vitest';
import { Screenshot } from '../../../src/app-catalog/screenshot/Screenshot.ts';
import { ScreenshotSet } from '../../../src/app-catalog/screenshot/ScreenshotSet.ts';

function ss(order: number, id = `ss-${order}`): Screenshot {
  return new Screenshot({
    id, fileName: `${id}.png`,
    templateUrl: 'https://cdn.example/{w}x{h}bb.{f}',
    width: 1290, height: 2796, order,
  });
}

describe('ScreenshotSet', () => {

  it('sorts screenshots by order on construction', () => {
    const set = new ScreenshotSet({
      id: 's-1',
      displayTypeId: 'APP_IPHONE_67',
      screenshots: [ss(3), ss(1), ss(2)],
    });
    expect(set.screenshots.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it('isEmpty + count reflect the screenshots array', () => {
    const empty = new ScreenshotSet({ id: 's-1', displayTypeId: 'APP_IPHONE_67', screenshots: [] });
    expect(empty.isEmpty).toBe(true);
    expect(empty.count).toBe(0);

    const filled = new ScreenshotSet({
      id: 's-2', displayTypeId: 'APP_IPHONE_67', screenshots: [ss(1), ss(2)],
    });
    expect(filled.isEmpty).toBe(false);
    expect(filled.count).toBe(2);
  });

  it('meta resolves from the display-type registry', () => {
    const set = new ScreenshotSet({ id: 's-1', displayTypeId: 'APP_IPHONE_67', screenshots: [] });
    expect(set.meta?.label).toBe('iPhone 6.7"');
  });

  it('meta is null for unknown display types', () => {
    const set = new ScreenshotSet({ id: 's-1', displayTypeId: 'NOT_A_TYPE', screenshots: [] });
    expect(set.meta).toBeNull();
  });

  it('canAddMore is true until the set reaches the display type max', () => {
    const shots = Array.from({ length: 9 }, (_, i) => ss(i + 1));
    const set = new ScreenshotSet({ id: 's-1', displayTypeId: 'APP_IPHONE_67', screenshots: shots });
    expect(set.canAddMore).toBe(true);
    expect(set.remainingSlots).toBe(1);
  });

  it('canAddMore is false once the set reaches the max', () => {
    const shots = Array.from({ length: 10 }, (_, i) => ss(i + 1));
    const set = new ScreenshotSet({ id: 's-1', displayTypeId: 'APP_IPHONE_67', screenshots: shots });
    expect(set.canAddMore).toBe(false);
    expect(set.remainingSlots).toBe(0);
  });

  it('Screenshot.srcAt substitutes width/height in the template URL', () => {
    const s = ss(1);
    // iPhone 6.7 aspect ratio is 1290:2796 — at 120 display width (retina 2×)
    // the computed height is round(2796/1290 * 240) = 520.
    expect(s.srcAt(120)).toBe('https://cdn.example/240x520bb.png');
  });

  it('Screenshot.srcAt returns null when no template URL is set', () => {
    const s = new Screenshot({
      id: 'ss-x', fileName: 'x.png', templateUrl: null,
      width: 100, height: 100, order: 1,
    });
    expect(s.srcAt(60)).toBeNull();
  });
});
