/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Persistência local Android. App.js carrega biblioteca, preferências e progresso; AsyncStorage guarda pequenas informações e File guarda os catálogos maiores.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { correctSeriesIdentity, KENAN_LEGACY_ID, KENAN_KEL_ID } from './saimo.cjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const LEGACY = 'saimo-player-library';
const PREFS = 'chplayer-preferences';
const SCOPES = ['live', 'catalog'];
// IDs dos exemplos que versões antigas podiam guardar no aparelho.
const DEMO_IDS = new Set([
  'demo-flower', 'demo-bunny', 'demo-sintel', 'open-tears',
  'open-collection-1', 'open-collection-2', 'series:["sessao blender","coletanea"]',
]);
export const INITIAL = { items: [], favorites: [], feeds: {}, progress: {} };

/**
 * feedFile — Monta o caminho do arquivo local de um catálogo.
 * Entradas: scope; slot.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function feedFile(scope, slot) {
  return new File(Paths.document, `chplayer-${scope}-${slot}.json`);
}

/**
 * feedKey — Monta a chave que aponta para o cache ativo de uma categoria.
 * Entradas: scope.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function feedKey(scope) {
  return `chplayer-feed-${scope}`;
}

/**
 * loadLibrary — Lê os dados locais e migra registros antigos.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: Promise.all, AsyncStorage.getItem, SCOPES.map, feedKey, JSON.parse, SCOPES.entries, text, feedFile, Array.isArray, map.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export async function loadLibrary() {
  const [previous, preferences, ...pointers] = await Promise.all([
    AsyncStorage.getItem(LEGACY),
    AsyncStorage.getItem(PREFS),
    ...SCOPES.map((scope) => AsyncStorage.getItem(feedKey(scope))),
  ]);
  const legacy = previous && JSON.parse(previous);
  const prefs = preferences && JSON.parse(preferences);
  const feeds = {};
  for (const [index, scope] of SCOPES.entries()) {
    const slot = pointers[index];
    if (slot === 'default') feeds[scope] = { default: true };
    if (slot === 'a' || slot === 'b') feeds[scope] = JSON.parse(await feedFile(scope, slot).text());
  }
  return {
    items: Array.isArray(legacy?.items) ? legacy.items.filter(({ id }) => !DEMO_IDS.has(id)).map(correctSeriesIdentity) : [],
    favorites: (prefs?.favorites ?? legacy?.favorites ?? []).filter((id) => !DEMO_IDS.has(id)).map(id => id === KENAN_LEGACY_ID ? KENAN_KEL_ID : id),
    progress: Object.fromEntries(Object.entries(prefs?.progress ?? {}).filter(([id]) => !DEMO_IDS.has(id) && id !== KENAN_LEGACY_ID && !id.startsWith(KENAN_LEGACY_ID + ':episode:'))),
    feeds,
  };
}

/**
 * savePreferences — Grava favoritos e progresso no armazenamento local.
 * Entradas: favorites; progress.
 * Operações presentes no corpo: AsyncStorage.setItem, JSON.stringify.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function savePreferences(favorites, progress) {
  return AsyncStorage.setItem(PREFS, JSON.stringify({ favorites, progress }));
}

/**
 * saveFeed — Alterna arquivos de cache para persistir uma lista importada.
 * Entradas: scope; feed.
 * Operações presentes no corpo: feedKey, AsyncStorage.setItem, AsyncStorage.getItem, feedFile, file.create, file.write, JSON.stringify.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export async function saveFeed(scope, feed) {
  const key = feedKey(scope);
  if (!feed) {
    await AsyncStorage.setItem(key, 'default');
    return;
  }
  const previous = await AsyncStorage.getItem(key);
  const slot = previous === 'a' ? 'b' : 'a';
  const file = feedFile(scope, slot);
  file.create({ overwrite: true });
  file.write(JSON.stringify(feed));
  await AsyncStorage.setItem(key, slot);
}
