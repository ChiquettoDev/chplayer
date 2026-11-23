/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Tela de reprodução Android. App.js fornece a mídia; este arquivo conecta expo-video, transmissão, controles e salas privadas.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';

import GoogleCast, { useCastSession } from 'react-native-google-cast';
import { TVRemote, useTVPlayback } from './TVPlayback';
import CastDiscovery from './CastDiscovery';

import { RoomChat, shareRoom, useRoomPlayback } from './Rooms';

/**
 * Playback — Conecta o vídeo local ou remoto ao item selecionado e ao progresso.
 * Entradas: { source, start, live, onProgress, onError, room, request, onSnapshot, client, item, channelNav }.
 * Operações presentes no corpo: useRef, useState, useVideoPlayer, useEvent, useTVPlayback, useRoomPlayback, useEventListener, onProgress, useEffect, onError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Playback({ source, start, live, onProgress, onError, room, request, onSnapshot, client, item, channelNav }) {
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer({
    uri: source.url,
    contentType: source.contentType ?? 'auto',
    headers: source.headers,
  }, (video) => { video.timeUpdateEventInterval = live ? 0 : 5; });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const tv = useTVPlayback({ client, source, item, player, start, room, onProgress });
  useRoomPlayback(client ? tv.adapter : player, client ? tv.ready : ready, request, room?.code, room?.host, onSnapshot);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!client && initialized.current && currentTime > 0) onProgress(currentTime, player.duration);
  });
  useEventListener(player, 'playToEnd', () => { if (!client) onProgress(0, player.duration); });

  useEffect(() => {
    if (status === 'error' && !client) onError();
    if (status !== 'readyToPlay' || initialized.current) return;
    initialized.current = true;
    if (start > 0) player.currentTime = start;
    if (!client && (!room || room.host)) player.play();
    setReady(true);
  }, [status, player, start, onError, room, client]);

  if (client) return <TVRemote tv={tv} live={live} channelNav={channelNav} guest={room && !room.host} />;

  return (
    <>
      <VideoView player={player} style={styles.video} nativeControls={!room || room.host} fullscreenOptions={{ enable: !room }} />
      {status === 'loading' && <ActivityIndicator color="#A5A6FF" />}
      {status === 'error' && <Text accessibilityRole="alert" style={styles.error}>O vídeo não abriu. Tente outra fonte ou confira a conexão.</Text>}
    </>
  );
}

/**
 * Player — Organiza reprodução, fontes alternativas, transmissão e sala privada.
 * Entradas: { item, start, channelNav, onClose, onProgress, initialRoom, request }.
 * Operações presentes no corpo: useCastSession, useState, useRef, useCallback, setRoom, setRoomError, onClose, Alert.alert, endCurrentSession, GoogleCast.getSessionManager.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export default function Player({ item, start, channelNav, onClose, onProgress, initialRoom, request }) {
  const session = useCastSession({ ignoreSessionUpdatesInBackground: true });
  const client = session?.client;
  const sources = item.sources?.length ? item.sources : [{ url: item.url }];
  const [selection, select] = useState({ index: 0, attempt: 0 });
  const latest = useRef(start);
  const live = item.section === 'live';
  const [room, setRoom] = useState(initialRoom);
  const [roomError, setRoomError] = useState(null);
  const [creating, setCreating] = useState(false);
  const onSnapshot = useCallback((result, error) => {
    if (result) setRoom(result);
    setRoomError(error);
  }, []);

  /**
 * close — Etapa auxiliar close: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: onClose, Alert.alert, endCurrentSession, GoogleCast.getSessionManager, setRoomError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function close() {
    if (!client) return onClose();
    Alert.alert('Encerrar transmissão?', 'O vídeo está na TV. Encerre a transmissão para voltar à lista.', [
      { text: 'Continuar assistindo', style: 'cancel' },
      { text: 'Encerrar e voltar', onPress: async () => { try { await GoogleCast.getSessionManager().endCurrentSession(true); onClose(); } catch { setRoomError('Não foi possível encerrar na TV. Tente novamente.'); } } },
    ]);
  }

  /**
 * invite — Etapa auxiliar invite: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: setCreating, request, setRoom, shareRoom, setRoomError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function invite() {
    if (creating) return;
    setCreating(true);
    try {
      const active = room ?? await request('create', { movie: item.id });
      setRoom(active);
      await shareRoom(active.code);
    } catch (error) {
      setRoomError(error.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Control label="‹ Voltar" onPress={close} />
          <View style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{item.series ?? item.title}</Text>
            <Text numberOfLines={1} style={styles.muted}>{live ? '●  AO VIVO' : item.series ? item.title : item.group}</Text>
          </View>
          <CastDiscovery connected={!!client} />
        </View>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
        <Playback
          key={`${selection.index}:${selection.attempt}`}
          source={sources[selection.index]}
          item={item}
          client={client}
          channelNav={channelNav}
          start={latest.current}
          live={live}
          room={room}
          request={request}
          onSnapshot={onSnapshot}
          onProgress={(seconds, duration) => {
            latest.current = seconds;
            if (!live) onProgress(seconds, duration);
          }}
          onError={() => {
            if (selection.index + 1 < sources.length) select({ index: selection.index + 1, attempt: 0 });
          }}
        />
        <View style={styles.controls}>
          {!client && channelNav?.previous && <Control label="‹ Canal anterior" onPress={channelNav.previous} />}
          {!client && channelNav?.next && <Control label="Próximo canal ›" onPress={channelNav.next} />}
          {request && item.section === 'movies' && item.saimo && (
            <Control label={room ? 'Compartilhar convite' : creating ? 'Criando…' : 'Criar sala privada'} onPress={invite} />
          )}
          <Control label="Tentar novamente" onPress={() => select({ index: selection.index, attempt: selection.attempt + 1 })} />
        </View>
        {sources.length > 1 && (
          <View style={styles.sources}>
            <Text style={styles.muted}>FONTES</Text>
            <View style={styles.controls}>
              {sources.map((source, index) => (
                <Control
                  key={source.url}
                  label={source.label || `Fonte ${index + 1}`}
                  selected={index === selection.index}
                  onPress={() => select({ index, attempt: selection.attempt + 1 })}
                />
              ))}
            </View>
          </View>
        )}
        {roomError && <Text accessibilityRole="alert" style={styles.error}>{roomError}</Text>}
        </ScrollView>
        {room && <RoomChat room={room} request={request} onError={setRoomError} />}
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Control — Etapa auxiliar Control: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: { label, onPress, selected = false }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Control({ label, onPress, selected = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.control, selected && styles.selected]}>
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0F', gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  heading: { flex: 1 },
  cast: { alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  muted: { color: '#A8ABBD', fontSize: 12, fontWeight: '600' },
  error: { paddingHorizontal: 16, color: '#FFB4BD' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  control: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, backgroundColor: '#1E1E2D' },
  selected: { backgroundColor: '#4F46E5' },
  controlText: { color: '#FFFFFF', fontWeight: '600' },
  sources: { gap: 8, paddingTop: 4 },
});
