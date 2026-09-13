import type { QueueItem } from '@nuclearplayer/model';

import { useQueueStore } from '../stores/queueStore';
import { getSetting } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import { streamResolution } from './streamResolution';

const PREPARE_AFTER_SECONDS = 15;

let unsubscribe: (() => void) | undefined;

export const upcomingItem = (): QueueItem | undefined => {
  const { items, currentIndex } = useQueueStore.getState();
  const shuffleEnabled = getSetting('core.playback.shuffle') as boolean;
  const repeatMode = getSetting('core.playback.repeat') as string;

  if (shuffleEnabled || repeatMode === 'one') {
    return undefined;
  }

  const nextIndex =
    currentIndex < items.length - 1
      ? currentIndex + 1
      : repeatMode === 'all'
        ? 0
        : undefined;

  if (nextIndex === undefined || nextIndex === currentIndex) {
    return undefined;
  }
  return items[nextIndex];
};

export const initNextTrackPreparation = () => {
  let preparedAfterItemId: string | undefined;

  unsubscribe = useSoundStore.subscribe((state) => {
    if (state.status !== 'playing' || state.seek < PREPARE_AFTER_SECONDS) {
      return;
    }

    const currentItem = useQueueStore.getState().getCurrentItem();
    if (!currentItem || currentItem.id === preparedAfterItemId) {
      return;
    }
    preparedAfterItemId = currentItem.id;

    const nextItem = upcomingItem();
    if (nextItem) {
      void streamResolution.prepare(nextItem);
    }
  });
};

export const resetNextTrackPreparationForTesting = () => {
  unsubscribe?.();
  unsubscribe = undefined;
};
