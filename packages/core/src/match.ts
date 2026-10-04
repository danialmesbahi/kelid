import type { ClientNeed, Listing } from './model';
import { normalizeForSearch } from './persian';

export interface MatchResult {
  score: number;
  reasons: string[];
  misses: string[];
}

function budgetOf(l: Listing): number {
  return l.deal === 'sale' ? l.price.total ?? 0 : l.price.deposit ?? 0;
}

/**
 * هم‌خوانی یک فایل با نیاز یک مشتری، از ۰ تا ۱۰۰.
 * نوع معامله شرط لازم است؛ بقیه وزن دارند.
 */
export function matchListing(l: Listing, need: ClientNeed): MatchResult {
  if (l.deal !== need.deal) return { score: 0, reasons: [], misses: ['نوع معامله'] };

  const reasons: string[] = [];
  const misses: string[] = [];
  let score = 0;

  // اجاره هم اگر سقف داشته باشد، جزو قیمت حساب می‌شود.
  const rent = l.price.monthlyRent ?? 0;
  const rentOk = l.deal !== 'rent' || need.rentMax === undefined || rent <= need.rentMax;
  const rentNear = l.deal !== 'rent' || need.rentMax === undefined || rent <= need.rentMax * 1.1;
  if ((need.budgetMax === undefined || budgetOf(l) <= need.budgetMax) && rentOk) {
    score += 35;
    reasons.push('قیمت');
  } else if ((need.budgetMax === undefined || budgetOf(l) <= need.budgetMax * 1.1) && rentNear) {
    score += 15;
    misses.push('قیمت کمی بالاتر');
  } else {
    misses.push('قیمت');
  }

  const hood = normalizeForSearch(l.neighborhood);
  if (need.neighborhoods.length === 0 || need.neighborhoods.some((n) => normalizeForSearch(n) === hood)) {
    score += 30;
    reasons.push('محله');
  } else {
    misses.push('محله');
  }

  const areaOk = (need.areaMin === undefined || l.area >= need.areaMin) && (need.areaMax === undefined || l.area <= need.areaMax);
  if (areaOk) {
    score += 20;
    reasons.push('متراژ');
  } else {
    misses.push('متراژ');
  }

  if (need.bedroomsMin === undefined || l.bedrooms >= need.bedroomsMin) {
    score += 10;
    reasons.push('خواب');
  } else {
    misses.push('خواب');
  }

  if (need.kinds.length === 0 || need.kinds.includes(l.kind)) score += 5;

  return { score, reasons, misses };
}

/** بهترین فایل‌ها برای یک نیاز، از بیشترین هم‌خوانی. */
export function bestMatches(listings: Listing[], need: ClientNeed, min = 60): Array<{ listing: Listing } & MatchResult> {
  return listings
    .filter((l) => l.status !== 'archived' && l.status !== 'closed')
    .map((listing) => ({ listing, ...matchListing(listing, need) }))
    .filter((m) => m.score >= min)
    .sort((a, b) => b.score - a.score);
}

export function describeMatch(m: MatchResult): string {
  if (m.reasons.length === 0) return '';
  const ok = m.reasons.filter((r) => r !== 'خواب').join('، ');
  return m.misses.length ? `${ok} جور است · ${m.misses[0]}` : `${ok} جور است`;
}
