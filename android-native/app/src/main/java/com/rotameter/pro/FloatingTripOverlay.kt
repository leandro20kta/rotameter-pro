package com.rotameter.pro

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.TextView
import android.app.PendingIntent

/** Optional compact navigation indicator. Android overlays require individual opt-in. */
class FloatingTripOverlay(private val context: Context) {
    private val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var badge: TextView? = null
    private var params: WindowManager.LayoutParams? = null
    fun show(label: String) {
        if (Build.VERSION.SDK_INT < 26 || !Settings.canDrawOverlays(context)) return
        val current = badge
        if (current != null) { current.text = label; return }
        val density = context.resources.displayMetrics.density
        val view = TextView(context).apply {
            text = label
            setTextColor(0xff15261f.toInt())
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setPadding((13*density).toInt(),(10*density).toInt(),(13*density).toInt(),(10*density).toInt())
            background = GradientDrawable().apply {
                setColor(0xfff8fff9.toInt())
                cornerRadius = 18 * density
                setStroke((2*density).toInt(),0xff16aa67.toInt())
            }
            setOnClickListener {
                val open = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                context.startActivity(open)
            }
        }
        val layout = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply { gravity=Gravity.TOP or Gravity.END; x=(12*density).toInt(); y=(110*density).toInt() }
        try { manager.addView(view,layout); badge=view; params=layout }
        catch (_:Exception) { badge=null;params=null }
    }
    fun hide() { badge?.let { try { manager.removeView(it) } catch (_:Exception){} };badge=null;params=null }
}
