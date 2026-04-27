import { describe, it, expect } from 'vitest';
import {
  IAPPriceSchedule,
  TerritoryPrice,
} from '../../../src/monetization/iap/IAPPriceSchedule.ts';

function mkPrice(territoryId: string, name: string, price: string, currency: string): TerritoryPrice {
  return new TerritoryPrice({
    territoryId, territoryName: name,
    formattedPrice: price, currency,
    pricePointId: `pp-${territoryId}`,
  });
}

describe('TerritoryPrice', () => {
  it('matches by name, id, currency, or formatted price (case-insensitive)', () => {
    const usa = mkPrice('USA', 'United States', '$9.99', 'USD');
    expect(usa.matches('united')).toBe(true);
    expect(usa.matches('USA')).toBe(true);
    expect(usa.matches('usd')).toBe(true);
    expect(usa.matches('9.99')).toBe(true);
    expect(usa.matches('Japan')).toBe(false);
    expect(usa.matches('   ')).toBe(true); // whitespace-only treated as empty
  });

  it('fromJSON tolerates nested territory and pricePoint shapes', () => {
    const p = TerritoryPrice.fromJSON({
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

describe('IAPPriceSchedule', () => {
  const usa = mkPrice('USA', 'United States', '$9.99', 'USD');
  const jpn = mkPrice('JPN', 'Japan', '¥1,500', 'JPY');
  const gbr = mkPrice('GBR', 'United Kingdom', '£7.99', 'GBP');

  function mkSchedule(): IAPPriceSchedule {
    return new IAPPriceSchedule({
      baseTerritoryId: 'USA',
      baseTerritoryName: 'United States',
      basePrice: '$9.99',
      baseCurrency: 'USD',
      basePricePointId: 'pp-USA',
      territoryPrices: [usa, jpn, gbr],
    });
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
    const sched = IAPPriceSchedule.fromJSON({
      baseTerritory: { id: 'USA', displayName: 'United States', currency: 'USD' },
      basePrice: '$9.99',
      basePricePoint: { id: 'pp-base' },
      territoryPrices: [
        { territory: { id: 'USA', displayName: 'United States', currency: 'USD' }, customerPrice: '$9.99', pricePoint: { id: 'pp-base' } },
        { territory: { id: 'JPN', displayName: 'Japan', currency: 'JPY' }, customerPrice: '¥1,500', pricePoint: { id: 'pp-jp' } },
      ],
    });
    expect(sched.baseTerritoryId).toBe('USA');
    expect(sched.baseTerritoryName).toBe('United States');
    expect(sched.basePrice).toBe('$9.99');
    expect(sched.basePricePointId).toBe('pp-base');
    expect(sched.territoryPrices.length).toBe(2);
    expect(sched.territoryPrices[1].territoryName).toBe('Japan');
  });

  it('fromJSON enriches the live backend shape (id-only territory + raw price)', () => {
    // Mirrors GET /api/v1/iap/<id>/price-schedule: territory has only id +
    // currency, customerPrice is a raw number string, and the top-level
    // payload omits basePrice. The factory should look up display names from
    // the directory, format prices via the currency code, and derive the
    // base price from territoryPrices using baseTerritory.id.
    const sched = IAPPriceSchedule.fromJSON({
      baseTerritory: { id: 'USA', currency: 'USD' },
      territoryPrices: [
        { territory: { id: 'USA', currency: 'USD' }, customerPrice: '6.99', proceeds: '5.94' },
        { territory: { id: 'JPN', currency: 'JPY' }, customerPrice: '1100', proceeds: '850' },
        { territory: { id: 'ARE', currency: 'AED' }, customerPrice: '24.99', proceeds: '20.23' },
      ],
    });

    expect(sched.baseTerritoryId).toBe('USA');
    expect(sched.baseTerritoryName).toBe('United States');
    expect(sched.baseCurrency).toBe('USD');
    expect(sched.basePrice).toBe('$6.99');

    const usa = sched.territoryPrices[0];
    expect(usa.territoryName).toBe('United States');
    expect(usa.formattedPrice).toBe('$6.99');

    const jpn = sched.territoryPrices[1];
    expect(jpn.territoryName).toBe('Japan');
    expect(jpn.formattedPrice).toBe('¥1,100');

    const are = sched.territoryPrices[2];
    expect(are.territoryName).toBe('United Arab Emirates');
    expect(are.formattedPrice).toMatch(/AED/);
    expect(are.formattedPrice).toMatch(/24\.99/);
  });
});
