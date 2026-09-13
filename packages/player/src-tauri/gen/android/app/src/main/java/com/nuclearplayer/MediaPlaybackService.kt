package com.nuclearplayer

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.os.IBinder
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

// Stays in the foreground for as long as there is something in the player,
// paused included: once the app is in the background Android 12+ refuses to
// start a foreground service again, so resuming from the notification would
// otherwise land on a frozen process.
class MediaPlaybackService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onDestroy() {
    instance = null
    super.onDestroy()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val current = notification
    if (current == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    promote(current)

    val controls = session?.controller?.transportControls
    when (intent?.action) {
      ACTION_PLAY_PAUSE ->
        if (session?.controller?.playbackState?.state == PlaybackStateCompat.STATE_PLAYING) {
          controls?.pause()
        } else {
          controls?.play()
        }
      ACTION_NEXT -> controls?.skipToNext()
      ACTION_PREVIOUS -> controls?.skipToPrevious()
    }
    return START_NOT_STICKY
  }

  private fun promote(notification: Notification) {
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
    } else {
      0
    }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
  }

  companion object {
    private const val TAG = "MediaPlaybackService"
    const val NOTIFICATION_ID = 1
    const val ACTION_PLAY_PAUSE = "com.nuclearplayer.media.PLAY_PAUSE"
    const val ACTION_NEXT = "com.nuclearplayer.media.NEXT"
    const val ACTION_PREVIOUS = "com.nuclearplayer.media.PREVIOUS"

    var session: MediaSessionCompat? = null
    private var notification: Notification? = null
    private var instance: MediaPlaybackService? = null

    fun show(context: Context, notification: Notification) {
      this.notification = notification
      val running = instance
      if (running != null) {
        running.promote(notification)
        return
      }
      try {
        ContextCompat.startForegroundService(context, Intent(context, MediaPlaybackService::class.java))
      } catch (error: IllegalStateException) {
        Log.w(TAG, "Could not start the playback service", error)
      }
    }

    fun hide(context: Context) {
      notification = null
      instance?.let {
        ServiceCompat.stopForeground(it, ServiceCompat.STOP_FOREGROUND_REMOVE)
        it.stopSelf()
      }
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }
}

object PlaybackNotification {
  private const val CHANNEL_ID = "playback"

  fun build(
    context: Context,
    session: MediaSessionCompat,
    state: NowPlaying,
    artwork: Bitmap?
  ): Notification {
    NotificationManagerCompat.from(context).createNotificationChannel(
      NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
        .setName(context.getString(R.string.playback_channel_name))
        .setShowBadge(false)
        .build()
    )

    val openApp = PendingIntent.getActivity(
      context,
      0,
      context.packageManager.getLaunchIntentForPackage(context.packageName),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_nuclear)
      .setContentTitle(state.title)
      .setContentText(state.artist)
      .setSubText(state.album)
      .setLargeIcon(artwork)
      .setContentIntent(openApp)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setOngoing(true)
      .addAction(
        android.R.drawable.ic_media_previous,
        context.getString(R.string.playback_previous),
        serviceAction(context, MediaPlaybackService.ACTION_PREVIOUS)
      )
      .addAction(
        if (state.playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
        context.getString(if (state.playing) R.string.playback_pause else R.string.playback_play),
        serviceAction(context, MediaPlaybackService.ACTION_PLAY_PAUSE)
      )
      .addAction(
        android.R.drawable.ic_media_next,
        context.getString(R.string.playback_next),
        serviceAction(context, MediaPlaybackService.ACTION_NEXT)
      )
      .setStyle(
        androidx.media.app.NotificationCompat.MediaStyle()
          .setMediaSession(session.sessionToken)
          .setShowActionsInCompactView(0, 1, 2)
      )
      .build()
  }

  private fun serviceAction(context: Context, action: String): PendingIntent =
    PendingIntent.getService(
      context,
      action.hashCode(),
      Intent(context, MediaPlaybackService::class.java).setAction(action),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
}
