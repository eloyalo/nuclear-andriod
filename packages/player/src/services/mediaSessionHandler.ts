import { invoke } from '@tauri-apps/api/core';

import type { SoundStatus } from '@nuclearplayer/hifi';
import { formatArtistNames } from '@nuclearplayer/model';

import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { errorMessage } from '../utils/errorMessage';
import { secondsToMs } from '../utils/time';
import { Logger } from './logger';
import { playbackManager } from './playback';

export type MediaAction = 'play' | 'pause' | 'next' | 'previous' | 'seek';

declare global {
  interface Window {
    __nuclearMediaAction__?: (action: MediaAction, positionMs?: number) => void;
  }
}

const SEEK_JUMP_THRESHOLD_SECONDS = 2;

let hasPlayed = false;
let unsubscribers: Array<() => void> = [];

const toWholeMs = (seconds: number) =>
  Number.isFinite(seconds) ? Math.round(secondsToMs(seconds)) : 0;

const syncNowPlaying = () => {
  const currentItem = useQueueStore.getState().getCurrentItem();
  const { status, seek, duration } = useSoundStore.getState();

  if (!currentItem) {
    hasPlayed = false;
    invoke('media_session_clear').catch((err) =>
      Logger.playback.warn(
        `Failed to clear media session: ${errorMessage(err)}`,
      ),
    );
    return;
  }

  if (status === 'playing') {
    hasPlayed = true;
  }
  if (!hasPlayed) {
    return;
  }

  const { track } = currentItem;
  invoke('media_session_update', {
    nowPlaying: {
      title: track.title,
      artist: formatArtistNames(track.artists),
      album: track.album?.title,
      artworkUrl: track.artwork?.items[0]?.url,
      playing: status === 'playing',
      positionMs: toWholeMs(seek),
      durationMs: toWholeMs(duration),
    },
  }).catch((err) =>
    Logger.playback.warn(
      `Failed to update media session: ${errorMessage(err)}`,
    ),
  );
};

const handleMediaAction = (action: MediaAction, positionMs?: number) => {
  switch (action) {
    case 'play':
      playbackManager.play();
      break;
    case 'pause':
      playbackManager.pause();
      break;
    case 'next':
      useQueueStore.getState().goToNext();
      break;
    case 'previous':
      useQueueStore.getState().goToPrevious();
      break;
    case 'seek':
      useSoundStore.getState().seekTo((positionMs ?? 0) / 1000);
      break;
  }
};

const watchPlayback = () => {
  let previousItemId = useQueueStore.getState().getCurrentItem()?.id;
  let previousStatus: SoundStatus = useSoundStore.getState().status;
  let previousDuration = useSoundStore.getState().duration;
  let previousSeek = useSoundStore.getState().seek;

  const unsubscribeQueue = useQueueStore.subscribe((state) => {
    const currentItem = state.getCurrentItem();
    if (currentItem?.id !== previousItemId) {
      previousItemId = currentItem?.id;
      syncNowPlaying();
    }
  });

  const unsubscribeSound = useSoundStore.subscribe((state) => {
    const statusChanged = state.status !== previousStatus;
    const durationChanged = state.duration !== previousDuration;
    const seekJumped =
      Math.abs(state.seek - previousSeek) > SEEK_JUMP_THRESHOLD_SECONDS;

    previousStatus = state.status;
    previousDuration = state.duration;
    previousSeek = state.seek;

    if (statusChanged || durationChanged || seekJumped) {
      syncNowPlaying();
    }
  });

  unsubscribers = [unsubscribeQueue, unsubscribeSound];
};

export const initMediaSessionHandler = () => {
  window.__nuclearMediaAction__ = handleMediaAction;
  watchPlayback();
};

export const resetMediaSessionHandlerForTesting = () => {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  hasPlayed = false;
  delete window.__nuclearMediaAction__;
};
