import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { SoundProvider } from '../components/SoundProvider';
import { StreamResolver } from '../components/StreamResolver';
import { providersHost } from '../services/providersHost';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import {
  createMockCandidate,
  createMockStream,
  StreamingProviderBuilder,
} from '../test/builders/StreamingProviderBuilder';
import { createMockTrack } from '../test/utils/mockTrack';
import { StreamResolutionWrapper } from './StreamResolution.test-wrapper';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(9100),
}));

const SEARCH_DELAY_MS = 300;
const MEDIA_ERR_DECODE = 3;
const HAVE_ENOUGH_DATA = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Audio events from the previous track while the next one resolves', () => {
  let searches: string[];
  let streams: string[];
  let finishSearch: () => void;

  beforeEach(() => {
    searches = [];
    streams = [];

    useSettingsStore.getState().setValue('playback.streamExpiryMs', 3600000);
    useSettingsStore.getState().setValue('playback.streamResolutionRetries', 1);
    useSoundStore.setState({ src: null, status: 'stopped', seek: 0 });

    providersHost.clear();
    providersHost.register(
      new StreamingProviderBuilder()
        .withSearchForTrack(async (_artist, title) => {
          searches.push(title);
          await new Promise<void>((resolve) => {
            finishSearch = resolve;
            setTimeout(resolve, SEARCH_DELAY_MS * 10);
          });
          return [createMockCandidate(`yt-${title}`, title)];
        })
        .withGetStreamUrl(async (candidateId) => {
          streams.push(candidateId);
          return createMockStream(candidateId);
        })
        .build(),
    );

    useQueueStore.setState({
      items: [
        {
          id: 'playing',
          status: 'success',
          addedAtIso: '',
          track: {
            ...createMockTrack('Carry On'),
            streamCandidates: [
              createMockCandidate('yt-Carry On', 'Carry On', {
                stream: createMockStream('yt-Carry On'),
                lastResolvedAtIso: new Date().toISOString(),
              }),
            ],
          },
        },
        {
          id: 'next',
          status: 'idle',
          addedAtIso: '',
          track: createMockTrack('Fuck Love'),
        },
      ],
      currentIndex: 0,
      isReady: true,
      isLoading: false,
    });
  });

  const skipWhileOldAudio = async (
    misbehave: (audio: HTMLAudioElement) => void,
  ) => {
    render(
      <SoundProvider>
        <StreamResolver />
      </SoundProvider>,
    );
    await waitFor(() => expect(useSoundStore.getState().src).not.toBeNull());
    const oldAudio = document.querySelector('audio') as HTMLAudioElement;

    useQueueStore.getState().goToNext();
    await sleep(SEARCH_DELAY_MS / 3);
    misbehave(oldAudio);
    finishSearch();

    await waitFor(() =>
      expect(StreamResolutionWrapper.getCurrentQueueItem()?.status).toBe(
        'success',
      ),
    );
    await sleep(SEARCH_DELAY_MS);
  };

  it('resolves the next track once when the old audio says it can play', async () => {
    await skipWhileOldAudio((audio) =>
      audio.dispatchEvent(new Event('canplay')),
    );

    expect(searches).toEqual(['Fuck Love']);
    expect(streams).toEqual(['yt-Fuck Love']);
  });

  it('does not blame the next track for an error from the old audio', async () => {
    await skipWhileOldAudio((audio) => {
      Object.defineProperty(audio, 'error', {
        value: { code: MEDIA_ERR_DECODE, message: '' },
      });
      Object.defineProperty(audio, 'readyState', { value: HAVE_ENOUGH_DATA });
      audio.dispatchEvent(new Event('error'));
    });

    expect(searches).toEqual(['Fuck Love']);
    expect(
      StreamResolutionWrapper.getCurrentQueueItem()?.error,
    ).toBeUndefined();
  });
});
