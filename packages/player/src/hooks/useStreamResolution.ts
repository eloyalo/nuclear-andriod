import { useEffect, useRef } from 'react';

import type { QueueItem } from '@nuclearplayer/model';

import { streamResolution } from '../services/streamResolution';
import { useQueueStore } from '../stores/queueStore';
import { useStreamRecovery } from './useStreamRecovery';

const buildResolutionKey = (item: QueueItem): string => {
  const headCandidate = item.track.streamCandidates?.[0];
  return [item.id, headCandidate?.id, headCandidate?.failed].join(':');
};

export const useStreamResolution = (): void => {
  const resolutionKeyRef = useRef<string | null>(null);
  // Only suppress autoplay for a queue item that was already current when
  // this hook mounted (a persisted queue restored on startup). If the queue
  // starts empty, the user's first manual play should autoplay normally.
  const isFirstResolutionRef = useRef(
    Boolean(useQueueStore.getState().getCurrentItem()),
  );

  useStreamRecovery();

  useEffect(() => {
    const onCurrentItemChanged = (currentItem: QueueItem | undefined): void => {
      if (!currentItem) {
        return;
      }

      const resolutionKey = buildResolutionKey(currentItem);
      if (resolutionKey === resolutionKeyRef.current) {
        return;
      }
      resolutionKeyRef.current = resolutionKey;

      if (currentItem.status === 'loading') {
        return;
      }

      const autoPlay = !isFirstResolutionRef.current;
      isFirstResolutionRef.current = false;
      void streamResolution.resolve(currentItem, { autoPlay });
    };

    const unsubscribe = useQueueStore.subscribe((state) => {
      onCurrentItemChanged(state.getCurrentItem());
    });

    onCurrentItemChanged(useQueueStore.getState().getCurrentItem());

    return unsubscribe;
  }, []);
};
