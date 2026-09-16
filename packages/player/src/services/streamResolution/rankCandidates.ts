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
  'full ep',
  'ep completo',
  'complete album',
  'documentary',
  'documental',
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

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

// Track listings sourced from an album (as opposed to a search result) never
// carry a per-track duration (see TrackRef), so `track.durationMs` is
// routinely undefined there and the hard reject below would otherwise never
// fire for them. As a fallback, estimate an expected duration from the
// candidates' own durations, so a single long-form outlier (e.g. a
// multi-track compilation video) can still be caught even without a known
// track duration to compare against.
//
// Only candidates whose title actually matches the track feed the estimate:
// a real search result set is mostly unrelated long-form noise (documentaries,
// "complete album" uploads, "hardest songs" compilations) that drags a
// plain median far above the real song's duration, which is exactly when
// this estimate is needed most.
const inferReferenceDurationMs = (
  titleMatchedCandidates: StreamCandidate[],
): number | undefined => {
  const known = titleMatchedCandidates
    .map((candidate) => candidate.durationMs)
    .filter((value): value is number => value !== undefined);
  return known.length >= 2 ? median(known) : undefined;
};

const isDurationRejected = (
  track: Track,
  candidate: StreamCandidate,
  inferredReferenceDurationMs: number | undefined,
): boolean => {
  if (candidate.durationMs === undefined) {
    return false;
  }

  if (track.durationMs !== undefined) {
    const difference = Math.abs(track.durationMs - candidate.durationMs);
    const threshold = Math.max(
      DURATION_REJECT_FLOOR_MS,
      track.durationMs * DURATION_REJECT_RATIO,
    );
    return difference > threshold;
  }

  // No ground-truth track duration: only ever reject on the "too long"
  // side of the inferred reference. A candidate shorter than its peers is
  // never rejected this way, since the peer estimate has no ground truth
  // to justify penalizing it, and "too short" isn't the failure mode this
  // guards against.
  if (
    inferredReferenceDurationMs === undefined ||
    candidate.durationMs <= inferredReferenceDurationMs
  ) {
    return false;
  }
  const difference = candidate.durationMs - inferredReferenceDurationMs;
  // Scaled off the reference, never off the candidate: scaling off the
  // candidate would widen a long outlier's own tolerance in step with how
  // far off it is, which is self-defeating for the case this guards.
  const threshold = Math.max(
    DURATION_REJECT_FLOOR_MS,
    inferredReferenceDurationMs * DURATION_REJECT_RATIO,
  );
  return difference > threshold;
};

export const rankCandidates = (
  track: Track,
  candidates: StreamCandidate[],
): StreamCandidate[] => {
  const scored = candidates.map((candidate) => {
    const candidateTitle = normalize(candidate.title);
    return {
      candidate,
      mismatch: isMismatch(track, candidateTitle) ? 1 : 0,
      missingArtist: isMissingArtist(track, candidateTitle) ? 1 : 0,
      duration: durationRank(track, candidate),
    };
  });

  const inferredReferenceDurationMs =
    track.durationMs === undefined
      ? inferReferenceDurationMs(
          scored
            .filter(({ mismatch }) => mismatch === 0)
            .map(({ candidate }) => candidate),
        )
      : undefined;

  return scored
    .filter(
      ({ candidate }) =>
        !isDurationRejected(track, candidate, inferredReferenceDurationMs),
    )
    .sort(
      (left, right) =>
        left.mismatch - right.mismatch ||
        left.missingArtist - right.missingArtist ||
        left.duration - right.duration,
    )
    .map(({ candidate }) => candidate);
};
