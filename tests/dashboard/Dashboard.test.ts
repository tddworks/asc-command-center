import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '../../src/dashboard/Dashboard.ts';
import { Certificate } from '../../src/code-signing/Certificate.ts';
import { Build, BuildProcessingState } from '../../src/build/Build.ts';
import type { DashboardRepository } from '../../src/dashboard/DashboardRepository.ts';

const now = new Date('2026-04-20T00:00:00Z');

function certExpiringIn(days: number): Certificate {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return new Certificate('c-' + days, 'iOS Distribution', 'DISTRIBUTION', 'SN', d.toISOString(), 'VALID', {});
}

function someBuild(id: string): Build {
  return new Build(id, 'app-1', '100', '1.0', BuildProcessingState.Valid, false, false, '', {});
}

describe('Dashboard', () => {

  // ── Semantic booleans ──

  it('allClear is true when every count is zero and no certs expiring', () => {
    const d = new Dashboard(0, 0, [], []);
    expect(d.allClear).toBe(true);
    expect(d.hasWork).toBe(false);
  });

  it('hasWork is true when anything awaits review', () => {
    const d = new Dashboard(1, 0, [], []);
    expect(d.hasWork).toBe(true);
    expect(d.allClear).toBe(false);
  });

  it('hasWork is true when a cert is expiring', () => {
    const d = new Dashboard(0, 0, [certExpiringIn(5)], []);
    expect(d.hasWork).toBe(true);
  });

  // ── Urgency ──

  it('isUrgent when there are unresolved submissions', () => {
    const d = new Dashboard(0, 2, [], []);
    expect(d.isUrgent).toBe(true);
  });

  it('isUrgent when a cert is within 7 days of expiry', () => {
    vi.setSystemTime(now);
    const d = new Dashboard(0, 0, [certExpiringIn(3)], []);
    expect(d.isUrgent).toBe(true);
    vi.useRealTimers();
  });

  it('is not urgent when only awaiting-review > 0', () => {
    const d = new Dashboard(5, 0, [], []);
    expect(d.isUrgent).toBe(false);
  });

  it('is not urgent when only 14-day certs expiring (not 7-day)', () => {
    vi.setSystemTime(now);
    const d = new Dashboard(0, 0, [certExpiringIn(10)], []);
    expect(d.isUrgent).toBe(false);
    vi.useRealTimers();
  });

  // ── Groupings ──

  it('criticalCertificates returns only the ≤7d ones', () => {
    vi.setSystemTime(now);
    const d = new Dashboard(0, 0, [certExpiringIn(3), certExpiringIn(10), certExpiringIn(6)], []);
    expect(d.criticalCertificates.map((c) => c.id)).toEqual(['c-3', 'c-6']);
    vi.useRealTimers();
  });

  it('warningCertificates returns only the 8..14d ones', () => {
    vi.setSystemTime(now);
    const d = new Dashboard(0, 0, [certExpiringIn(3), certExpiringIn(10), certExpiringIn(13)], []);
    expect(d.warningCertificates.map((c) => c.id)).toEqual(['c-10', 'c-13']);
    vi.useRealTimers();
  });

  // ── Repository delegation shape (shape test, not the repo's own logic) ──

  it('repository load shape — hook consumers delegate here', async () => {
    const expected = new Dashboard(3, 1, [certExpiringIn(5)], [someBuild('b-1')]);
    const repo: DashboardRepository = {
      load: vi.fn().mockResolvedValue(expected),
    };
    await expect(repo.load()).resolves.toBe(expected);
    expect(repo.load).toHaveBeenCalledOnce();
  });
});
