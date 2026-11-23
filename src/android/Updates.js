/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Aviso de atualização Android. Consulta releases.json, compara a própria plataforma e abre a página correta sem interromper o vídeo.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import config from './app.json';

/**
 * newerVersion — Compara os três números da versão; não compara como texto.
 * Entradas: next; current.
 * Operações presentes no corpo: test, map, next.split, current.split.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function newerVersion(next, current) {
  if (!/^\d+\.\d+\.\d+$/.test(next ?? '') || !/^\d+\.\d+\.\d+$/.test(current ?? '')) return false;
  const a = next.split('.').map(Number), b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/**
 * useUpdateNotice — Consulta atualização e adia o alerta enquanto há reprodução.
 * Entradas: playing.
 * Operações presentes no corpo: useState, useRef, useEffect, setTimeout, controller.abort, fetch, Date.now, response.json, newerVersion, setRelease.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function useUpdateNotice(playing) {
  const [release, setRelease] = useState(null);
  const dismissed = useRef('');
  const displayed = useRef('');
  useEffect(() => {
    let mounted = true, checking = false;
    /**
 * check — Consulta se há atualização disponível.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: setTimeout, controller.abort, fetch, Date.now, response.json, newerVersion, setRelease, clearTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function check() {
      if (checking) return;
      checking = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('https://chplayer.example.com/updates/releases.json?t=' + Date.now(), { signal: controller.signal });
        if (!response.ok) return;
        const item = (await response.json()).android;
        if (mounted && newerVersion(item?.version, config.expo.version) && item.version !== dismissed.current) setRelease(item);
      } catch {} finally { clearTimeout(timeout); checking = false; }
    }
    check();
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') check(); });
    return () => { mounted = false; clearInterval(interval); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (playing || !release || displayed.current === release.version || dismissed.current === release.version) return;
    displayed.current = release.version;
    const finish = () => { dismissed.current = release.version; setRelease(null); };
    Alert.alert('Nova versão disponível', 'CHPlayer para Android ' + release.version + ' está disponível.', [
      { text: 'Fechar', style: 'cancel', onPress: finish },
      { text: 'Atualizar', onPress: () => {
        finish();
        Linking.openURL('https://chplayer.example.com/atualizar.html?platform=android').catch(() => {
          Alert.alert('Atualizar CHPlayer', 'Abra chplayer-android.buffmile2.chatgpt.site/atualizar.html no navegador e selecione Android.');
        });
      } },
    ], { cancelable: true, onDismiss: finish });
  }, [release, playing]);
}
