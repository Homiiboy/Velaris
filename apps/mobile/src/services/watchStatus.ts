import type { JellyfinItem } from '@/types/jellyfin';

export function isWatched(item: JellyfinItem): boolean {
  // Jellyfin aggregates UserData.Played for Series and Season when complete.
  return item.UserData?.Played === true;
}

// For detail screens, verify every episode explicitly: a season or series is
// only finished when there are episodes and EVERY returned episode is played.
export function allEpisodesWatched(episodes: JellyfinItem[]): boolean {
  return episodes.length > 0 && episodes.every(isWatched);
}

export function watchedLabel(item: JellyfinItem): string | null {
  if (!isWatched(item)) return null;
  if (item.Type === 'Series') return 'Serie gesehen';
  if (item.Type === 'Season') return 'Staffel gesehen';
  if (item.Type === 'Episode') return 'Folge gesehen';
  if (item.Type === 'Movie') return 'Gesehen';
  return null;
}
