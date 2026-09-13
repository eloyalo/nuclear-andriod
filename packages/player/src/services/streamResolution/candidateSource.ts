import type { StreamCandidate, Track } from '@nuclearplayer/model';

import { providersHost } from '../providersHost';
import { isStreamExpired, streamingHost } from '../streamingHost';

const isFromActiveProvider = (candidate: StreamCandidate): boolean =>
  candidate.source.provider === providersHost.getActive('streaming');

export const candidatesForTrack = async (
  track: Track,
): Promise<StreamCandidate[] | undefined> => {
  const cached = track.streamCandidates;
  if (
    cached?.length &&
    cached.every(isFromActiveProvider) &&
    !cached.some(isStreamExpired)
  ) {
    return cached;
  }

  const result = await streamingHost.resolveCandidatesForTrack(track);
  if (result.success) {
    return result.candidates;
  }
  return undefined;
};
