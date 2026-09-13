import React from 'react';

import './styles/pluginOverrides.css';

import App from './App';
import { initLogStream } from './hooks/useLogStream';
import { applyThemeFromSettingsIfAny } from './services/advancedThemeService';
import { startAdvancedThemeWatcher } from './services/advancedThemeWatcher';
import { initBridgeHandler } from './services/bridge/bridgeHandler';
import { registerBuiltInCoreSettings } from './services/coreSettings';
import { initDiscordHandler } from './services/discordHandler';
import { initDiscoveryService } from './services/discoveryService';
import { initFailedTrackSkipper } from './services/failedTrackSkipper';
import { initHistoryService } from './services/history';
import { initHttpApiHandler } from './services/httpApi';
import {
  applyLanguageFromSettings,
  initLanguageWatcher,
} from './services/languageService';
import { loadMarketplaceThemes } from './services/marketplaceThemeDirService';
import { initMcpHandler } from './services/mcp';
import { initMediaSessionHandler } from './services/mediaSessionHandler';
import { initMpdHandler } from './services/mpd';
import { initNextTrackPreparation } from './services/nextTrackPreparation';
import { initPlaybackEventBridge } from './services/playbackEventBridge';
import { hydratePluginsFromRegistry } from './services/plugins/pluginBootstrap';
import { ytdlpEnsureInstalled } from './services/tauri/commands';
import { initializeFavoritesStore } from './stores/favoritesStore';
import { initializePlaylistStore } from './stores/playlistStore';
import { initializeQueueStore } from './stores/queueStore';
import { initializeSettingsStore } from './stores/settingsStore';
import { initializeShortcutsStore } from './stores/shortcutsStore';
import { hydrateThemeStore } from './stores/themeStore';
import { useUpdaterStore } from './stores/updaterStore';
import { isAndroid, isMobile, skipOnMobile } from './utils/platform';

export const initPlayerApp = async (
  root: ReturnType<typeof import('react-dom/client').createRoot>,
) => {
  initLogStream();

  await initializeSettingsStore()
    .then(() => initializeShortcutsStore())
    .then(() => initializeQueueStore())
    .then(() => initializeFavoritesStore())
    .then(() => initializePlaylistStore())
    .then(() => registerBuiltInCoreSettings())
    .then(() => initDiscoveryService())
    .then(skipOnMobile(initMcpHandler))
    .then(skipOnMobile(initMpdHandler))
    .then(skipOnMobile(initHttpApiHandler))
    .then(() => initBridgeHandler())
    .then(skipOnMobile(initDiscordHandler))
    .then(() => initPlaybackEventBridge())
    .then(() => (isAndroid() ? initMediaSessionHandler() : undefined))
    .then(() => initNextTrackPreparation())
    .then(() => initFailedTrackSkipper())
    .then(() => initHistoryService())
    .then(() => applyLanguageFromSettings())
    .then(() => initLanguageWatcher())
    .then(() => startAdvancedThemeWatcher())
    .then(() => loadMarketplaceThemes())
    .then(() => hydrateThemeStore())
    .then(() => applyThemeFromSettingsIfAny())
    .then(() => {
      void hydratePluginsFromRegistry();
      if (!isMobile()) {
        void useUpdaterStore.getState().checkForUpdate();
        void ytdlpEnsureInstalled();
      }
    });

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};
