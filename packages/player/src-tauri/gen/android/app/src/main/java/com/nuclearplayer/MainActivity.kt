package com.nuclearplayer

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

@SuppressLint("RestrictedApi")
class MainActivity : TauriActivity() {
  private var insetScript: ScriptHandler? = null
  private val bootWatchdogHandler = Handler(Looper.getMainLooper())
  private val bootWatchdogRunnable = Runnable { onBootWatchdogTimeout() }

  // WryActivity's own handler goes straight to webView.goBack(), which cannot
  // give the frontend a chance to dismiss what is on screen first.
  override val handleBackNavigation: Boolean = false

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    publishWindowInsets(webView)
    handleBackButton(webView)
    installBootWatchdog(webView)
  }

  override fun onDestroy() {
    bootWatchdogHandler.removeCallbacks(bootWatchdogRunnable)
    super.onDestroy()
  }

  // Cold-starting the Android activity after the process was killed (task
  // swipe, cache clear, low-memory reclaim — anything that ends the process,
  // not just backgrounding it) occasionally leaves Tauri's JS<->Rust IPC
  // bridge dead: the webview renders fine (HTML/CSS/JS all load over the
  // custom protocol), but every invoke() hangs forever, even one for a
  // command that doesn't exist, so `initPlayerApp` never reaches
  // `root.render()` and the screen stays on the theme's background color
  // forever. Confirmed with the webview's own DevTools Protocol: reloading
  // the page does NOT fix it (the IPC channel is broken at the native
  // Activity/WebView level, not just for one dropped message), only killing
  // and relaunching the whole process does. This matches known upstream
  // Tauri Android IPC races (e.g. tauri-apps/tauri#15671) rather than
  // anything in our own frontend or Rust code.
  //
  // `signalBootComplete()` below is a plain JavascriptInterface, deliberately
  // NOT routed through Tauri's own IPC, so it still works even when that
  // channel is the thing that's broken. If it isn't called in time, we
  // restart the whole process — the only fix that reliably worked in manual
  // testing — capped so a genuinely broken install doesn't restart forever.
  private fun installBootWatchdog(webView: WebView) {
    webView.addJavascriptInterface(BootWatchdogBridge(), "__nuclearBootWatchdog")
    bootWatchdogHandler.removeCallbacks(bootWatchdogRunnable)
    bootWatchdogHandler.postDelayed(bootWatchdogRunnable, BOOT_WATCHDOG_TIMEOUT_MS)
  }

  private fun onBootWatchdogSignaled() {
    bootWatchdogHandler.removeCallbacks(bootWatchdogRunnable)
    val prefs = getSharedPreferences(BOOT_WATCHDOG_PREFS, MODE_PRIVATE)
    if (prefs.getInt(PREF_RESTART_COUNT, 0) != 0) {
      Log.i("NuclearBootWatchdog", "Boot completed after a previous restart; clearing the counter.")
      prefs.edit().clear().apply()
    }
  }

  private fun onBootWatchdogTimeout() {
    val prefs = getSharedPreferences(BOOT_WATCHDOG_PREFS, MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val lastRestartAt = prefs.getLong(PREF_LAST_RESTART_AT, 0L)
    val previousCount = if (now - lastRestartAt < BOOT_WATCHDOG_RESTART_WINDOW_MS) {
      prefs.getInt(PREF_RESTART_COUNT, 0)
    } else {
      0
    }

    if (previousCount >= MAX_AUTO_RESTARTS) {
      Log.e(
        "NuclearBootWatchdog",
        "Boot did not complete within ${BOOT_WATCHDOG_TIMEOUT_MS}ms, and we already " +
          "auto-restarted $previousCount times in the last ${BOOT_WATCHDOG_RESTART_WINDOW_MS}ms " +
          "— giving up instead of restart-looping."
      )
      return
    }

    // commit(), not apply(): we kill this process a few lines down, and
    // apply()'s write is asynchronous — it can lose the increment to the
    // kill, which is exactly how the restart cap failed to engage during
    // testing (every restart logged "attempt 1/3").
    prefs.edit()
      .putInt(PREF_RESTART_COUNT, previousCount + 1)
      .putLong(PREF_LAST_RESTART_AT, now)
      .commit()

    Log.w(
      "NuclearBootWatchdog",
      "Boot did not complete within ${BOOT_WATCHDOG_TIMEOUT_MS}ms (IPC bridge likely dead " +
        "after this cold start, see ANDROID_PORT.md). Restarting the app " +
        "(attempt ${previousCount + 1}/$MAX_AUTO_RESTARTS)."
    )
    restartApp()
  }

  private fun restartApp() {
    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    startActivity(intent)
    Process.killProcess(Process.myPid())
  }

  inner class BootWatchdogBridge {
    @JavascriptInterface
    fun signalBootComplete() {
      runOnUiThread { onBootWatchdogSignaled() }
    }
  }

  companion object {
    private const val BOOT_WATCHDOG_TIMEOUT_MS = 10_000L
    // Measured failure rate for the underlying IPC race (see ANDROID_PORT.md)
    // was 50-70% per cold start across ~16 manual trials, not a rare fluke —
    // 3 retries left a ~1-in-4 chance of still being stuck, so this gives 5
    // (with a window wide enough to hold all of them even back-to-back).
    private const val BOOT_WATCHDOG_RESTART_WINDOW_MS = 120_000L
    private const val MAX_AUTO_RESTARTS = 5
    private const val BOOT_WATCHDOG_PREFS = "nuclear_boot_watchdog"
    private const val PREF_RESTART_COUNT = "restart_count"
    private const val PREF_LAST_RESTART_AT = "last_restart_at"
  }

  // The activity draws edge to edge, but Chromium only derives CSS
  // env(safe-area-inset-*) from the display cutout, never from the status or
  // navigation bars — so without help the top bar sits under the clock and the
  // player bar under the gesture pill. Padding the WebView does not move web
  // content either, so hand the insets to CSS instead: the `safe-area-inset`
  // utility in packages/tailwind-config/utilities.css reads them.
  private fun publishWindowInsets(webView: WebView) {
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
      applyInsets(
        view as WebView,
        windowInsets.getInsets(
          WindowInsetsCompat.Type.systemBars() or
            WindowInsetsCompat.Type.displayCutout()
        )
      )
      windowInsets
    }
    ViewCompat.requestApplyInsets(webView)
  }

  private fun applyInsets(webView: WebView, insets: Insets) {
    val density = resources.displayMetrics.density
    fun css(value: Int) = "${(value / density).toInt()}px"

    val script =
      """
      (function () {
        var root = document.documentElement;
        if (!root) { return; }
        root.style.setProperty('--nuclear-inset-top', '${css(insets.top)}');
        root.style.setProperty('--nuclear-inset-right', '${css(insets.right)}');
        root.style.setProperty('--nuclear-inset-bottom', '${css(insets.bottom)}');
        root.style.setProperty('--nuclear-inset-left', '${css(insets.left)}');
      })();
      """.trimIndent()

    // Covers the document that is already loaded...
    webView.evaluateJavascript(script, null)
    // ...and every one loaded afterwards, since the first inset pass usually
    // lands before the frontend has booted.
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      insetScript?.remove()
      insetScript = WebViewCompat.addDocumentStartJavaScript(
        webView,
        script,
        setOf("*")
      )
    }
  }

  // Back offers the frontend first refusal (see useAndroidBackHandler.ts) so an
  // open drawer or modal is dismissed instead of navigating. This matters most
  // on the first screen after launch, where there is no WebView history yet and
  // the default handler would close the app outright.
  private fun handleBackButton(webView: WebView) {
    val callback = object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        webView.evaluateJavascript(
          "window.__nuclearOnBack__ ? window.__nuclearOnBack__() : false"
        ) { handled ->
          if (handled == "true") {
            return@evaluateJavascript
          }
          if (webView.canGoBack()) {
            webView.goBack()
          } else {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
            isEnabled = true
          }
        }
      }
    }
    onBackPressedDispatcher.addCallback(this, callback)
  }
}
