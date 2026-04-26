import { describe, it, expect } from 'vitest';
import {
  SubscriptionPricePoint,
  SubscriptionPriceBucket,
} from '../../../src/monetization/subscription/SubscriptionPricePoint.ts';

describe('SubscriptionPricePoint', () => {

  it('matches by formatted price, currency, or proceeds (case-insensitive)', () => {
    const p = new SubscriptionPricePoint({
      id: 'pp-1', territoryId: 'USA',
      formattedPrice: '$9.99', currency: 'USD', proceeds: '$6.99',
    });
    expect(p.matches('9.99')).toBe(true);
    expect(p.matches('USD')).toBe(true);
    expect(p.matches('GBP')).toBe(false);
  });

  it('priceBucket parses leading numeric amount and assigns a bucket', () => {
    expect(new SubscriptionPricePoint({ id: '1', territoryId: 'USA', formattedPrice: '$0.99', currency: 'USD', proceeds: '' }).priceBucket).toBe(SubscriptionPriceBucket.Under1);
    expect(new SubscriptionPricePoint({ id: '2', territoryId: 'USA', formattedPrice: '$25.00', currency: 'USD', proceeds: '' }).priceBucket).toBe(SubscriptionPriceBucket.From10To50);
    expect(new SubscriptionPricePoint({ id: '3', territoryId: 'USA', formattedPrice: '$199.99', currency: 'USD', proceeds: '' }).priceBucket).toBe(SubscriptionPriceBucket.Over100);
  });

  it('matchesBucket short-circuits on All', () => {
    const p = new SubscriptionPricePoint({ id: '1', territoryId: 'USA', formattedPrice: '$4.99', currency: 'USD', proceeds: '' });
    expect(p.matchesBucket(SubscriptionPriceBucket.All)).toBe(true);
    expect(p.matchesBucket(SubscriptionPriceBucket.From1To10)).toBe(true);
    expect(p.matchesBucket(SubscriptionPriceBucket.Over100)).toBe(false);
  });

  it('fromJSON tolerates territory-as-nested + customerPrice alias', () => {
    const p = SubscriptionPricePoint.fromJSON({
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
