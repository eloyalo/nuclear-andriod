package com.nuclearplayer

import android.annotation.SuppressLint
import android.os.Bundle
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
