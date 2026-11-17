// Library search is a view-level name filter, so matching stays pure and
// allocation-light. Tokens are ANDed; diacritics are folded so "cafe" still
// matches "café" regardless of the active locale.

export interface LibrarySearchQuery {
  tokens: string[];
}

const DIACRITICS = /[\u0300-\u036f]/g;

export function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLocaleLowerCase();
}

export function parseLibrarySearch(query: string): LibrarySearchQuery {
  const trimmed = query.trim();
  return {
    tokens:
      trimmed.length > 0 ? trimmed.split(/\s+/).map(normalizeForSearch) : [],
  };
}

export function matchesLibrarySearch(
  name: string,
  query: LibrarySearchQuery,
): boolean {
  if (query.tokens.length === 0) return true;
  const normalized = normalizeForSearch(name);
  return query.tokens.every((token) => normalized.includes(token));
}
