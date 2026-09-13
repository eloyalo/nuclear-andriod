import type { QueueItem } from '@nuclearplayer/model';

import { useQueueStore } from '../../stores/queueStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSoundStore } from '../../stores/soundStore';
import {
  createMockCandidate,
  createMockStream,
  StreamingProviderBuilder,
} from '../../test/builders/StreamingProviderBuilder';
import { createQueueItem } from '../../test/fixtures/queue';
import { providersHost } from '../providersHost';
import { streamResolution } from './streamResolution';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(9100),
}));

const streamRequests: string[] = [];
const candidateSearches: string[] = [];

const itemById = (id: string) =>
  useQueueStore.getState().getItemById(id) as QueueItem;

describe('StreamResolution', () => {
  const current = createQueueItem('Track 1');
  const upcoming = createQueueItem('Track 2');

  beforeEach(() => {
    streamRequests.length = 0;
    candidateSearches.length = 0;

    providersHost.clear();
    providersHost.register(
      new StreamingProviderBuilder()
        .withSearchForTrack(async (_artist, title) => {
          candidateSearches.push(title);
          return [createMockCandidate(`yt-${title}`, title)];
        })
        .withGetStreamUrl(async (candidateId) => {
          streamRequests.push(candidateId);
          return createMockStream(candidateId);
        })
        .build(),
    );

    useSettingsStore.setState({ values: {} });
    useSoundStore.setState({ src: null, status: 'stopped', seek: 0 });
    useQueueStore.setState({ items: [current, upcoming], currentIndex: 0 });
  });

  it('plays a prepared track without asking the provider again', async () => {
    await streamResolution.prepare(itemById(upcoming.id));
    expect(streamRequests).toEqual(['yt-Track 2']);

    await streamResolution.resolve(itemById(upcoming.id), { autoPlay: true });

    expect(streamRequests).toEqual(['yt-Track 2']);
    expect(candidateSearches).toEqual(['Track 2']);
    expect(useSoundStore.getState().src?.url).toContain(
      '127.0.0.1:9100/stream/',
    );
    expect(itemById(upcoming.id).status).toBe('success');
  });

  it('shares a preparation that is still running when playback reaches the track', async () => {
    const preparation = streamResolution.prepare(itemById(upcoming.id));
    const playback = streamResolution.resolve(itemById(upcoming.id), {
      autoPlay: true,
    });

    await Promise.all([preparation, playback]);

    expect(streamRequests).toEqual(['yt-Track 2']);
    expect(itemById(upcoming.id).status).toBe('success');
  });

  it('looks for new candidates when the saved ones belong to another streaming provider', async () => {
    useQueueStore.getState().updateItemState(upcoming.id, {
      track: {
        ...upcoming.track,
        streamCandidates: [
          createMockCandidate('old-video', 'Track 2', {
            source: { provider: 'another-provider', id: 'old-video' },
            stream: createMockStream('old-video'),
            lastResolvedAtIso: new Date().toISOString(),
          }),
        ],
      },
    });

    await streamResolution.resolve(itemById(upcoming.id), { autoPlay: true });

    expect(candidateSearches).toEqual(['Track 2']);
    expect(streamRequests).toEqual(['yt-Track 2']);
    expect(itemById(upcoming.id).track.streamCandidates).toHaveLength(1);
    expect(itemById(upcoming.id).track.streamCandidates?.[0]?.id).toBe(
      'yt-Track 2',
    );
  });

  it('keeps saved candidates from the active provider', async () => {
    await streamResolution.prepare(itemById(upcoming.id));
    candidateSearches.length = 0;

    await streamResolution.resolve(itemById(upcoming.id), { autoPlay: true });

    expect(candidateSearches).toEqual([]);
  });
});
