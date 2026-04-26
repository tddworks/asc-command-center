import { describe, it, expect } from 'vitest';
import { IAPPricePoint, PriceBucket } from '../../../src/monetization/iap/IAPPricePoint.ts';

describe('IAPPricePoint', () => {

  it('matches by formatted price, currency, or proceeds (case-insensitive)', () => {
    const p = new IAPPricePoint({
      id: 'pp-1', territoryId: 'USA',
      formattedPrice: '$9.99', currency: 'USD', proceeds: '$6.99',
    });
    expect(p.matches('9.99')).toBe(true);
    expect(p.matches('USD')).toBe(true);
    expect(p.matches('6.99')).toBe(true);
    expect(p.matches('GBP')).toBe(false);
    expect(p.matches('   ')).toBe(true);
  });

  // ── Bucketing ──

  it('priceBucket parses the leading numeric amount and assigns a bucket', () => {
    expect(new IAPPricePoint({ id: '1', territoryId: 'USA', formattedPrice: '$0.99', currency: 'USD', proceeds: '' }).priceBucket).toBe(PriceBucket.Under1);
    expect(new IAPPricePoint({ id: '2', territoryId: 'USA', formattedPrice: '$4.99', currency: 'USD', proceeds: '' }).priceBucket).toBe(PriceBucket.From1To10);
    expect(new IAPPricePoint({ id: '3', territoryId: 'USA', formattedPrice: '$25.00', currency: 'USD', proceeds: '' }).priceBucket).toBe(PriceBucket.From10To50);
    expect(new IAPPricePoint({ id: '4', territoryId: 'USA', formattedPrice: '$75.00', currency: 'USD', proceeds: '' }).priceBucket).toBe(PriceBucket.From50To100);
    expect(new IAPPricePoint({ id: '5', territoryId: 'USA', formattedPrice: '$199.99', currency: 'USD', proceeds: '' }).priceBucket).toBe(PriceBucket.Over100);
  });

  it('priceBucket handles digit-grouped prices ($1,234.56)', () => {
    expect(new IAPPricePoint({ id: '6', territoryId: 'USA', formattedPrice: '$1,234.56', currency: 'USD', proceeds: '' }).priceBucket).toBe(PriceBucket.Over100);
  });

  it('matchesBucket returns true when bucket is "all"', () => {
    const p = new IAPPricePoint({ id: '1', territoryId: 'USA', formattedPrice: '$4.99', currency: 'USD', proceeds: '' });
    expect(p.matchesBucket(PriceBucket.All)).toBe(true);
    expect(p.matchesBucket(PriceBucket.From1To10)).toBe(true);
    expect(p.matchesBucket(PriceBucket.Over100)).toBe(false);
  });

  // ── fromJSON ──

  it('fromJSON tolerates territory-as-nested and customerPrice alias', () => {
    const p = IAPPricePoint.fromJSON({
      id: 'pp-9',
      territory: { id: 'JPN', currency: 'JPY' },
      customerPrice: '¥1,500',
      proceeds: '¥1,050',
    });
    expect(p.id).toBe('pp-9');
    expect(p.territoryId).toBe('JPN');
    expect(p.currency).toBe('JPY');
    expect(p.formattedPrice).toBe('¥1,500');
    expect(p.proceeds).toBe('¥1,050');
  });
});
