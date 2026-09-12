import { useCallback, useSyncExternalStore } from 'react';

const getMediaQueryList = (query: string): MediaQueryList | null => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }
  return window.matchMedia(query) ?? null;
};

export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = getMediaQueryList(query);
      if (typeof list?.addEventListener !== 'function') {
        return () => {};
      }
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => getMediaQueryList(query)?.matches ?? false,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
