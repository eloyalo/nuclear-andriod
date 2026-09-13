import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import { createQueueItem } from '../test/fixtures/queue';
import {
  initFailedTrackSkipper,
  resetFailedTrackSkipperForTesting,
} from './failedTrackSkipper';

const SKIP_DELAY_MS = 2000;

const currentTitle = () =>
  useQueueStore.getState().getCurrentItem()?.track.title;

const failCurrentTrack = () => {
  const current = useQueueStore.getState().getCurrentItem();
  useQueueStore
    .getState()
    .updateItemState(current!.id, { status: 'error', error: 'broken' });
};

describe('failedTrackSkipper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSettingsStore.setState({ values: {} });
    useSoundStore.setState({ status: 'stopped', seek: 0, duration: 0 });
    useQueueStore.setState({
      items: ['Track 1', 'Track 2', 'Track 3', 'Track 4', 'Track 5'].map(
        (title) => createQueueItem(title),
      ),
      currentIndex: 0,
    });

    initFailedTrackSkipper();
  });

  afterEach(() => {
    resetFailedTrackSkipperForTesting();
    vi.useRealTimers();
  });

  it('moves on to the next track when the current one fails while listening', () => {
    useSoundStore.getState().play();

    failCurrentTrack();
    vi.advanceTimersByTime(SKIP_DELAY_MS);

    expect(currentTitle()).toBe('Track 2');
  });

  it('does not mistake an old error on the track it moves to for a new failure', () => {
    const second = useQueueStore.getState().items[1];
    useQueueStore
      .getState()
      .updateItemState(second.id, { status: 'error', error: 'old' });
    useSoundStore.getState().play();

    useQueueStore.getState().goToNext();
    vi.advanceTimersByTime(SKIP_DELAY_MS);

    expect(currentTitle()).toBe('Track 2');
  });

  it('still skips when a track that had failed before fails again', () => {
    const second = useQueueStore.getState().items[1];
    useQueueStore
      .getState()
      .updateItemState(second.id, { status: 'error', error: 'old' });
    useSoundStore.getState().play();
    useQueueStore.getState().goToNext();

    useQueueStore.getState().updateItemState(second.id, { status: 'loading' });
    failCurrentTrack();
    vi.advanceTimersByTime(SKIP_DELAY_MS);

    expect(currentTitle()).toBe('Track 3');
  });

  it('stays put when nothing was playing yet', () => {
    failCurrentTrack();
    vi.advanceTimersByTime(SKIP_DELAY_MS);

    expect(currentTitle()).toBe('Track 1');
  });

  it('stays put when the listener had paused', () => {
    useSoundStore.getState().play();
    useSoundStore.getState().pause();

    failCurrentTrack();
    vi.advanceTimersByTime(SKIP_DELAY_MS);

    expect(currentTitle()).toBe('Track 1');
  });

  it('gives up after several tracks in a row fail, instead of draining the queue', () => {
    useSoundStore.getState().play();

    for (let skip = 0; skip < 4; skip++) {
      failCurrentTrack();
      vi.advanceTimersByTime(SKIP_DELAY_MS);
    }

    expect(currentTitle()).toBe('Track 4');
  });

  it('starts counting again once a track actually plays', () => {
    useSoundStore.getState().play();

    for (let skip = 0; skip < 3; skip++) {
      failCurrentTrack();
      vi.advanceTimersByTime(SKIP_DELAY_MS);
    }
    useSoundStore.getState().play();
    useSoundStore.getState().updatePlayback(30, 200);
    failCurrentTrack();
    vi.advanceTimersByTime(SKIP_DELAY_MS);

    expect(currentTitle()).toBe('Track 5');
  });
});
