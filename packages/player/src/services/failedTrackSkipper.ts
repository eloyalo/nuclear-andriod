import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { Logger } from './logger';

const SKIP_DELAY_MS = 2000;
const MAX_CONSECUTIVE_SKIPS = 3;
const PLAYED_ENOUGH_SECONDS = 5;

let unsubscribers: Array<() => void> = [];
let pendingSkip: ReturnType<typeof setTimeout> | undefined;

export const initFailedTrackSkipper = () => {
  let listening = false;
  let consecutiveSkips = 0;
  let observedItemId = useQueueStore.getState().getCurrentItem()?.id;
  let observedStatus = useQueueStore.getState().getCurrentItem()?.status;

  const unsubscribeSound = useSoundStore.subscribe((state) => {
    if (state.status === 'playing') {
      listening = true;
    } else if (state.status === 'paused') {
      listening = false;
    }
    if (state.status === 'playing' && state.seek >= PLAYED_ENOUGH_SECONDS) {
      consecutiveSkips = 0;
    }
  });

  const unsubscribeQueue = useQueueStore.subscribe((state) => {
    const currentItem = state.getCurrentItem();
    const justFailed =
      currentItem !== undefined &&
      currentItem.id === observedItemId &&
      currentItem.status === 'error' &&
      observedStatus !== 'error';
    observedItemId = currentItem?.id;
    observedStatus = currentItem?.status;

    if (!listening || !justFailed) {
      return;
    }

    if (consecutiveSkips >= MAX_CONSECUTIVE_SKIPS) {
      Logger.playback.warn(
        `Stopped skipping after ${consecutiveSkips} tracks in a row failed to play`,
      );
      listening = false;
      return;
    }
    consecutiveSkips += 1;

    Logger.playback.warn(
      `'${currentItem.track.title}' failed to play; skipping to the next track`,
    );
    clearTimeout(pendingSkip);
    pendingSkip = setTimeout(() => {
      const stillFailed = useQueueStore.getState().getCurrentItem();
      if (
        stillFailed?.id === currentItem.id &&
        stillFailed.status === 'error'
      ) {
        useQueueStore.getState().goToNext();
      }
    }, SKIP_DELAY_MS);
  });

  unsubscribers = [unsubscribeSound, unsubscribeQueue];
};

export const resetFailedTrackSkipperForTesting = () => {
  clearTimeout(pendingSkip);
  unsubscribers.forEach((unsubscribeStore) => unsubscribeStore());
  unsubscribers = [];
};
