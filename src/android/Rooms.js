/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Salas privadas e chat. App.js e Player.js usam estas rotinas para enviar comandos à função chplayer do Supabase e acompanhar o anfitrião.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

const linkPrefix = 'chplayer://sala/';
/**
 * inviteCode — Valida/extrai o código de um convite privado.
 * Entradas: value.
 * Operações presentes no corpo: exec, value.trim.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function inviteCode(value) {
  return /^(?:chplayer:\/\/sala\/)?([A-Za-z0-9_-]{43})\/?$/.exec(value.trim())?.[1];
}

/**
 * roomClient — Cria chamadas autenticadas ao servidor de salas.
 * Entradas: origin; token.
 * Operações presentes no corpo: setTimeout, controller.abort, fetch, JSON.stringify, response.json, clearTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function roomClient(origin, token) {
  return async (command, fields = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(origin + '/room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, token, ...fields }), signal: controller.signal,
      });
      if (response.status === 404) throw new Error('Sala indisponível, expirada ou acesso inativo.');
      if (!response.ok) throw new Error('Não foi possível conectar à sala.');
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  };
}

/**
 * shareRoom — Abre o compartilhamento do convite.
 * Entradas: code.
 * Operações presentes no corpo: Share.share.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function shareRoom(code) {
  const link = linkPrefix + code;
  return Share.share({ message: 'Assista comigo no CHPlayer! Abra o convite ou cole este link em Filmes e Séries → Entrar em sala.\n\n' + link });
}

/**
 * useRoomPlayback — Envia o estado do anfitrião ou sincroniza um convidado com esse estado.
 * Entradas: player; ready; request; code; host; onSnapshot.
 * Operações presentes no corpo: useEffect, request, Math.max, Math.abs, player.play, player.pause, onSnapshot, setTimeout, poll, clearTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function useRoomPlayback(player, ready, request, code, host, onSnapshot) {
  useEffect(() => {
    if (!ready || !code) return;
    let stopped = false;
    let timer;
    // ponytail: polling can take two seconds to propagate controls; use Realtime if needed.
    /**
 * poll — Etapa auxiliar poll: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: request, Math.max, Math.abs, player.play, player.pause, onSnapshot, setTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function poll() {
      try {
        const result = host
          ? await request('sync', { code, seconds: player.currentTime, playing: player.playing })
          : await request('read', { code });
        if (stopped) return;
        if (!host) {
          const { seconds, playing, at } = result.playback;
          const position = seconds + (playing ? Math.max(0, result.now - at) / 1000 : 0);
          if (Math.abs(player.currentTime - position) > 1.5) player.currentTime = position;
          if (playing && !player.playing) player.play();
          if (!playing && player.playing) player.pause();
        }
        onSnapshot(result, null);
      } catch (error) {
        if (!stopped) {
          if (!host) player.pause();
          onSnapshot(null, error.message);
        }
      } finally {
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [player, ready, request, code, host, onSnapshot]);
}

/**
 * RoomChat — Renderiza mensagens e o envio de texto à sala.
 * Entradas: { room, request, onError }.
 * Operações presentes no corpo: useState, name.trim, message.trim, setSending, request, setMessage, onError, reverse.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function RoomChat({ room, request, onError }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  /**
 * send — Etapa auxiliar send: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: name.trim, message.trim, setSending, request, setMessage, onError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function send() {
    if (sending || !name.trim() || !message.trim()) return;
    setSending(true);
    try {
      await request('message', { code: room.code, name, text: message });
      setMessage('');
    } catch (error) {
      onError(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.chat}>
      <Text style={styles.title}>Chat da sala</Text>
      <FlatList inverted keyboardShouldPersistTaps="handled"
        data={[...room.messages].reverse()} keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={styles.message}><Text style={styles.name}>{item.name}  </Text>{item.text}</Text>
        )}
        ListEmptyComponent={<Text style={styles.message}>Envie a primeira mensagem.</Text>}
      />
      <TextInput accessibilityLabel="Seu nome" placeholder="Seu nome no chat" placeholderTextColor="#ADB0C2"
        style={styles.input} maxLength={32} value={name} onChangeText={setName} />
      <View style={styles.compose}>
        <TextInput accessibilityLabel="Mensagem" placeholder="Mensagem" placeholderTextColor="#ADB0C2"
          style={[styles.input, styles.messageInput]} maxLength={400} value={message} onChangeText={setMessage} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: sending || !name.trim() || !message.trim() }}
          disabled={sending || !name.trim() || !message.trim()} onPress={send} style={styles.send}>
          <Text style={styles.title}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chat: { flex: 1, minHeight: 120, paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  title: { color: '#FFFFFF', fontWeight: '700' },
  message: { color: '#FFFFFF', paddingVertical: 5 },
  name: { color: '#A5A6FF', fontWeight: '700' },
  compose: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#1E1E2D', color: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, minHeight: 44 },
  messageInput: { flex: 1 },
  send: { backgroundColor: '#4F46E5', borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
});
