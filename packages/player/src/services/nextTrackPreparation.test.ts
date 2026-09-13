import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import {
  createMockCandidate,
  createMockStream,
  StreamingProviderBuilder,
} from '../test/builders/StreamingProviderBuilder';
import { createQueueItem } from '../test/fixtures/queue';
import {
  initNextTrackPreparation,
  resetNextTrackPreparationForTesting,
} from './nextTrackPreparation';
import { providersHost } from './providersHost';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(9100),
}));

const streamRequests: string[] = [];

const nextItem = () => useQueueStore.getState().items[1];

const playCurrentTrackFor = (seconds: number) =>
  useSoundStore.setState({ status: 'playing', seek: seconds, duration: 200 });

describe('nextTrackPreparation', () => {
  beforeEach(() => {
    streamRequests.length = 0;
    providersHost.clear();
    providersHost.register(
      new StreamingProviderBuilder()
        .withSearchForTrack(async (_artist, title) => [
          createMockCandidate(`yt-${title}`, title),
        ])
        .withGetStreamUrl(async (candidateId) => {
          streamRequests.push(candidateId);
          return createMockStream(candidateId);
        })
        .build(),
    );

    useSettingsStore.setState({ values: {} });
    useSoundStore.setState({ status: 'stopped', seek: 0, duration: 0 });
    useQueueStore.setState({
      items: [createQueueItem('Track 1'), createQueueItem('Track 2')],
      currentIndex: 0,
    });

    initNextTrackPreparation();
  });

  afterEach(() => {
    resetNextTrackPreparationForTesting();
  });

  it('resolves the next track once the current one has been playing for a while', async () => {
    playCurrentTrackFor(20);

    await vi.waitFor(() =>
      expect(nextItem().track.streamCandidates?.[0]?.stream).toBeDefined(),
    );
    expect(streamRequests).toEqual(['yt-Track 2']);
  });

  it('waits before preparing, so quick skips do not cost stream lookups', () => {
    playCurrentTrackFor(3);

    expect(streamRequests).toEqual([]);
    expect(nextItem().track.streamCandidates).toBeUndefined();
  });

  it('prepares the next track only once per track', async () => {
    playCurrentTrackFor(20);
    playCurrentTrackFor(21);
    playCurrentTrackFor(22);

    await vi.waitFor(() => expect(streamRequests).toHaveLength(1));
  });

  it('does not guess the next track when shuffle is on', () => {
    useSettingsStore.setState({ values: { 'core.playback.shuffle': true } });

    playCurrentTrackFor(20);

    expect(nextItem().track.streamCandidates).toBeUndefined();
  });
});
