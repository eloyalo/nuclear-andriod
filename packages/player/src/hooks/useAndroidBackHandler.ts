import { useEffect, useRef } from 'react';

import { isMobile } from '../utils/platform';

declare global {
  interface Window {
    __nuclearOnBack__?: () => boolean;
  }
}

/**
 * Lets the Android back button dismiss whatever overlay is on top before it
 * navigates.
 *
 * `MainActivity.kt` asks `window.__nuclearOnBack__()` on every back press and
 * only falls back to `webView.goBack()` (which TanStack Router turns into a
 * route back) when it returns `false`. Going through the Android side rather
 * than a router blocker matters on the first screen after launch: there is no
 * WebView history yet, so back would otherwise close the app while a drawer is
 * still open.
 *
 * `onBack` should dismiss the topmost overlay and return `true`, or return
 * `false` to let the navigation through.
 */
export const useAndroidBackHandler = (onBack: () => boolean) => {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (!isMobile()) {
      return;
    }

    window.__nuclearOnBack__ = () => handlerRef.current();
    return () => {
      delete window.__nuclearOnBack__;
    };
  }, []);
};
