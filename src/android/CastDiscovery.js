/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Busca TVs Google Cast. Player.js renderiza este componente; ele chama o módulo Kotlin CHCastDiscovery e inicia a sessão pelo deviceId escolhido.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, NativeModules, Pressable, ScrollView, Text, View } from 'react-native';
import GoogleCast, { useDevices } from 'react-native-google-cast';

/**
 * CastDiscovery — Renderiza a busca e permite escolher uma TV com saída de vídeo.
 * Entradas: { connected }.
 * Operações presentes no corpo: useState, useRef, filter, useDevices, clearTimeout, setTimeout, setSearching, setError, setNetwork, start.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export default function CastDiscovery({ connected }) {
  const [open, setOpen] = useState(false), [searching, setSearching] = useState(false), [connecting, setConnecting] = useState('');
  const timer = useRef(null);
  const [network, setNetwork] = useState(null), [error, setError] = useState('');
  const devices = useDevices().filter(device => device.capabilities?.includes('VideoOut'));
  /**
 * scan — Inicia outra janela de busca ativa e atualiza o diagnóstico da rede.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: clearTimeout, setTimeout, setSearching, setError, setNetwork, start.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function scan() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearching(false), 30000);
    setSearching(true); setError('');
    try { setNetwork(await NativeModules.CHCastDiscovery.start()); }
    catch { setError('A busca não iniciou. Confira o Wi-Fi, o Google Play Services e tente novamente.'); setSearching(false); }
  }
  useEffect(() => {
    if (!open) return;
    setConnecting(''); scan();
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') { NativeModules.CHCastDiscovery.stop(); setSearching(false); } });
    const sessions = GoogleCast.getSessionManager();
    const success = sessions.onSessionStarted(() => { setConnecting(''); setOpen(false); });
    const failed = sessions.onSessionStartFailed(() => { setConnecting(''); setError('A TV foi encontrada, mas recusou a conexão. Abra o Google Cast na TV e tente novamente.'); });
    return () => { clearTimeout(timer.current); listener.remove(); success.remove(); failed.remove(); NativeModules.CHCastDiscovery.stop(); };
  }, [open]);
  const button = (label, action) => <Pressable accessibilityRole="button" onPress={action} style={{ backgroundColor: '#5549CE', borderRadius: 12, padding: 14, minHeight: 48 }}><Text style={{ color: 'white', fontWeight: '700' }}>{label}</Text></Pressable>;
  /**
 * choose — Pede ao gerenciador Cast que conecte ao identificador da TV escolhida.
 * Entradas: device.
 * Operações presentes no corpo: setConnecting, setError, startSession, GoogleCast.getSessionManager.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function choose(device) {
    if (connecting) return;
    setConnecting(device.friendlyName); setError('');
    try {
      const accepted = await GoogleCast.getSessionManager().startSession(device.deviceId);
      if (!accepted) { setConnecting(''); setError('A TV saiu da rede. Busque novamente.'); }
    } catch { setConnecting(''); setError('Não foi possível conectar a esta TV.'); }
  }
  return <>
    {button(connected ? 'TV conectada' : 'Transmitir na TV', () => setOpen(true))}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#000C', justifyContent: 'center', padding: 20 }}>
        <ScrollView style={{ flexGrow: 0, backgroundColor: '#151522', borderRadius: 20 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text accessibilityRole="header" style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>Transmitir na TV</Text>
          <Text style={{ color: '#BCC0D6' }}>Conecte o celular e a TV ao mesmo Wi-Fi. Compatível com Chromecast e TVs com Google Cast integrado.</Text>
          {searching && <ActivityIndicator color="#A5A6FF" />}
          <Text accessibilityLiveRegion="polite" style={{ color: 'white' }}>{devices.length ? devices.map(d => d.friendlyName).join(' · ') : searching ? 'Procurando TVs na rede…' : 'Nenhuma TV encontrada nesta busca.'}</Text>
          {network && !network.wifi && <Text style={{ color: '#FFCC88' }}>O celular não está conectado ao Wi-Fi. Ative o Wi-Fi para encontrar sua TV.</Text>}
          {network?.vpn && <Text style={{ color: '#FFCC88' }}>Uma VPN está ativa. Ela pode impedir o acesso à rede da TV.</Text>}
          {network && network.playServices !== 0 && <Text style={{ color: '#FFCC88' }}>Confira se o Google Play Services está instalado e atualizado.</Text>}
          {!!error && <Text accessibilityRole="alert" style={{ color: '#FFB4BD' }}>{error}</Text>}
          {!!connecting && <Text style={{ color: 'white' }}>Conectando a {connecting}…</Text>}
          {devices.map(device => <View key={device.deviceId}>{button(device.friendlyName + (device.modelName ? ' · ' + device.modelName : ''), () => choose(device))}</View>)}
          {button('Buscar novamente', scan)}
          {button('Abrir configurações de Wi-Fi', () => Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => Linking.openSettings()))}
          <Text style={{ color: '#BCC0D6' }}>Se a TV não aparecer: abra o Google Home, confira se o Google Cast está ativado na TV e evite Wi-Fi de convidados ou isolamento de dispositivos no roteador.</Text>
          <Text style={{ color: '#BCC0D6' }}>Bluetooth não transmite o vídeo para a TV. Fones e caixas Bluetooth podem ser usados para áudio pelo próprio Android.</Text>
          {button('Configurações de áudio Bluetooth', () => Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => Linking.openSettings()))}
          {button('Fechar', () => setOpen(false))}
        </ScrollView>
      </View>
    </Modal>
  </>;
}
