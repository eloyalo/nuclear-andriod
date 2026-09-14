# Nuclear on Android

This branch (`feat/android-port`) adds Android as a target platform, using
Tauri v2's mobile support. It reuses the existing React frontend and Rust
backend almost entirely — the changes are about what had to be swapped out,
guarded, or added to make the same app run inside an Android WebView and
process instead of a desktop window.

**Status: working, on the emulator and on a real phone.** The app installs,
plays music from several sources including YouTube, keeps playing in the
background with a real notification and lock-screen controls, and has a
phone-sized layout. Most of the measurements below come from the
`nuclear_api36` x86_64 emulator, but the build has also gone on a physical
Android 13 device: Bluetooth output, screen-locked playback, notification
controls — all worked, no crashes. That pass was quick and not exhaustive,
so treat the emulator numbers as the detailed evidence and the phone as
confirmation the same behavior holds on real hardware.

## Architecture, unchanged

Nuclear is a pnpm/turbo monorepo: a React + TanStack Router frontend
(`packages/player/src`) talking to a Rust backend (`packages/player/src-tauri`)
through Tauri's `invoke()`, with audio playback (`packages/hifi`) running
entirely inside the webview via the Web Audio API, `<audio>`, and MediaSource
Extensions/`hls.js` — not in Rust. Plugins consume a stable API
(`packages/plugin-sdk`) that's already decoupled from the backend
implementation. That decoupling is what made this port tractable: swapping
out a backend piece (like the YouTube source, see below) didn't require
touching the plugin contract or the frontend that consumes it.

## What had to change, and why

### 1. yt-dlp can't run on Android

The biggest blocker. `ytdlp.rs` downloads the yt-dlp binary at runtime and
shells out to it (`std::process::Command`). Android doesn't allow executing
arbitrary downloaded binaries — that's a sandboxing restriction, not just a
Play Store policy. Since it's the backend for 4 plugins (YouTube,
NuclearTube, YouTube Playlists, NetEase streaming), this had to be solved to
get any real content playing.

**Path taken:** replaced yt-dlp with [`rustypipe`](https://codeberg.org/ThetaDev/rustypipe)
(a pure-Rust YouTube/Innertube client, GPL-3.0, compatible with Nuclear's
AGPL-3.0) for search, gated behind `cfg(mobile)` — desktop keeps yt-dlp
unchanged, since it already works well there and rustypipe's playlist support
doesn't work at all (tested against three different playlist IDs and
`music_playlist`, all fail with extraction errors upstream).

Stream resolution took an extra turn: rustypipe's own player URLs (client
`Ios`) only serve the first ~1MB before returning 403 — YouTube restricts
full-file access without a PO token, and the clients that avoid that
restriction need designification that rustypipe currently can't do. The fix
was to bypass rustypipe for streaming and call YouTube's `player` endpoint
directly with the `VISIONOS` client (the same one yt-dlp currently picks),
which still returns full, un-obfuscated URLs without a PO token. That's a new
module, `src-tauri/src/innertube.rs`, with the pure parsing logic (extracting
`visitorData`, picking the best audio track) split into `youtube_query.rs` so
it's unit-testable. This is inherently fragile — it works because YouTube
hasn't started requiring a PO token for that client yet. If it does, this
will need to move to whatever client yt-dlp switches to (checking its stream
URL's `c=` parameter is the fast way to tell).

`ytdlp_get_playlist` has no replacement and returns an explicit "not
available on this platform" error on Android; the `youtube-playlists` plugin
just doesn't work there. Nothing else was blocked by this — the command
surface consumed by the frontend (`ytdlpHost.ts` / `plugin-sdk`) never
changed, only `ytdlp.rs`'s internals, conditionally per platform.

### 2. HTTPS requests from Rust hung forever

A second, unrelated blocker, found while testing plugin installation:
tapping "Install" would sit on "Installing…" indefinitely, with no error in
the log. The actual cause was hidden — Rust panics on Android are tagged
`RustStdoutStderr` in logcat, the same tag as the emulator's OpenGL noise, so
the panic was being filtered out by the log grep being used at the time.

With unfiltered logs, the real error showed: `reqwest` 0.13's TLS backend
(`rustls-platform-verifier`) needs a JVM `Context` via JNI on Android, and
without one it panics inside hyper's connection task instead of returning an
error — so the `await` just hangs. This wasn't scoped to plugin installs; it
would have broken every HTTPS call from Rust, including the audio stream
proxy.

**Path taken:** rather than initializing the platform verifier (which would
have required shipping and Maven-publishing an extra Kotlin/`.aar` component
tied to a generated Gradle project), a new `src/tls.rs` builds an explicit
`rustls::ClientConfig` with compiled-in `webpki-roots` on Android only, via
`reqwest`'s `tls_backend_preconfigured`. Desktop's client builder is
untouched. The tradeoff: Android can no longer trust user- or
enterprise-installed CAs for Rust's own HTTP calls (the webview's own traffic
is unaffected), and the CA bundle needs a `cargo update -p webpki-roots`
periodically. Acceptable for a music player.

### 3. Background playback and lock-screen controls

Tauri has no built-in support for this, and the two third-party plugins that
looked promising both turned out to be the wrong shape once tried in
practice:

- `tauri-plugin-native-audio` (ExoPlayer-based) would have meant replacing
  `hifi` as the audio engine on Android and reimplementing its Web Audio
  effects chain (equalizer, biquad filters, stereo, crossfade) in Kotlin —
  ruled out once MSE/`hls.js` were confirmed working in the Android WebView
  (see below), since there was no longer a reason to abandon `hifi`.
- `tauri-plugin-music-notification` looked like the lighter option, but it
  turned out to *play audio itself from a URL* rather than sitting on top of
  whatever's already playing — it doesn't coexist with `hifi`.

**Path taken:** a small first-party Kotlin plugin
(`MediaSessionPlugin.kt` + `MediaPlaybackService.kt` in `gen/android`) that
only adds a `MediaSessionCompat`, a `MediaStyle` foreground-service
notification, and forwards lock-screen/headset actions back into the
frontend the same way the Android back button is bridged. It stays
foregrounded through pauses too, since Android 12+ won't let a background
process restart a foreground service. Bridged from Rust via
`src/media_session.rs` and consumed by `services/mediaSessionHandler.ts`.

One regression along the way: the first version requested audio focus from
Kotlin, which fought with Chromium's own focus request for the `<audio>`
element and paused playback within milliseconds of starting. Fixed by simply
not requesting focus natively — Chromium already does it for the WebView's
audio.

Measured on the emulator: playback survives 90+ seconds backgrounded, 75s
paused-then-resumed, and queue advancement while hidden, all confirmed with
`dumpsys` state rather than trusting the UI's own timer (which keeps
"counting" even when the process is frozen and audio has stopped).

### 4. Confirming the WebView could actually do adaptive streaming

This was the gating question for everything else: if MSE/`hls.js` didn't
work reliably in Android's system WebView, `hifi` would need replacing
entirely. It does work — verified via the WebView's own DevTools Protocol
(no desktop Chrome needed, just `adb forward` to the webview's devtools
socket): `MediaSource.isTypeSupported` returns true for AAC, Opus, MP3 and
FLAC, and a real HLS stream (SoundCloud) buffers and plays with zero errors.
That result is what closed off the ExoPlayer path above.

### 5. Google intermittently blocking YouTube requests

Once YouTube played, a different problem showed up during testing: bursts of
skips would trigger `https://www.google.com/sorry/...` — Google's
IP-reputation throttle, unrelated to login or ads. It clears after a few
minutes on its own, but a naive retry loop made it worse: each rejected
candidate was retried 3× by the streaming host × 2× by the internal
Innertube client, and the queue would keep moving to the next track and
repeating the same pattern, turning a handful of skips into dozens of
requests within a minute.

**Path taken**, several independent fixes that also improved desktop
behavior:

- Detect the block explicitly and back off from YouTube for 2 minutes
  instead of retrying (`innertube.rs`).
- One important correction mid-way: the block detector originally treated
  age-restricted videos (`LOGIN_REQUIRED: Sign in to confirm your age`) as
  the same signal as an IP block (`LOGIN_REQUIRED: Sign in to confirm you're
  not a bot`) — both start with the same truncated logcat line. A single
  age-restricted candidate was enough to trigger the full 2-minute pause.
  Fixed by requiring the specific "not a bot" reason text.
- Prepare the next track ~15 seconds before the current one ends, so a skip
  reuses an already-resolved stream instead of firing a fresh search + player
  request in the moment (measured: 1.4s to next audio, zero new requests).
- Fixed a duplicate-resolution bug where a stale `canplay`/`error` event from
  the *previous* track's still-loading `<audio>` element was being
  misattributed to the *current* track, triggering a second, redundant
  resolution for every skip. This existed before the Android work but is far
  more visible there, since every duplicate request counts against the same
  IP throttle.
- Skip a track that fails to resolve, capped at 3 consecutive failures so a
  bad run of the queue doesn't empty it.

None of this eliminates the throttle — that would need signing into a
Google account or generating PO tokens, both explicitly avoided as
disproportionate for a v1. It's meaningfully rarer now. Further mitigations
are listed as open follow-ups below.

### 6. The rest: platform gating and layout

- Desktop-only integrations (MPD server, MCP server, local HTTP API, Discord
  Rich Presence, the yt-dlp auto-updater) are compiled out on mobile with
  `#[cfg(desktop)]`, including their Tauri command lists — none of them make
  sense inside an Android sandbox.
- A compact layout activates by **viewport width** (`<640px`), not platform
  detection, so it's exercised only on phones and never on desktop (whose
  window has a 660px minimum) or in tests. Sidebars become overlay drawers,
  the top bar and player bar drop to their essential controls, and the
  settings panel becomes a full-screen dialog — it used to be a fixed-width
  dialog with a 224px side nav that left ~105px for content on a real phone
  viewport, cutting text to one word per line.
- Window insets (status bar / nav bar height) and the Android back button
  both needed native code in `MainActivity.kt`, because neither has a
  pure-web solution here: Chromium's `env(safe-area-inset-*)` only reflects
  the display cutout on this WebView, not the system bars (measured 0 where
  the bars actually took 63px), and intercepting back button presses in
  the frontend router alone misses the very first screen after launch, where
  there's no WebView history yet and Android closes the activity before any
  JS ever sees the event.

## What's verified, what isn't

**Verified on the emulator:** settings/SQLite persistence, the plugin store,
installing and playing Bandcamp/SoundCloud(HLS)/KHInsider, YouTube via
NuclearTube (search + stream, without yt-dlp), background playback with
notification and external controls (simulated via `adb`, not real hardware),
desktop is unaffected (691 player tests, `ui` tests, type-check and lint all
still pass).

**Verified on a physical Android 13 phone:** Bluetooth audio output,
playback with the screen locked, and notification/lock-screen controls — all
worked on a first quick pass, no crashes. Doze, manufacturer battery
optimization over longer stretches, and incoming calls haven't been tried
yet.

**Not yet done:**
- No signed release build; the debug APK is ~600MB (debug symbols).
- `youtube-playlists` plugin can't work (no playlist replacement).
- `nuclear-plugin-youtube` and NetEase streaming should work via the same
  `cfg(mobile)` path but haven't been re-tested in the app since it landed.
- A handful of mobile UI rough edges: the track table's title column (which
  doubles as the play button) is cramped on phone width; the
  `nuclear-mini-player` plugin panel overlaps the navigation drawer; a track
  occasionally doesn't autoplay after being queued and needs a manual tap
  (root cause not yet found — confirmed it isn't Android's autoplay-gesture
  policy, since that's already disabled on this WebView).

## Trying it

```fish
emulator -avd nuclear_api36 &
pnpm --filter @nuclearplayer/player tauri android dev   # hot-reload, like desktop `tauri dev`
```

or build just the APK — `x86_64` for the emulator, `aarch64` for a real phone:

```fish
pnpm --filter @nuclearplayer/player tauri android build --debug --apk --target aarch64
adb install -r packages/player/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

## Open questions for review

1. **`gen/android` is committed**, not gitignored. It's Tauri-generated
   scaffolding, but `MainActivity.kt`, `MediaSessionPlugin.kt` and
   `MediaPlaybackService.kt` inside it carry real hand-written code (insets,
   back button, media session) that would be lost by regenerating the
   project — committing was the safer default, but worth confirming that's
   the convention wanted here.
2. **Which YouTube provider to recommend on Android.** NuclearTube works,
   but scrapes `youtube.com/results` HTML for search, which is the most
   bot-like traffic pattern of anything hitting YouTube here. Worth trying
   `nuclear-plugin-youtube` (uses the search API already exposed to plugins)
   before settling on a default.
3. **Do MPD/MCP/the local HTTP API stay desktop-only permanently**, or is
   there a future where something equivalent makes sense on mobile?
4. **The next-track preparation, failed-track skip, and stale-event fixes
   (§5, §6) also change desktop's behavior**, not just Android's — they're
   general improvements, but a reviewer going through this diff should know
   they're not mobile-gated.

## Known traps (for whoever picks this up next)

- Rust panics on Android are tagged `RustStdoutStderr` in logcat — the same
  tag the emulator uses for OpenGL noise. Filter out `s_glBindAttrib`, never
  filter *for* the tag itself, or a real panic disappears into the noise
  (this is exactly how the TLS hang in §2 was missed at first).
- `reqwest`'s `tls_backend_preconfigured` wraps its argument in `Some(...)`
  internally — passing `Some(config)` compiles but fails at runtime.
- The WebView is debuggable without desktop Chrome:
  `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`, then
  the DevTools Protocol over that socket.
- Don't trust the UI's playback timer to mean audio is actually flowing —
  with the process frozen in the background, it can keep "counting" for a
  while. Check `isFrozen` in `dumpsys activity processes com.nuclearplayer`,
  or `dumpsys audio` for the actual player state.
- Don't request audio focus from Kotlin — Chromium already requests it for
  the `<audio>` element, and two requests from the same process cancel each
  other out (playback pauses immediately after starting).
- `LOGIN_REQUIRED` alone doesn't mean an IP block — check the `reason`
  field. Read the whole logcat line before concluding anything: truncated,
  a bot-check and an age restriction start with the same text
  ("Sign in to confir…").
