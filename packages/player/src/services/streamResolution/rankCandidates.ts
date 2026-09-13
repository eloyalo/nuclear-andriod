import type { StreamCandidate, Track } from '@nuclearplayer/model';

const DURATION_TOLERANCE_MS = 7000;

const DURATION_CLOSE = 0;
const DURATION_UNKNOWN = 1;
const DURATION_FAR = 2;

const VARIANT_KEYWORDS = [
  'live',
  'en vivo',
  'directo',
  'cover',
  'karaoke',
  'instrumental',
  'remix',
  'rmx',
  'acoustic',
  'acustico',
  'nightcore',
  'sped up',
  'slowed',
  'reverb',
  '8d',
  'bass boosted',
  'reaction',
  'tutorial',
];

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

const stripQualifiers = (title: string): string =>
  title.replace(/\s*[([][^)\]]*[)\]]/g, '').split(' - ')[0];

const containsPhrase = (haystack: string, phrase: string): boolean =>
  ` ${haystack} `.includes(` ${phrase} `);

const isMismatch = (track: Track, candidateTitle: string): boolean => {
  const trackTitle = normalize(track.title);
  const coreTitle = normalize(stripQualifiers(track.title));

  if (coreTitle && !containsPhrase(candidateTitle, coreTitle)) {
    return true;
  }

  return VARIANT_KEYWORDS.some(
    (keyword) =>
      containsPhrase(candidateTitle, keyword) &&
      !containsPhrase(trackTitle, keyword),
  );
};

const isMissingArtist = (track: Track, candidateTitle: string): boolean => {
  const artists = track.artists
    .map((artist) => normalize(artist.name))
    .filter(Boolean);

  return (
    artists.length > 0 &&
    !artists.some((artist) => containsPhrase(candidateTitle, artist))
  );
};

const durationRank = (track: Track, candidate: StreamCandidate): number => {
  if (track.durationMs === undefined || candidate.durationMs === undefined) {
    return DURATION_UNKNOWN;
  }
  const difference = Math.abs(track.durationMs - candidate.durationMs);
  return difference <= DURATION_TOLERANCE_MS ? DURATION_CLOSE : DURATION_FAR;
};

export const rankCandidates = (
  track: Track,
  candidates: StreamCandidate[],
): StreamCandidate[] =>
  candidates
    .map((candidate) => {
      const candidateTitle = normalize(candidate.title);
      return {
        candidate,
        mismatch: isMismatch(track, candidateTitle) ? 1 : 0,
        missingArtist: isMissingArtist(track, candidateTitle) ? 1 : 0,
        duration: durationRank(track, candidate),
      };
    })
    .sort(
      (left, right) =>
        left.mismatch - right.mismatch ||
        left.missingArtist - right.missingArtist ||
        left.duration - right.duration,
    )
    .map(({ candidate }) => candidate);
