import { describe, it, expect } from 'vitest';
import {
  SubscriptionPriceSchedule,
  SubscriptionTerritoryPrice,
} from '../../../src/monetization/subscription/SubscriptionPriceSchedule.ts';

function mkPrice(territoryId: string, name: string, price: string, currency: string): SubscriptionTerritoryPrice {
  return new SubscriptionTerritoryPrice({
    territoryId, territoryName: name,
    formattedPrice: price, currency,
    pricePointId: `pp-${territoryId}`,
  });
}

describe('SubscriptionTerritoryPrice', () => {
  it('matches by name, id, currency, or formatted price (case-insensitive)', () => {
    const usa = mkPrice('USA', 'United States', '$9.99', 'USD');
    expect(usa.matches('united')).toBe(true);
    expect(usa.matches('USA')).toBe(true);
    expect(usa.matches('usd')).toBe(true);
    expect(usa.matches('9.99')).toBe(true);
    expect(usa.matches('Japan')).toBe(false);
    expect(usa.matches('   ')).toBe(true);
  });

  it('fromJSON tolerates nested territory and pricePoint shapes', () => {
    const p = SubscriptionTerritoryPrice.fromJSON({
      territory: { id: 'JPN', displayName: 'Japan', currency: 'JPY' },
      customerPrice: '¥1,500',
      pricePoint: { id: 'pp-99' },
    });
    expect(p.territoryId).toBe('JPN');
    expect(p.territoryName).toBe('Japan');
    expect(p.currency).toBe('JPY');
    expect(p.formattedPrice).toBe('¥1,500');
    expect(p.pricePointId).toBe('pp-99');
  });
});

describe('SubscriptionPriceSchedule', () => {
  const usa = mkPrice('USA', 'United States', '$9.99', 'USD');
  const jpn = mkPrice('JPN', 'Japan', '¥1,500', 'JPY');
  const gbr = mkPrice('GBR', 'United Kingdom', '£7.99', 'GBP');

  function mkSchedule(): SubscriptionPriceSchedule {
    return new SubscriptionPriceSchedule({ territoryPrices: [usa, jpn, gbr] });
  }

  it('territoryCount counts the rows', () => {
    expect(mkSchedule().territoryCount).toBe(3);
  });

  it('filteredTerritoryPrices narrows by query', () => {
    const sched = mkSchedule();
    expect(sched.filteredTerritoryPrices('').length).toBe(3);
    expect(sched.filteredTerritoryPrices('japan')).toEqual([jpn]);
    expect(sched.filteredTerritoryPrices('gbp')).toEqual([gbr]);
    expect(sched.filteredTerritoryPrices('united')).toEqual([usa, gbr]);
    expect(sched.filteredTerritoryPrices('xxx')).toEqual([]);
  });

  it('fromJSON hydrates a schedule from a backend payload', () => {
    const sched = SubscriptionPriceSchedule.fromJSON({
      territoryPrices: [
        { territory: { id: 'USA', displayName: 'United States', currency: 'USD' }, customerPrice: '$9.99', pricePoint: { id: 'pp-1' } },
        { territory: { id: 'JPN', displayName: 'Japan', currency: 'JPY' }, customerPrice: '¥1,500', pricePoint: { id: 'pp-2' } },
      ],
    });
    expect(sched.territoryPrices.length).toBe(2);
    expect(sched.territoryPrices[1].territoryName).toBe('Japan');
  });
});
