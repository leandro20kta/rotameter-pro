package com.rotameter.pro

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.os.Looper
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

/** Foreground location logging independent of WebView. Does not spoof positions. */
class GpsTripService : Service(), LocationListener, TextToSpeech.OnInitListener {
    companion object {
        const val START="rm.start"; const val STOP="rm.stop"; const val PAUSE="rm.pause"
        const val RESUME="rm.resume"; const val SET_VOICE="rm.voice"; const val CLEAR_VOICE="rm.voice.clear"
        const val ACTION_FIX="rm.position.recorded"
        const val VISIBILITY="rm.app.visibility"
        fun fixJson(p:Location):String = JSONObject().apply {
            put("lat",p.latitude);put("lon",p.longitude);put("accuracy",p.accuracy.toDouble())
            put("ts",p.time.toDouble());put("speed",p.speed.toDouble());put("heading",p.bearing.toDouble())
        }.toString()
    }
    private lateinit var lm:LocationManager
    private var id:String?=null
    private var running=false
    private lateinit var overlay:FloatingTripOverlay
    private var appVisible=true
    private var travelMeters=0.0
    private var last:Location?=null
    private var tts:TextToSpeech?=null
    private var ttsReady=false
    private var voiceSteps=JSONArray()
    private val spoken=mutableSetOf<Int>()
    override fun onCreate() { super.onCreate();lm=getSystemService(LOCATION_SERVICE) as LocationManager;tts=TextToSpeech(this,this);overlay=FloatingTripOverlay(this) }
    override fun onInit(status:Int){ ttsReady=status==TextToSpeech.SUCCESS; if(ttsReady) tts?.language=Locale.forLanguageTag("pt-PT") }
    override fun onBind(intent:Intent?):IBinder?=null
    override fun onStartCommand(intent:Intent?, flags:Int, startId:Int):Int {
        val prefs = getSharedPreferences("rm",MODE_PRIVATE)
        val incoming = intent?.action ?: if(prefs.getBoolean("active",false)) RESUME else STOP
        if(intent == null) appVisible=false
        when(incoming) {
            START,RESUME -> {
                val newId=intent?.getStringExtra("tripId") ?: prefs.getString("tripId",null) ?: return START_NOT_STICKY
                if(!Regex("^[A-Za-z0-9_-]{1,64}$").matches(newId))return START_NOT_STICKY
                if(prefs.getString("tripId",null)!=newId){last=null; spoken.clear();travelMeters=0.0}
                else travelMeters=java.lang.Double.longBitsToDouble(prefs.getLong("nativeMeters",0L))
                id=newId; prefs.edit().putString("tripId",newId).putBoolean("active",true).apply(); running=true
                createChannel()
                try{
                    val notification=makeNotification()
                    if(Build.VERSION.SDK_INT>=29) ServiceCompat.startForeground(this,1001,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
                    else startForeground(1001,notification)
                    beginGps()
                    updateOverlay()
                }catch(e:Exception){running=false;prefs.edit().putBoolean("active",false).apply();overlay.hide();stopSelf()}
            }
            PAUSE, STOP -> {
                running=false;last=null;overlay.hide(); try{lm.removeUpdates(this)}catch(_:Exception){}
                prefs.edit().putBoolean("active",false).apply()
                if(incoming==STOP){prefs.edit().remove("tripId").remove("nativeMeters").apply();id=null;voiceSteps=JSONArray()}
                stopForeground(STOP_FOREGROUND_REMOVE);stopSelf()
            }
            SET_VOICE -> { voiceSteps=try{JSONArray(intent?.getStringExtra("steps")?:"[]")}catch(_:Exception){JSONArray()};spoken.clear() }
            CLEAR_VOICE -> { voiceSteps=JSONArray();spoken.clear() }
            VISIBILITY -> { appVisible=intent?.getBooleanExtra("visible",true) ?: true;updateOverlay() }
        }
        // The OS may restart this intentionally active foreground service; never restart after an explicit pause/stop.
        return if(running) START_STICKY else START_NOT_STICKY
    }
    private fun createChannel(){
        if(Build.VERSION.SDK_INT>=26){val m=getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            m.createNotificationChannel(NotificationChannel("trip","GPS da viagem",NotificationManager.IMPORTANCE_LOW))}
    }
    private fun makeNotification():Notification {
        val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this,"trip")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("RotaMeter PRO · GPS em viagem")
            .setContentText("O percurso está a ser registado. Toque para regressar.")
            .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open).build()
    }
    private fun beginGps(){
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return
        try {
            if(lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER,1500L,5f,this,Looper.getMainLooper())
            else if(lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,4000L,10f,this,Looper.getMainLooper())
        } catch (_:SecurityException) { running=false }
    }
    override fun onLocationChanged(location: Location){
        if(!running||id==null||!location.hasAccuracy()||location.accuracy>60f||location.accuracy<0)return
        if(location.time > System.currentTimeMillis()+10000||System.currentTimeMillis()-location.time>30000)return
        if(last!=null && location.time<=last!!.time)return
        val file=File(filesDir,"gps_${id}.ndjson")
        try {FileOutputStream(file,true).use{it.write((fixJson(location)+"\n").toByteArray(Charsets.UTF_8));/* rely on buffered kernel writes; closes file after each fix */}}catch (_:Exception){return}
        val prior=last
        if(prior!=null) {
            val delta=(location.time-prior.time)/1000.0
            val meters=location.distanceTo(prior).toDouble()
            if(delta>0 && delta<=150 && meters<=57*delta+maxOf(location.accuracy,prior.accuracy)*.5 && meters>maxOf(5.0,(location.accuracy+prior.accuracy)*.32)) {
                travelMeters+=meters
                getSharedPreferences("rm",MODE_PRIVATE).edit().putLong("nativeMeters",java.lang.Double.doubleToRawLongBits(travelMeters)).apply()
            }
        }
        last=location
        updateOverlay()
        sendBroadcast(Intent(ACTION_FIX).setPackage(packageName))
        if(ttsReady) announceManeuver(location)
    }
    private fun announceManeuver(location:Location){
        for(i in 0 until voiceSteps.length()){
            if(spoken.contains(i))continue
            val s=voiceSteps.optJSONObject(i)?:continue
            val lat=s.optDouble("lat",Double.NaN);val lon=s.optDouble("lon",Double.NaN)
            if(!lat.isFinite()||!lon.isFinite())continue
            val result=FloatArray(1);Location.distanceBetween(location.latitude,location.longitude,lat,lon,result)
            if(result[0] <= 75f){spoken.add(i);tts?.speak(s.optString("text",""),TextToSpeech.QUEUE_FLUSH,null,"step_$i")}
            break
        }
    }
    private fun updateOverlay(){
        if (!::overlay.isInitialized) return
        if(!running || appVisible || !Settings.canDrawOverlays(this)){overlay.hide();return}
        overlay.show("RotaMeter  •  %.2f km  ↗".format(Locale.forLanguageTag("pt-PT"),travelMeters/1000))
    }
    override fun onDestroy(){ overlay.hide();try{lm.removeUpdates(this)}catch(_:Exception){};tts?.shutdown();super.onDestroy() }
}
