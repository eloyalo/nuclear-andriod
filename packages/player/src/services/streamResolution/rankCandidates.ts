import type { StreamCandidate, Track } from '@nuclearplayer/model';

const DURATION_TOLERANCE_MS = 7000;

// A candidate is rejected outright (not just ranked lower) once its duration
// drifts this far from the track's — in both absolute and relative terms —
// so a short track can't be matched to a long compilation/loop video just
// because nothing else scored worse. The floor keeps very short tracks from
// being rejected by a tiny absolute gap; the ratio keeps very long tracks
// from being rejected by a proportionally small one.
const DURATION_REJECT_FLOOR_MS = 45_000;
const DURATION_REJECT_RATIO = 0.35;

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
  'full album',
  'album completo',
  'compilation',
  'compilado',
  'megamix',
  'mixtape',
  'greatest hits',
  'grandes exitos',
  'best of',
  'hour loop',
  'hours loop',
  'hour version',
  'no copyright',
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

const isDurationRejected = (
  track: Track,
  candidate: StreamCandidate,
): boolean => {
  if (track.durationMs === undefined || candidate.durationMs === undefined) {
    return false;
  }
  const difference = Math.abs(track.durationMs - candidate.durationMs);
  const threshold = Math.max(
    DURATION_REJECT_FLOOR_MS,
    track.durationMs * DURATION_REJECT_RATIO,
  );
  return difference > threshold;
};

export const rankCandidates = (
  track: Track,
  candidates: StreamCandidate[],
): StreamCandidate[] =>
  candidates
    .filter((candidate) => !isDurationRejected(track, candidate))
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
