// CHPLAYER — Ponte nativa CHCastDiscovery usada por CastDiscovery.js. MediaRouter descobre TVs; WifiManager permite receber multicast durante a busca, limitada a 30 segundos.
// Referências e explicação das APIs: docs/architecture.md.
package com.saimoplayer.preview

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import androidx.mediarouter.media.MediaRouter
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import com.google.android.gms.common.GoogleApiAvailability
import com.reactnative.googlecast.api.RNGCCastContext

class CastDiscoveryPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(CastDiscoveryModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class CastDiscoveryModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val handler = Handler(Looper.getMainLooper())
  private var lock: WifiManager.MulticastLock? = null
  private val callback = object : MediaRouter.Callback() {}
  private val timeout = Runnable { stopScan() }
  init { context.addLifecycleEventListener(this) }
  override fun getName() = "CHCastDiscovery"

  // Chamado por NativeModules.CHCastDiscovery.start() no JavaScript; resolve diagnóstico ou rejeita a Promise.
  @ReactMethod fun start(promise: Promise) {
    handler.post {
      try {
        stopScan()
        // Usa o mesmo receptor configurado no AndroidManifest, evitando buscar um aplicativo Cast diferente.
        val cast = RNGCCastContext.getSharedInstance(context) ?: throw IllegalStateException("Google Cast indisponível")
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        // O lock deixa os pacotes multicast de descoberta chegarem pelo Wi-Fi; não mantém a tela ligada.
        lock = wifi.createMulticastLock("CHPlayer:CastDiscovery").apply { setReferenceCounted(false); acquire() }
        // Solicita uma busca ativa ao SDK Android; somente durante a tela de seleção.
        MediaRouter.getInstance(context).addCallback((cast.mergedSelector ?: throw IllegalStateException("Seletor Cast indisponível")), callback, MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN)
        // Limita a busca para não consumir bateria indefinidamente.
        handler.postDelayed(timeout, 30000)
        // Consulta o transporte de rede para orientar o usuário sobre Wi-Fi/VPN.
        val network = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = network.getNetworkCapabilities(network.activeNetwork)
        promise.resolve(Arguments.createMap().apply {
          putBoolean("wifi", caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true)
          putBoolean("vpn", caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true)
          putInt("playServices", GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context))
        })
      } catch (e: Exception) { stopScan(); promise.reject("CAST_DISCOVERY", "Não foi possível buscar TVs nesta rede.", e) }
    }
  }
  // Chamado ao fechar/sair: agenda a liberação da busca na thread principal.
  @ReactMethod fun stop() { handler.post { stopScan() } }
  // Remove timeout e callback e libera o MulticastLock; pode ser chamado repetidamente.
  private fun stopScan() {
    handler.removeCallbacks(timeout)
    MediaRouter.getInstance(context).removeCallback(callback)
    lock?.let { if (it.isHeld) it.release() }; lock = null
  }
  // O Android/React Native avisa que o aplicativo foi para segundo plano.
  override fun onHostPause() { handler.post { stopScan() } }
  override fun onHostDestroy() { handler.post { stopScan() } }
  override fun onHostResume() {}
  override fun invalidate() { context.removeLifecycleEventListener(this); handler.post { stopScan() }; super.invalidate() }
}
