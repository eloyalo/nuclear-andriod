use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{Manager, Wry};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    title: String,
    artist: String,
    album: Option<String>,
    artwork_url: Option<String>,
    playing: bool,
    position_ms: u32,
    duration_ms: u32,
}

pub struct MediaSession(Option<PluginHandle<Wry>>);

pub fn init() -> TauriPlugin<Wry> {
    Builder::new("media-session")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let handle =
                Some(api.register_android_plugin("com.nuclearplayer", "MediaSessionPlugin")?);
            #[cfg(not(target_os = "android"))]
            let handle = {
                let _ = api;
                None
            };

            app.manage(MediaSession(handle));
            Ok(())
        })
        .build()
}

#[tauri::command]
#[specta::specta]
pub async fn media_session_update(
    session: tauri::State<'_, MediaSession>,
    now_playing: NowPlaying,
) -> Result<(), String> {
    run(&session, "update", now_playing).await
}

#[tauri::command]
#[specta::specta]
pub async fn media_session_clear(session: tauri::State<'_, MediaSession>) -> Result<(), String> {
    run(&session, "clear", serde_json::json!({})).await
}

async fn run(session: &MediaSession, command: &str, payload: impl Serialize) -> Result<(), String> {
    let Some(handle) = &session.0 else {
        return Ok(());
    };

    handle
        .run_mobile_plugin_async::<serde_json::Value>(command, payload)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}
