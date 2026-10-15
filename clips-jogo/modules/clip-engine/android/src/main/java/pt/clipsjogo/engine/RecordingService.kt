package pt.clipsjogo.engine

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

/**
 * Serviço em primeiro plano enquanto se grava: o Android não pode parar a
 * câmara, o microfone nem o servidor local se o ecrã bloquear ou se mudares
 * de app. Mostra uma notificação "A gravar o jogo".
 */
class RecordingService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
          types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        startForeground(NOTIFICATION_ID, notification, types)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      // Sem serviço a gravação continua com a app aberta; só perde a proteção em segundo plano.
      Log.e(TAG, "Não foi possível iniciar o serviço em primeiro plano", e)
      stopSelf()
      return START_NOT_STICKY
    }
    if (wakeLock == null) {
      wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ClipsJogo:gravacao")
        .apply { acquire(6 * 60 * 60 * 1000L) } // no máximo 6 h, por segurança
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    super.onDestroy()
  }

  private fun buildNotification(): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Gravação", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Aparece enquanto o jogo está a ser gravado."
          setShowBadge(false)
        }
      )
    }
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    return builder
      .setSmallIcon(android.R.drawable.presence_video_online)
      .setContentTitle("A gravar o jogo")
      .setContentText("A gravação continua mesmo com o ecrã bloqueado. Toca para abrir.")
      .setOngoing(true)
      .setContentIntent(open)
      .build()
  }

  companion object {
    private const val TAG = "ClipEngine/Service"
    private const val CHANNEL_ID = "gravacao"
    private const val NOTIFICATION_ID = 1001

    /**
     * Arranca com startService (a app está à vista) e o serviço promove-se a si
     * próprio. Com startForegroundService, se o Android recusasse a notificação,
     * o sistema fechava a app inteira — assim, no pior caso, só se perde a
     * proteção em segundo plano e a gravação continua.
     */
    fun start(context: Context) {
      val intent = Intent(context, RecordingService::class.java)
      try {
        context.startService(intent)
      } catch (e: Exception) {
        Log.e(TAG, "Falha a iniciar o serviço", e)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, RecordingService::class.java))
    }
  }
}
