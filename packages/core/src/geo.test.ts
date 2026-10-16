import { describe, expect, it } from 'vitest';
import { distanceMeters, nearestPlace, seedListings, type Listing } from './index';

const at = (l: Listing, lat: number, lng: number, street = l.street): Listing => ({ ...l, street, location: { lat, lng } });

describe('geo', () => {
  it('measures distance in meters', () => {
    // میدان آزادی تا میدان انقلاب، نزدیک پنج کیلومتر
    const d = distanceMeters({ lat: 35.6997, lng: 51.338 }, { lat: 35.7009, lng: 51.3913 });
    expect(d).toBeGreaterThan(4700);
    expect(d).toBeLessThan(4900);
    expect(distanceMeters({ lat: 35.7, lng: 51.4 }, { lat: 35.7, lng: 51.4 })).toBe(0);
  });

  it('guesses the place from the nearest office listing, not from far ones', () => {
    const [a, b] = seedListings;
    const ls = [at(a!, 35.7741, 51.3642, 'سرو غربی'), at(b!, 35.7578, 51.4106)];
    expect(nearestPlace(ls, { lat: 35.7745, lng: 51.3644 })).toEqual({ neighborhood: a!.neighborhood, street: 'سرو غربی' });
    // ۳۰۰ متر دورتر: محله آری، خیابان نه
    expect(nearestPlace(ls, { lat: 35.7768, lng: 51.3642 })).toEqual({ neighborhood: a!.neighborhood, street: '' });
    expect(nearestPlace(ls, { lat: 35.6, lng: 51.2 })).toBeUndefined();
    expect(nearestPlace([a!], { lat: 35.7741, lng: 51.3642 })).toBeUndefined();
  });
});
