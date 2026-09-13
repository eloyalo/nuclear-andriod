import { invoke } from '@tauri-apps/api/core';

import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import { createQueueItem } from '../test/fixtures/queue';
import {
  initMediaSessionHandler,
  resetMediaSessionHandlerForTesting,
} from './mediaSessionHandler';
import { playbackManager } from './playback';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const updateCalls = () =>
  vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command === 'media_session_update');

const lastUpdate = () => updateCalls().at(-1)?.[1];

describe('mediaSessionHandler', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue(null);
    useSoundStore.setState({
      src: null,
      status: 'stopped',
      seek: 0,
      duration: 0,
    });
    useSettingsStore.setState({ values: {} });

    const first = createQueueItem('Track 1');
    const second = createQueueItem('Track 2');
    useQueueStore.setState({ items: [first, second], currentIndex: 0 });
    playbackManager.startTrack(
      first,
      { url: '/track.mp3', protocol: 'http' },
      { autoPlay: false },
    );

    initMediaSessionHandler();
  });

  afterEach(() => {
    resetMediaSessionHandlerForTesting();
    vi.clearAllMocks();
  });

  it('does not show the notification before anything has played', () => {
    useSoundStore.getState().updatePlayback(0, 180);

    expect(updateCalls()).toHaveLength(0);
  });

  it('publishes the current track once playback starts', () => {
    useSoundStore.getState().updatePlayback(0, 180);
    playbackManager.play();

    expect(lastUpdate()).toMatchInlineSnapshot(`
      {
        "nowPlaying": {
          "album": undefined,
          "artist": "Test Artist",
          "artworkUrl": undefined,
          "durationMs": 180000,
          "playing": true,
          "positionMs": 0,
          "title": "Track 1",
        },
      }
    `);
  });

  it('reports an unknown duration as zero while a stream is still loading', () => {
    useSoundStore.getState().updatePlayback(0, Infinity);
    playbackManager.play();

    expect(lastUpdate()).toMatchObject({ nowPlaying: { durationMs: 0 } });
  });

  it('keeps the notification as paused when playback pauses', () => {
    playbackManager.play();
    playbackManager.pause();

    expect(lastUpdate()).toMatchObject({ nowPlaying: { playing: false } });
  });

  it('publishes the new position after a seek', () => {
    playbackManager.play();
    useSoundStore.getState().seekTo(95);

    expect(lastUpdate()).toMatchObject({ nowPlaying: { positionMs: 95000 } });
  });

  it('clears the notification when the queue empties', () => {
    playbackManager.play();
    useQueueStore.getState().clearQueue();

    expect(invoke).toHaveBeenCalledWith('media_session_clear');
  });

  it('pauses and resumes from notification actions', () => {
    playbackManager.play();

    window.__nuclearMediaAction__?.('pause');
    expect(useSoundStore.getState().status).toBe('paused');

    window.__nuclearMediaAction__?.('play');
    expect(useSoundStore.getState().status).toBe('playing');
  });

  it('skips to the next track from a notification action', () => {
    window.__nuclearMediaAction__?.('next');

    expect(useQueueStore.getState().getCurrentItem()?.track.title).toBe(
      'Track 2',
    );
  });

  it('seeks from the lock screen scrubber', () => {
    window.__nuclearMediaAction__?.('seek', 42500);

    expect(useSoundStore.getState().seek).toBe(42.5);
  });
});
