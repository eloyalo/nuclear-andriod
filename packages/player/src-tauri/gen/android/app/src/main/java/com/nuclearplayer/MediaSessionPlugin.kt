package com.nuclearplayer

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import android.webkit.WebView
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.net.URL
import java.util.concurrent.Executors

@InvokeArg
class NowPlaying {
  lateinit var title: String
  lateinit var artist: String
  var album: String? = null
  var artworkUrl: String? = null
  var playing: Boolean = false
  var positionMs: Long = 0
  var durationMs: Long = 0
}

// The audio itself keeps playing inside the WebView (hifi). This plugin only
// adds what Android needs around it: a MediaSession for the notification, lock
// screen and headset buttons, and the foreground service that stops the process
// from being frozen once the app leaves the screen.
//
// Audio focus is deliberately left out: Chromium's AudioFocusDelegate already
// requests it for the <audio> element, and a second request from here makes the
// two steal focus from each other the moment playback starts.
@TauriPlugin
class MediaSessionPlugin(private val activity: Activity) : Plugin(activity) {
  private val context = activity.applicationContext
  private val mainHandler = Handler(Looper.getMainLooper())
  private val artworkLoader = Executors.newSingleThreadExecutor()

  private var webView: WebView? = null
  private var nowPlaying: NowPlaying? = null
  private var artworkUrl: String? = null
  private var artwork: Bitmap? = null
  private var noisyReceiverRegistered = false

  private val session = MediaSessionCompat(context, "Nuclear").apply {
    setCallback(object : MediaSessionCompat.Callback() {
      override fun onPlay() = dispatch("play")
      override fun onPause() = dispatch("pause")
      override fun onStop() = dispatch("pause")
      override fun onSkipToNext() = dispatch("next")
      override fun onSkipToPrevious() = dispatch("previous")
      override fun onSeekTo(pos: Long) = dispatch("seek", pos)
    })
  }

  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
        dispatch("pause")
      }
    }
  }

  override fun load(webView: WebView) {
    this.webView = webView
    MediaPlaybackService.session = session
  }

  @Command
  fun update(invoke: Invoke) {
    val args = invoke.parseArgs(NowPlaying::class.java)
    mainHandler.post { show(args) }
    invoke.resolve()
  }

  @Command
  fun clear(invoke: Invoke) {
    mainHandler.post { hide() }
    invoke.resolve()
  }

  override fun onDestroy() {
    hide()
    session.release()
    artworkLoader.shutdownNow()
  }

  private fun show(state: NowPlaying) {
    nowPlaying = state
    loadArtwork(state.artworkUrl)

    session.setMetadata(metadataFor(state))
    session.setPlaybackState(playbackStateFor(state))
    session.isActive = true

    if (state.playing) {
      registerNoisyReceiver()
    } else {
      unregisterNoisyReceiver()
    }

    MediaPlaybackService.show(context, PlaybackNotification.build(context, session, state, artwork))
  }

  private fun hide() {
    nowPlaying = null
    unregisterNoisyReceiver()
    session.isActive = false
    MediaPlaybackService.hide(context)
  }

  private fun metadataFor(state: NowPlaying): MediaMetadataCompat =
    MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, state.title)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, state.artist)
      .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, state.album)
      .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, state.durationMs)
      .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
      .build()

  private fun playbackStateFor(state: NowPlaying): PlaybackStateCompat =
    PlaybackStateCompat.Builder()
      .setActions(
        PlaybackStateCompat.ACTION_PLAY or
          PlaybackStateCompat.ACTION_PAUSE or
          PlaybackStateCompat.ACTION_PLAY_PAUSE or
          PlaybackStateCompat.ACTION_STOP or
          PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
          PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
          PlaybackStateCompat.ACTION_SEEK_TO
      )
      .setState(
        if (state.playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
        state.positionMs,
        if (state.playing) 1f else 0f
      )
      .build()

  private fun loadArtwork(url: String?) {
    if (url == artworkUrl) {
      return
    }
    artworkUrl = url
    artwork = null
    if (url == null) {
      return
    }

    artworkLoader.execute {
      val bitmap = try {
        URL(url).openStream().use { BitmapFactory.decodeStream(it) }?.let(::scaleArtwork)
      } catch (error: Exception) {
        Log.w(TAG, "Could not load artwork from $url", error)
        null
      }
      mainHandler.post {
        if (bitmap != null && url == artworkUrl) {
          artwork = bitmap
          nowPlaying?.let(::show)
        }
      }
    }
  }

  // Metadata travels over binder, which caps a transaction at ~1 MB.
  private fun scaleArtwork(bitmap: Bitmap): Bitmap {
    val largestSide = maxOf(bitmap.width, bitmap.height)
    if (largestSide <= MAX_ARTWORK_SIZE) {
      return bitmap
    }
    val scale = MAX_ARTWORK_SIZE.toFloat() / largestSide
    return Bitmap.createScaledBitmap(
      bitmap,
      (bitmap.width * scale).toInt(),
      (bitmap.height * scale).toInt(),
      true
    )
  }

  private fun registerNoisyReceiver() {
    if (noisyReceiverRegistered) {
      return
    }
    ContextCompat.registerReceiver(
      context,
      noisyReceiver,
      IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
    noisyReceiverRegistered = true
  }

  private fun unregisterNoisyReceiver() {
    if (!noisyReceiverRegistered) {
      return
    }
    context.unregisterReceiver(noisyReceiver)
    noisyReceiverRegistered = false
  }

  // Same channel as the back button in MainActivity: see mediaSessionHandler.ts.
  private fun dispatch(action: String, positionMs: Long? = null) {
    val args = if (positionMs == null) "'$action'" else "'$action', $positionMs"
    mainHandler.post {
      webView?.evaluateJavascript(
        "window.__nuclearMediaAction__ && window.__nuclearMediaAction__($args)",
        null
      )
    }
  }

  companion object {
    private const val TAG = "MediaSessionPlugin"
    private const val MAX_ARTWORK_SIZE = 512
  }
}
