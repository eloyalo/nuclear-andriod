import { describe, expect, it } from 'vitest';

import type { StreamCandidate, Track } from '@nuclearplayer/model';

import { rankCandidates } from './rankCandidates';

const track = (
  title: string,
  durationMs?: number,
  artist = 'Artist',
): Track => ({
  title,
  artists: [{ name: artist, roles: [] }],
  durationMs,
  source: { provider: 'metadata', id: 'track-1' },
});

const candidate = (
  id: string,
  title: string,
  durationSeconds?: number,
): StreamCandidate => ({
  id,
  title,
  durationMs:
    durationSeconds === undefined ? undefined : durationSeconds * 1000,
  failed: false,
  source: { provider: 'youtube', id },
});

const rankedIds = (target: Track, candidates: StreamCandidate[]): string[] =>
  rankCandidates(target, candidates).map(({ id }) => id);

describe('rankCandidates', () => {
  it('keeps the provider order when every candidate fits', () => {
    const candidates = [
      candidate('first', 'Numb', 188),
      candidate('second', 'Linkin Park - Numb (Official Video)', 186),
    ];

    expect(rankedIds(track('Numb', 185_000), candidates)).toEqual([
      'first',
      'second',
    ]);
  });

  it('prefers a candidate whose duration matches the track', () => {
    const candidates = [
      candidate(
        'music-video',
        'Bad Bunny - Tití Me Preguntó (Official Video)',
        291,
      ),
      candidate('audio', 'Bad Bunny - Tití Me Preguntó', 244),
    ];

    expect(
      rankedIds(track('Tití Me Preguntó', 243_000, 'Bad Bunny'), candidates),
    ).toEqual(['audio', 'music-video']);
  });

  it('puts candidates with unknown duration between matching and mismatching ones', () => {
    const candidates = [
      candidate('far', 'Creep', 300),
      candidate('unknown', 'Creep'),
      candidate('close', 'Creep', 239),
    ];

    expect(rankedIds(track('Creep', 238_000), candidates)).toEqual([
      'close',
      'unknown',
      'far',
    ]);
  });

  it('demotes live, cover and remix versions the track is not', () => {
    const candidates = [
      candidate('live', 'Smells Like Teen Spirit (Live at Reading 1992)', 301),
      candidate('cover', 'Smells Like Teen Spirit - Piano Cover', 301),
      candidate('remix', 'Smells Like Teen Spirit (Remix)', 301),
      candidate('studio', 'Smells Like Teen Spirit', 302),
    ];

    expect(
      rankedIds(track('Smells Like Teen Spirit', 301_000), candidates)[0],
    ).toBe('studio');
  });

  it('keeps a variant when the track itself is that variant', () => {
    const candidates = [
      candidate('studio', 'Creep', 239),
      candidate('acoustic', 'Creep (Acoustic)', 259),
    ];

    expect(rankedIds(track('Creep - Acoustic', 259_000), candidates)).toEqual([
      'acoustic',
      'studio',
    ]);
  });

  it('demotes candidates that do not mention the track title', () => {
    const candidates = [
      candidate('other-song', 'Con Altura (feat. El Guincho)', 157),
      candidate('right-song', 'DESPECHÁ', 159),
    ];

    expect(rankedIds(track('DESPECHÁ', 157_000), candidates)).toEqual([
      'right-song',
      'other-song',
    ]);
  });

  it('ignores remaster and featuring qualifiers on the track title', () => {
    const candidates = [
      candidate('unrelated', 'Don’t Stop Me Now', 354),
      candidate(
        'match',
        'Queen – Bohemian Rhapsody (Official Video Remastered)',
        355,
      ),
    ];

    expect(
      rankedIds(
        track('Bohemian Rhapsody - Remastered 2011', 354_000),
        candidates,
      ),
    ).toEqual(['match', 'unrelated']);
  });

  it('matches titles regardless of accents and case', () => {
    const candidates = [
      candidate('unrelated', 'Something Else', 157),
      candidate('match', 'rosalia - despecha (letra)', 157),
    ];

    expect(rankedIds(track('DESPECHÁ', 157_000), candidates)[0]).toBe('match');
  });

  it('rejects a candidate whose duration is grossly longer than the track (e.g. a compilation video)', () => {
    const candidates = [
      candidate('compilation', 'XXXTENTACION - Rare (Full Album Mix)', 565),
      candidate('right-song', 'XXXTENTACION - Rare', 95),
    ];

    expect(
      rankedIds(track('Rare', 95_000, 'XXXTENTACION'), candidates),
    ).toEqual(['right-song']);
  });

  it('rejects an over-long candidate even when it is the only result', () => {
    const candidates = [candidate('compilation', 'XXXTENTACION - Rare', 565)];

    expect(
      rankedIds(track('Rare', 95_000, 'XXXTENTACION'), candidates),
    ).toEqual([]);
  });

  it("demotes other artists' versions of the same song", () => {
    const candidates = [
      candidate('panic', 'Panic! At The Disco - Bohemian Rhapsody', 362),
      candidate('live-aid', 'Queen - Bohemian Rhapsody (Live Aid)', 148),
      candidate(
        'portuguese-cover',
        'The Kira Justice - Bohemian Rhapsody (Em português)',
        353,
      ),
      candidate('sun-city', 'Queen - Bohemian Rhapsody', 335),
      candidate(
        'official-video',
        'Queen – Bohemian Rhapsody (Official Video Remastered)',
        360,
      ),
      candidate(
        'lyrics',
        'Queen — Bohemian Rhapsody (Sub. Español / Lyrics)',
        358,
      ),
    ];

    expect(
      rankedIds(
        track('Bohemian Rhapsody - Remastered 2011', 354_000, 'Queen'),
        candidates,
      ).slice(0, 3),
    ).toEqual(['official-video', 'lyrics', 'sun-city']);
  });
});
