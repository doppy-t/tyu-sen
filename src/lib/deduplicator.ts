import type { Listing } from './types';

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '').trim();
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length >= nb.length ? na : nb;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter.slice(i, i + 3))) matches++;
  }
  return matches / Math.max(shorter.length, 1);
}

function bodySimilarity(a: string, b: string): number {
  const na = normalizeText(a).slice(0, 200);
  const nb = normalizeText(b).slice(0, 200);
  if (na === nb) return 1;
  const wordsA = new Set(na.match(/.{2,}/g) ?? []);
  const wordsB = new Set(nb.match(/.{2,}/g) ?? []);
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  isSimilar: boolean;
  similarGroupId: string | null;
  matchedListingId: number | null;
}

export function checkDuplicate(
  newListing: Pick<Listing, 'store_name' | 'product_name' | 'application_deadline' | 'title' | 'source_url' | 'excerpt'>,
  existing: Listing[]
): DuplicateCheckResult {
  for (const ex of existing) {
    if (newListing.source_url && ex.source_url === newListing.source_url) {
      return { isDuplicate: true, isSimilar: false, similarGroupId: ex.similar_group_id, matchedListingId: ex.id };
    }

    const sameStore = normalizeText(newListing.store_name) === normalizeText(ex.store_name);
    const sameDeadline = newListing.application_deadline && ex.application_deadline
      && newListing.application_deadline === ex.application_deadline;
    const sameProduct = newListing.product_name !== '不明' && ex.product_name !== '不明'
      && normalizeText(newListing.product_name) === normalizeText(ex.product_name);

    const tSim = titleSimilarity(newListing.title, ex.title);
    const bSim = bodySimilarity(newListing.excerpt, ex.excerpt);

    if (sameStore && sameProduct && sameDeadline && tSim > 0.6) {
      return { isDuplicate: true, isSimilar: false, similarGroupId: ex.similar_group_id ?? `group-${ex.id}`, matchedListingId: ex.id };
    }

    if ((sameStore || sameProduct) && (tSim > 0.5 || bSim > 0.4) && (sameDeadline || tSim > 0.7)) {
      const groupId = ex.similar_group_id ?? `group-${ex.id}`;
      return { isDuplicate: false, isSimilar: true, similarGroupId: groupId, matchedListingId: ex.id };
    }
  }

  return { isDuplicate: false, isSimilar: false, similarGroupId: null, matchedListingId: null };
}

export function findSimilarListings(listing: Listing, all: Listing[]): Listing[] {
  return all.filter((other) => {
    if (other.id === listing.id) return false;
    if (listing.similar_group_id && other.similar_group_id === listing.similar_group_id) return true;
    const tSim = titleSimilarity(listing.title, other.title);
    const sameStore = normalizeText(listing.store_name) === normalizeText(other.store_name);
    return sameStore && tSim > 0.5;
  });
}
