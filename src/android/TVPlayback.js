/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Controle remoto Google Cast. Player.js chama useTVPlayback e TVRemote para carregar mídia na TV, pausar, avançar e salvar progresso.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import GoogleCast from 'react-native-google-cast';
import { castMedia, seekPosition, sameMedia } from './cast-media.cjs';

/**
 * useTVPlayback — Mantém a sessão remota, carrega mídia e fornece comandos para TVRemote.
 * Entradas: { client, source, item, player, start, room, onProgress }.
 * Operações presentes no corpo: useState, useRef, useEffect, setReady, setStatus, setError, player.play, player.pause, sameMedia, fail.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function useTVPlayback({ client, source, item, player, start, room, onProgress }) {
  const [status, setStatus] = useState(null);
  const [position, setPosition] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ position: start, playing: true, duration: 0 });
  const wasConnected = useRef(false);
  const progress = useRef(onProgress); progress.current = onProgress;
  const live = item.section === 'live';
  useEffect(() => {
    if (!client) {
      setReady(false); setStatus(null); setError('');
      if (wasConnected.current) {
        if (!live && latest.current.position > 0) player.currentTime = latest.current.position;
        if (AppState.currentState === 'active' && latest.current.playing && (!room || room.host)) player.play();
      }
      wasConnected.current = false;
      return;
    }
    wasConnected.current = true;
    player.pause(); setReady(false); setError('');
    let stopped = false, mediaActive = false;
    /**
 * fail — Etapa auxiliar fail: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: setError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function fail() { if (!stopped) setError('A TV não conseguiu reproduzir esta fonte. Tente novamente, escolha outra fonte ou volte ao celular.'); }
    /**
 * update — Etapa auxiliar update: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: next.
 * Operações presentes no corpo: sameMedia, setStatus, fail, progress.current.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function update(next) {
      if (stopped || !sameMedia(next, source.url)) return;
      mediaActive = true; setStatus(next);
      latest.current.playing = next.playerState === 'playing';
      latest.current.duration = next.mediaInfo?.streamDuration || 0;
      if (next.playerState === 'idle' && next.idleReason === 'error') fail();
      if (!live && next.idleReason === 'finished') progress.current(0, latest.current.duration);
    }
    const statuses = client.onMediaStatusUpdated(update);
    const positions = client.onMediaProgressUpdated(seconds => {
      if (stopped || !mediaActive || !Number.isFinite(seconds)) return;
      latest.current.position = seconds; setPosition(seconds);
      if (!live && latest.current.duration > 0) progress.current(seconds, latest.current.duration);
    }, 1);
    /**
 * load — Etapa auxiliar load: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: castMedia, client.getMediaStatus, sameMedia, update, client.loadMedia, setReady, setError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function load() {
      try {
        const request = castMedia(item, source, player.currentTime || start, !room || room.host);
        const current = await client.getMediaStatus();
        if (stopped) return;
        if (!attempt && sameMedia(current, source.url) && current.playerState !== 'idle') update(current);
        else { await client.loadMedia(request); if (stopped) return; }
        setReady(true);
      } catch (e) { if (!stopped) setError(e.message?.startsWith('Esta fonte') ? e.message : 'Não foi possível iniciar na TV. Confira o Wi-Fi e tente outra fonte.'); }
    }
    load();
    return () => { stopped = true; statuses.remove(); positions.remove(); };
    // Room snapshots and progress callbacks change without replacing the media.
  }, [client, source.url, item.id, player, attempt]);
  const call = async action => {
    try { await action(); setError(''); } catch { setError('O comando não chegou à TV. Confira a conexão e tente novamente.'); }
  };
  const adapter = useMemo(() => ({
    get currentTime() { return latest.current.position; },
    set currentTime(value) { call(() => client.seek({ position: seekPosition(value, 0, latest.current.duration) })); },
    get playing() { return latest.current.playing; },
    play() { return call(() => client.play()); },
    pause() { return call(() => client.pause()); },
  }), [client]);
  return { connected: !!client, ready, status, position, error, adapter,
    retry: () => setAttempt(value => value + 1),
    toggle: () => call(() => status?.playerState === 'playing' ? client.pause() : client.play()),
    seek: delta => call(async () => { const current = await client.getStreamPosition(); await client.seek({ position: seekPosition(current, delta, latest.current.duration) }); }),
    volume: delta => call(async () => { const current = await client.getMediaStatus(); await client.setStreamVolume(Math.max(0, Math.min(1, (current?.volume ?? 1) + delta))); }),
    disconnect: () => call(() => GoogleCast.getSessionManager().endCurrentSession(true)),
  };
}

/**
 * TVRemote — Renderiza play/pausa, volume, troca de canal e busca de 20 segundos.
 * Entradas: { tv, live, channelNav, guest }.
 * Operações presentes no corpo: time, button, tv.seek, tv.volume.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function TVRemote({ tv, live, channelNav, guest }) {
  const loading = !tv.ready && !tv.error;
  const button = (label, action, disabled = false) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <View style={styles.panel}>
    <Text style={styles.title}>Reproduzindo na TV</Text>
    <Text style={styles.hint}>Seu celular é o controle remoto</Text>
    {loading && <ActivityIndicator color="#A5A6FF" />}
    <Text style={styles.hint}>{live ? '● AO VIVO' : time(tv.position)} · {tv.status?.playerState === 'paused' ? 'Pausado' : tv.status?.playerState === 'playing' ? 'Reproduzindo' : 'Conectando…'}</Text>
    <View style={styles.row}>
      {!live && button('↶ 20 s', () => tv.seek(-20), !tv.ready || guest)}
      {button(tv.status?.playerState === 'playing' ? 'Pausar' : 'Play', tv.toggle, !tv.ready || guest)}
      {!live && button('20 s ↷', () => tv.seek(20), !tv.ready || guest)}
    </View>
    {live && <View style={styles.row}>
      {button('‹ Canal anterior', channelNav?.previous, !channelNav?.previous)}
      {button('Próximo canal ›', channelNav?.next, !channelNav?.next)}
    </View>}
    <View style={styles.row}>
      {button('Volume −', () => tv.volume(-0.1), !tv.ready)}
      {button('Volume +', () => tv.volume(0.1), !tv.ready)}
    </View>
    {guest && <Text style={styles.hint}>O anfitrião da sala controla a reprodução.</Text>}
    {!!tv.error && <Text accessibilityRole="alert" style={styles.error}>{tv.error}</Text>}
    {!!tv.error && button('Tentar na TV novamente', tv.retry)}
    {button('Encerrar transmissão · voltar ao celular', tv.disconnect)}
  </View>;
}
/**
 * time — Etapa auxiliar time: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: value.
 * Operações presentes no corpo: Math.max, Math.floor, padStart, String.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function time(value) { const seconds = Math.max(0, Math.floor(value || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
const styles = StyleSheet.create({ panel: { padding: 20, gap: 14, backgroundColor: '#151522', marginHorizontal: 16, borderRadius: 20 }, title: { fontSize: 22, fontWeight: '800', color: '#FFF' }, hint: { color: '#B3B5CA' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#5549CE', justifyContent: 'center' }, buttonText: { color: '#FFF', fontWeight: '700' }, disabled: { opacity: 0.4 }, error: { color: '#FFB4BD' } });
