/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Camada de rede do catálogo Android. App.js pede listas/detalhes; este módulo baixa TXT e delega a interpretação a saimo.cjs.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import {
  correctSeriesIdentity, CHANNELS, CATALOG, mergeChannels, parseSaimoCatalog, parseBases, resolveMovie,
  findSeriesChunk, resolveSeries,
} from './saimo.cjs';

const MAX_BYTES = 24 * 1024 * 1024;
const TTL = 10 * 60 * 1000;
const files = new Map();

/**
 * fetchText — Baixa texto com tempo e tamanho limitados.
 * Entradas: address.
 * Operações presentes no corpo: setTimeout, controller.abort, fetch, Number, get, response.text, clearTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export async function fetchText(address) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(address, { signal: controller.signal });
    if (!response.ok) throw new Error(`A fonte retornou HTTP ${response.status}.`);
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('A fonte pode ter até 24 MB.');
    const contents = await response.text();
    if (contents.length > MAX_BYTES) throw new Error('A fonte pode ter até 24 MB.');
    return { contents, baseUrl: response.url || address };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * getFile — Reaproveita temporariamente arquivos baixados para evitar chamadas repetidas.
 * Entradas: base; name; refresh = false.
 * Operações presentes no corpo: files.get, Date.now, catch, then, fetchText, files.delete, files.set, next, files.keys.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function getFile(base, name, refresh = false) {
  const address = new URL(name, base).href;
  const current = files.get(address);
  if (!refresh && current?.until > Date.now()) return current.promise;
  const entry = { until: Date.now() + TTL };
  entry.promise = fetchText(address).then(({ contents }) => contents).catch((error) => {
    if (files.get(address) === entry) files.delete(address);
    throw error;
  });
  files.delete(address);
  files.set(address, entry);
  // ponytail: bound the in-memory cache to the most recently requested files.
  if (files.size > 10) files.delete(files.keys().next().value);
  return entry.promise;
}

/**
 * loadSaimoFeed — Baixa os arquivos necessários para a lista de canais ou catálogo.
 * Entradas: scope; refresh = false.
 * Operações presentes no corpo: Promise.all, getFile, catch, mergeChannels, parseSaimoCatalog.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export async function loadSaimoFeed(scope, refresh = false) {
  if (scope === 'live') {
    const [primary, extra] = await Promise.all([
      getFile(CHANNELS, 'catalogo.txt', refresh),
      getFile(CHANNELS, 'canais.txt', refresh).catch(() => ''),
    ]);
    return { items: mergeChannels(primary, extra) };
  }
  const [search, highlights, metadata] = await Promise.all([
    getFile(CATALOG, 'busca.txt', refresh),
    getFile(CATALOG, 'destaques.txt', refresh).catch(() => ''),
    getFile(CATALOG, 'fichas.txt', refresh).catch(() => ''),
  ]);
  return parseSaimoCatalog(search, highlights, metadata);
}

/**
 * loadSaimoTitle — Carrega as fontes do título somente quando os detalhes são solicitados.
 * Entradas: item.
 * Operações presentes no corpo: correctSeriesIdentity, encodeURIComponent, Promise.all, getFile, catch, parseBases, resolveMovie, findSeriesChunk, resolveSeries.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export async function loadSaimoTitle(item) {
  item = correctSeriesIdentity(item);
  if (!item.saimo || item.sources?.length || item.episodes?.length) return item;
  const letter = encodeURIComponent(item.saimo.letter);
  const file = item.section === 'movies' ? `filmes-${letter}.txt` : `series-${letter}.txt`;
  const [contents, index] = await Promise.all([
    getFile(CATALOG, file),
    getFile(CATALOG, 'indice.txt').catch(() => ''),
  ]);
  const bases = parseBases(index);
  if (item.section === 'movies') return resolveMovie(item, contents, bases);
  const { chunk, year } = findSeriesChunk(item, contents);
  const block = await getFile(CATALOG, `series-${letter}-${chunk}.txt`);
  return resolveSeries(item, year, block, bases);
}
