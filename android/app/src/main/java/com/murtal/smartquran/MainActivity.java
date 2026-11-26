package com.murtal.smartquran;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_ORIGIN = "https://" + APP_HOST;
    private static final int REQUEST_AUDIO_PERMISSION = 1001;

    private WebView webView;
    private PermissionRequest pendingWebPermissionRequest;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    private class AndroidTTSBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return ttsReady && tts != null;
        }

        @JavascriptInterface
        public void speak(final String text, final float rate, final float pitch, final String token) {
            if (!ttsReady || tts == null || text == null || text.trim().isEmpty()) {
                notifyJsTtsCallback("__onAndroidTTSError", token);
                return;
            }
            final String safeToken = token != null ? token.replaceAll("[^a-zA-Z0-9_-]", "") : "utt";
            runOnUiThread(() -> {
                try {
                    tts.setSpeechRate(Math.max(0.5f, Math.min(2.0f, rate)));
                    tts.setPitch(Math.max(0.5f, Math.min(2.0f, pitch)));
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, safeToken);
                } catch (Exception e) {
                    notifyJsTtsCallback("__onAndroidTTSError", safeToken);
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            if (tts == null) return;
            runOnUiThread(() -> {
                try {
                    tts.stop();
                } catch (Exception ignored) {
                }
            });
        }
    }

    private void notifyJsTtsCallback(final String fnName, final String token) {
        if (webView == null) return;
        final String safeToken = token != null ? token.replaceAll("[^a-zA-Z0-9_-]", "") : "";
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window." + fnName + " && window." + fnName + "('" + safeToken + "');",
                        null
                );
            }
        });
    }

    private void initAndroidTts() {
        try {
            tts = new TextToSpeech(this, status -> {
                if (status == TextToSpeech.SUCCESS && tts != null) {
                    int langResult = tts.setLanguage(new Locale("ar", "SA"));
                    if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        langResult = tts.setLanguage(new Locale("ar"));
                    }
                    ttsReady = (langResult != TextToSpeech.LANG_MISSING_DATA && langResult != TextToSpeech.LANG_NOT_SUPPORTED);
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            notifyJsTtsCallback("__onAndroidTTSEnd", utteranceId);
                        }

                        @Override
                        public void onError(String utteranceId) {
                            notifyJsTtsCallback("__onAndroidTTSError", utteranceId);
                        }
                    });
                } else {
                    ttsReady = false;
                }
            });
        } catch (Exception e) {
            ttsReady = false;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.parseColor("#020617"));
            window.setNavigationBarColor(Color.parseColor("#020617"));
        }

        initAndroidTts();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#020617"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.addJavascriptInterface(new AndroidTTSBridge(), "AndroidTTS");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && APP_HOST.equals(uri.getHost())) {
                    return serveAppAsset(uri.getPath());
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String host = uri.getHost();
                if (APP_HOST.equals(host)) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    return false;
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean needsAudio = false;
                    for (String res : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                            needsAudio = true;
                            break;
                        }
                    }

                    if (!needsAudio) {
                        request.grant(request.getResources());
                        return;
                    }

                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebPermissionRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO_PERMISSION);
                    }
                });
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_ORIGIN + "/index.html");
        }
    }

    private WebResourceResponse serveAppAsset(String rawPath) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");

        String path = (rawPath == null || rawPath.isEmpty() || "/".equals(rawPath)) ? "/index.html" : rawPath;
        if (path.contains("..")) {
            return notFoundResponse(headers);
        }

        if ("/api/apk/info".equals(path)) {
            try {
                InputStream is = getAssets().open("database/apk_info.json");
                return new WebResourceResponse("application/json", "UTF-8", 200, "OK", headers, is);
            } catch (IOException ignored) {
            }
        }

        String assetPath = "www" + path;
        try {
            InputStream is = getAssets().open(assetPath);
            return new WebResourceResponse(guessMimeType(path), "UTF-8", 200, "OK", headers, is);
        } catch (IOException e) {
            if (!path.contains(".")) {
                try {
                    InputStream fallback = getAssets().open("www/index.html");
                    return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, fallback);
                } catch (IOException ignored) {
                }
            }
            return notFoundResponse(headers);
        }
    }

    private WebResourceResponse notFoundResponse(Map<String, String> headers) {
        return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                headers,
                new ByteArrayInputStream(new byte[0])
        );
    }

    private String guessMimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_AUDIO_PERMISSION && pendingWebPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
            } else {
                pendingWebPermissionRequest.deny();
            }
            pendingWebPermissionRequest = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
            }
            tts = null;
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
