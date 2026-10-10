import type { JellyfinItem } from '@/types/jellyfin';

// A Jellyfin episode may supply a generic Name ("Folge 4") even when
// EpisodeTitle or OriginalTitle contains the actual episode title.
const GENERIC = /^(?:(?:folge|episode|ep\.?|teil|part)\s*#?\s*\d+|s\d{1,2}\s*e\d{1,3}|\d+)$/i;
const PREFIX = /^(?:(?:folge|episode|ep\.?)\s*\d+|s\d{1,2}\s*e\d{1,3}|\d+\s*[.):])\s*[-:–—]\s*/i;
const NUMBER_PREFIX = /^\d+\s*[.):]\s*/;

function normalize(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function meaningful(value: string): boolean {
  return value.length > 0 && !GENERIC.test(value);
}

/** Prefer a real Jellyfin title; never invent episode metadata. */
export function episodeTitle(item: JellyfinItem): string {
  const candidates = [item.Name, item.EpisodeTitle, item.OriginalTitle]
    .map(normalize).filter(Boolean);
  for (const candidate of candidates) {
    const withoutPrefix = candidate.replace(PREFIX, '');
    if (meaningful(withoutPrefix)) return withoutPrefix;
    const noNumber = candidate.replace(NUMBER_PREFIX, '');
    if (meaningful(noNumber)) return noNumber;
  }
  if (item.IndexNumber != null) return `Folge ${item.IndexNumber}`;
  return candidates[0] ?? 'Folge';
}

/** Avoid "1. Folge 1", duplicated numbers and repeated S01E01 prefixes. */
export function episodeHeading(item: JellyfinItem): string {
  const title = episodeTitle(item);
  if (/^(?:folge|episode)\s*\d+$/i.test(title)) return title;
  return item.IndexNumber != null ? `${item.IndexNumber}. ${title}` : title;
}
