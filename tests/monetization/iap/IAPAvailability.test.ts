import { describe, it, expect } from 'vitest';
import {
  IAPAvailability,
  TerritoryAvailability,
} from '../../../src/monetization/iap/IAPAvailability.ts';

function mk(id: string, name: string, currency: string, available: boolean): TerritoryAvailability {
  return new TerritoryAvailability({ territoryId: id, territoryName: name, currency, isAvailable: available });
}

describe('TerritoryAvailability', () => {
  it('matches by name, id, or currency (case-insensitive)', () => {
    const usa = mk('USA', 'United States', 'USD', true);
    expect(usa.matches('united')).toBe(true);
    expect(usa.matches('USA')).toBe(true);
    expect(usa.matches('usd')).toBe(true);
    expect(usa.matches('Japan')).toBe(false);
  });
});

describe('IAPAvailability', () => {
  function mkAvail(opts: Partial<{ auto: boolean; rows: TerritoryAvailability[] }> = {}): IAPAvailability {
    return new IAPAvailability({
      availableInNewTerritories: opts.auto ?? false,
      territories: opts.rows ?? [
        mk('USA', 'United States', 'USD', true),
        mk('GBR', 'United Kingdom', 'GBP', true),
        mk('JPN', 'Japan', 'JPY', false),
      ],
    });
  }

  // ── Counts ──

  it('counts available / total / unavailable', () => {
    const avail = mkAvail();
    expect(avail.totalCount).toBe(3);
    expect(avail.availableCount).toBe(2);
    expect(avail.unavailableCount).toBe(1);
  });

  it('availableTerritoryIds returns the ids of every available row', () => {
    const avail = mkAvail();
    expect(avail.availableTerritoryIds).toEqual(['USA', 'GBR']);
  });

  // ── Filtering ──

  it('filtered narrows by free-text query', () => {
    const avail = mkAvail();
    expect(avail.filtered('').length).toBe(3);
    expect(avail.filtered('japan').map((t) => t.territoryId)).toEqual(['JPN']);
    expect(avail.filtered('united').map((t) => t.territoryId)).toEqual(['USA', 'GBR']);
  });

  // ── Editing ──

  it('toggleTerritory flips a row by id and marks dirty', () => {
    const avail = mkAvail();
    expect(avail.isDirty).toBe(false);

    avail.toggleTerritory('JPN');

    expect(avail.byId('JPN')?.isAvailable).toBe(true);
    expect(avail.availableCount).toBe(3);
    expect(avail.isDirty).toBe(true);
  });

  it('setAllAvailable / setAllUnavailable bulk-toggle every row', () => {
    const avail = mkAvail();
    avail.setAllAvailable(false);
    expect(avail.availableCount).toBe(0);
    expect(avail.isDirty).toBe(true);

    avail.setAllAvailable(true);
    expect(avail.availableCount).toBe(3);
  });

  it('setAllAvailable respects an optional filter so the page can bulk-toggle visible rows only', () => {
    const avail = mkAvail();
    avail.setAllAvailable(false, (t) => t.territoryId === 'USA');
    expect(avail.byId('USA')?.isAvailable).toBe(false);
    expect(avail.byId('GBR')?.isAvailable).toBe(true);
  });

  it('setAvailableInNewTerritories flips the auto-include toggle and marks dirty', () => {
    const avail = mkAvail();
    avail.setAvailableInNewTerritories(true);
    expect(avail.availableInNewTerritories).toBe(true);
    expect(avail.isDirty).toBe(true);
  });

  // ── Snapshot ──

  it('discard restores the snapshot', () => {
    const avail = mkAvail();
    avail.toggleTerritory('JPN');
    avail.setAvailableInNewTerritories(true);
    avail.discard();
    expect(avail.byId('JPN')?.isAvailable).toBe(false);
    expect(avail.availableInNewTerritories).toBe(false);
    expect(avail.isDirty).toBe(false);
  });

  it('markSaved snapshots current state', () => {
    const avail = mkAvail();
    avail.toggleTerritory('JPN');
    avail.markSaved();
    expect(avail.isDirty).toBe(false);
  });

  // ── fromJSON ──

  it('fromJSON tolerates territories[] with isAvailable + availableInNewTerritories flag', () => {
    const avail = IAPAvailability.fromJSON({
      availableInNewTerritories: true,
      territories: [
        { id: 'USA', name: 'United States', currency: 'USD', isAvailable: true },
        { id: 'JPN', name: 'Japan', currency: 'JPY', isAvailable: false },
      ],
    });
    expect(avail.availableInNewTerritories).toBe(true);
    expect(avail.totalCount).toBe(2);
    expect(avail.availableTerritoryIds).toEqual(['USA']);
  });

  it('fromJSON treats listed territories as available when the API omits isAvailable (backend ships only the available list)', () => {
    const avail = IAPAvailability.fromJSON({
      isAvailableInNewTerritories: true,
      territories: [
        { id: 'USA', currency: 'USD' },
        { id: 'FRA', currency: 'EUR' },
        { id: 'JPN', currency: 'JPY' },
      ],
    });
    expect(avail.availableInNewTerritories).toBe(true);
    expect(avail.totalCount).toBe(3);
    expect(avail.availableTerritoryIds).toEqual(['USA', 'FRA', 'JPN']);
  });
});
