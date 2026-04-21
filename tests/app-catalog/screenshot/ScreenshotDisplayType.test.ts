import { describe, it, expect } from 'vitest';
import {
  SCREENSHOT_DISPLAY_TYPES,
  dimensions,
  displayTypeForId,
  displayTypesForPlatform,
} from '../../../src/app-catalog/screenshot/ScreenshotDisplayType.ts';

describe('ScreenshotDisplayType registry', () => {

  it('includes the iPhone 6.7" display type (Apple\'s baseline required set)', () => {
    const t = displayTypeForId('APP_IPHONE_67');
    expect(t).not.toBeNull();
    expect(t!.label).toBe('iPhone 6.7"');
    expect(t!.width).toBe(1290);
    expect(t!.height).toBe(2796);
    expect(t!.required).toBe(true);
  });

  it('includes iPad Pro 12.9" (3rd gen) as required', () => {
    const t = displayTypeForId('APP_IPAD_PRO_3GEN_129');
    expect(t).not.toBeNull();
    expect(t!.required).toBe(true);
  });

  it('displayTypeForId returns null for unknown / empty / null inputs', () => {
    expect(displayTypeForId(null)).toBeNull();
    expect(displayTypeForId(undefined)).toBeNull();
    expect(displayTypeForId('')).toBeNull();
    expect(displayTypeForId('NOT_A_TYPE')).toBeNull();
  });

  it('dimensions formats width × height', () => {
    const t = displayTypeForId('APP_IPHONE_67')!;
    expect(dimensions(t)).toBe('1290 × 2796');
  });

  it('displayTypesForPlatform returns entries in displayOrder', () => {
    const ios = displayTypesForPlatform('IOS');
    expect(ios.length).toBeGreaterThan(1);
    for (let i = 1; i < ios.length; i++) {
      expect(ios[i].displayOrder).toBeGreaterThan(ios[i - 1].displayOrder);
    }
  });

  it('every entry has positive dimensions + non-empty label', () => {
    for (const t of SCREENSHOT_DISPLAY_TYPES) {
      expect(t.apiId.length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
      expect(t.maxScreenshots).toBeGreaterThan(0);
    }
  });

  it('api ids are unique', () => {
    const ids = SCREENSHOT_DISPLAY_TYPES.map((t) => t.apiId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
