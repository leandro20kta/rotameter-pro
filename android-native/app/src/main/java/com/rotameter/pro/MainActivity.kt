package com.rotameter.pro

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.provider.Settings
import android.net.Uri
import android.app.AlertDialog
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {
    private lateinit var web: WebView
    private val requestCode = 42
    private var awaitingAction: JSONObject? = null
    private var gpsOffset = 0L
    private var gpsTripId: String? = null
    private val fileOrigin = "https://appassets.androidplatform.net/assets/index.html"
    private val assetLoader by lazy { WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build() }
    private val updates = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == GpsTripService.ACTION_FIX) sendBatchFromService()
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest): android.webkit.WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
            override fun onPageFinished(view: WebView, url: String) { sendBatchFromService() }
        }
        web.addJavascriptInterface(AndroidBridge(), "RotaMeterAndroid")
        web.loadUrl(fileOrigin)
    }
    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(GpsTripService.ACTION_FIX)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(updates,filter,Context.RECEIVER_NOT_EXPORTED)
        else { @Suppress("DEPRECATION") registerReceiver(updates,filter) }
    }
    override fun onStop() {
        if(getSharedPreferences("rm",MODE_PRIVATE).getBoolean("active",false)) {
            startService(Intent(this,GpsTripService::class.java).setAction(GpsTripService.VISIBILITY).putExtra("visible",false))
        }
        try { unregisterReceiver(updates) } catch (_: Exception) {}
        super.onStop()
    }
    override fun onResume() {
        super.onResume()
        if(getSharedPreferences("rm",MODE_PRIVATE).getBoolean("active",false)) {
            startService(Intent(this,GpsTripService::class.java).setAction(GpsTripService.VISIBILITY).putExtra("visible",true))
        }
        if (::web.isInitialized) sendBatchFromService()
    }
    @Suppress("unused") inner class AndroidBridge {
        @JavascriptInterface fun postMessage(raw: String) {
            if (raw.length > 30000) return
            try {
                val msg = JSONObject(raw)
                runOnUiThread { handleMessage(msg) }
            } catch (_: Exception) { onError("Comando inválido.") }
        }
    }
    private fun hasLocation(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    private fun handleMessage(msg: JSONObject) {
        val type = msg.optString("type")
        if (type == "tracking-sync") { sendBatchFromService(msg.optDouble("since",0.0)); return }
        if (type == "navigation-voice-route" || type == "navigation-voice-clear") {
            val action = if (type.endsWith("clear")) GpsTripService.CLEAR_VOICE else GpsTripService.SET_VOICE
            val intent = Intent(this,GpsTripService::class.java).setAction(action)
            if (action == GpsTripService.SET_VOICE) intent.putExtra("steps",msg.optJSONArray("steps")?.toString()?:"[]")
            startService(intent); return
        }
        if (type == "tracking-stop" || type == "tracking-pause") {
            startService(Intent(this,GpsTripService::class.java).setAction(if(type == "tracking-stop") GpsTripService.STOP else GpsTripService.PAUSE))
            return
        }
        if (!hasLocation()) {
            awaitingAction = msg
            ActivityCompat.requestPermissions(this,arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),requestCode)
            return
        }
        when(type) {
            "location-read" -> requestFix()
            "tracking-start","tracking-resume" -> {
                val id=msg.optString("id");if(!Regex("^[A-Za-z0-9_-]{1,64}$").matches(id)){onError("Identificador inválido");return}
                val action=if(type=="tracking-start") GpsTripService.START else GpsTripService.RESUME
                val i=Intent(this,GpsTripService::class.java).setAction(action).putExtra("tripId",id)
                try {
                    ContextCompat.startForegroundService(this,i)
                    if (type == "tracking-start") offerOverlayPermission()
                } catch(e: Exception) {onError("Não foi possível iniciar o GPS: ${e.message}")}
            }
        }
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults)
        if (requestCode != this.requestCode) return
        if (!hasLocation()) {onError("Localização precisa recusada. Ative a permissão nas Definições.");awaitingAction=null;return}
        val msg=awaitingAction;awaitingAction=null;if(msg!=null) handleMessage(msg)
    }
    private fun offerOverlayPermission() {
        if (Build.VERSION.SDK_INT < 26 || Settings.canDrawOverlays(this)) return
        val pref=getSharedPreferences("rm",MODE_PRIVATE)
        if(pref.getBoolean("overlayExplained",false)) return
        pref.edit().putBoolean("overlayExplained",true).apply()
        AlertDialog.Builder(this)
            .setTitle("Mini-janela RotaMeter")
            .setMessage("Quer mostrar a distância da viagem sobre outras aplicações? Essa função opcional precisa de autorização especial do Android. O GPS continuará ativo mesmo sem ela.")
            .setPositiveButton("Autorizar") { _,_ ->
                val intent=Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                startActivity(intent)
            }
            .setNegativeButton("Agora não",null)
            .show()
    }
    private fun requestFix() {
        val lm=getSystemService(LOCATION_SERVICE) as LocationManager
        if (!hasLocation()) return
        val providers=listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER)
        val listener=object : LocationListener {
            override fun onLocationChanged(location: Location) {
                lm.removeUpdates(this)
                sendJs("window.RotaMeterNative?.onFix(${GpsTripService.fixJson(location)});")
            }
        }
        try {
            for (provider in providers) if (lm.isProviderEnabled(provider)) lm.requestLocationUpdates(provider,1000L,0f,listener,Looper.getMainLooper())
            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let{ if(System.currentTimeMillis()-it.time < 12000) sendJs("window.RotaMeterNative?.onFix(${GpsTripService.fixJson(it)});") }
        } catch (e:SecurityException){onError("Autorize a localização: ${e.message}")}
    }
    private fun sendBatchFromService(since: Double=0.0) {
        val prefs=getSharedPreferences("rm",MODE_PRIVATE)
        val id=prefs.getString("tripId",null)?:return
        val file=File(filesDir,"gps_${id}.ndjson")
        if (!file.exists()) return
        if (gpsTripId != id) { gpsTripId=id; gpsOffset=0L }
        try {
            // Incremental read, bounded in memory. The browser discards duplicate timestamps.
            java.io.RandomAccessFile(file,"r").use { raf ->
                if (gpsOffset > raf.length()) gpsOffset=0L
                raf.seek(gpsOffset)
                val records=org.json.JSONArray()
                var count=0
                while(count < 250) {
                    val raw=raf.readLine() ?: break
                    gpsOffset=raf.filePointer
                    val line=String(raw.toByteArray(Charsets.ISO_8859_1),Charsets.UTF_8)
                    val p=JSONObject(line)
                    if(p.optDouble("ts")>since) {records.put(p);count++}
                }
                if(records.length()>0) sendJs("window.RotaMeterNative?.ingestBatch(${records});")
                // Catch up in bounded portions without re-reading the whole trip.
                if (gpsOffset < raf.length()) web.postDelayed({ sendBatchFromService(since) },200L)
            }
        } catch (e:Exception) {onError("Falha a recuperar o GPS: ${e.message}")}
    }
    private fun sendJs(code:String) { if (::web.isInitialized) runOnUiThread { web.evaluateJavascript(code,null) } }
    private fun onError(message:String) { sendJs("window.RotaMeterNative?.onError(${JSONObject.quote(message)});") }
}
