/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Importação e normalização de listas. App.js e saimo.cjs usam estas funções para transformar dados externos em mídias consistentes.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const MAX_ENTRIES = 50000;
const TYPES = new Set(['auto', 'hls', 'dash', 'progressive', 'smoothStreaming']);

/**
 * httpUrl — Valida endereço HTTP/HTTPS e resolve endereços relativos quando há uma base.
 * Entradas: value; baseUrl.
 * Operações presentes no corpo: value.trim, includes.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function httpUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), baseUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * normalize — Normaliza texto para comparação/busca.
 * Entradas: value.
 * Operações presentes no corpo: trim, toLowerCase, replace, value.normalize.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * text — Etapa auxiliar text: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: value.
 * Operações presentes no corpo: value.trim.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * episodeInfo — Extrai a identificação de temporada/episódio de um título.
 * Entradas: title.
 * Operações presentes no corpo: exec, Number.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function episodeInfo(title) {
  const match = /^(.*?)\s*[.\s-]+(?:s(\d{1,3})\s*e(\d{1,4})|(\d{1,3})x(\d{1,4}))\b\s*[-–:. ]*\s*(.*)$/i.exec(title);
  if (!match?.[1]) return null;
  return { series: match[1], season: Number(match[2] ?? match[4]), episode: Number(match[3] ?? match[5]), episodeTitle: match[6] };
}

/**
 * source — Normaliza uma fonte de vídeo recebida de fora do aplicativo.
 * Entradas: value; baseUrl.
 * Operações presentes no corpo: httpUrl, Object.fromEntries, filter, Object.entries, test, toLowerCase, text, TYPES.has, pathname.endsWith.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function source(value, baseUrl) {
  const fields = typeof value === 'string' ? { url: value } : value;
  const url = httpUrl(fields?.url, baseUrl);
  if (!url || fields.drm) return null;
  const headers = Object.fromEntries(
    Object.entries(fields.headers ?? {}).filter(([key, val]) =>
      /^(?:User-Agent|Referer|Origin)$/i.test(key) && typeof val === 'string' && !/[\r\n]/.test(val)),
  );
  const pathname = new URL(url).pathname.toLowerCase();
  return {
    url,
    label: text(fields.label),
    contentType: TYPES.has(fields.contentType) ? fields.contentType
      : pathname.endsWith('.m3u8') ? 'hls' : pathname.endsWith('.mpd') ? 'dash' : 'auto',
    headers,
  };
}

/**
 * finish — Etapa auxiliar finish: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: entries.
 * Operações presentes no corpo: entries.values.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function finish(entries) {
  if (entries.size === 0) throw new Error('A fonte não contém itens com endereços HTTP ou HTTPS.');
  if (entries.size > MAX_ENTRIES) throw new Error('A fonte pode ter até 50.000 itens.');
  return [...entries.values()];
}

/**
 * add — Etapa auxiliar add: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: entries; item.
 * Operações presentes no corpo: entries.get, entries.set, map, byUrl.has, byUrl.set, byUrl.values.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function add(entries, item) {
  if (!item.title || !item.sources.length) return;
  const previous = entries.get(item.id);
  if (!previous) {
    entries.set(item.id, { ...item, url: item.sources[0].url });
    return;
  }
  const byUrl = new Map(previous.sources.map((entry) => [entry.url, entry]));
  for (const entry of item.sources) {
    if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
  }
  previous.sources = [...byUrl.values()];
}

/**
 * parsePlaylist — Lê entradas e atributos de uma playlist M3U.
 * Entradas: contents; baseUrl; scope = 'auto'.
 * Operações presentes no corpo: split, trimStart, contents.replace, test, lines.some, startsWith, line.trim, lines.slice, raw.trim, line.startsWith.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function parsePlaylist(contents, baseUrl, scope = 'auto') {
  const lines = contents.replace(/^\uFEFF/, '').trimStart().split(/\r?\n/);
  if (!/^#EXTM3U(?:\s|$)/.test(lines[0]?.trim())) {
    throw new Error('Escolha uma lista M3U com cabeçalho #EXTM3U.');
  }
  if (lines.some((line) => line.trim().startsWith('#EXT-X-'))) {
    throw new Error('Use uma lista de canais M3U. Uma playlist de vídeo HLS é um item de reprodução.');
  }

  const entries = new Map();
  let metadata;
  let headers = {};
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      let quoted = false;
      let separator = 0;
      for (; separator < line.length; separator++) {
        if (line[separator] === '"') quoted = !quoted;
        if (line[separator] === ',' && !quoted) break;
      }
      metadata = undefined;
      headers = {};
      if (separator < line.length) {
        const attributes = Object.fromEntries(
          [...line.slice(0, separator).matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, val]) => [key.toLowerCase(), val]),
        );
        const title = line.slice(separator + 1).trim() || text(attributes['tvg-name']);
        metadata = {
          title,
          group: text(attributes['group-title']) || 'Geral',
          artwork: httpUrl(attributes['tvg-logo'], baseUrl),
          tvgId: text(attributes['tvg-id']),
          kind: normalize(text(attributes['tvg-type'])),
          ...episodeInfo(title),
        };
      }
      continue;
    }
    if (!metadata || !line) continue;
    const option = /^#EXTVLCOPT:http-(user-agent|referrer)=(.+)$/i.exec(line);
    if (option) {
      headers[option[1].toLowerCase() === 'referrer' ? 'Referer' : 'User-Agent'] = option[2];
    }
    if (line.startsWith('#')) continue;

    const media = source({ url: line, headers }, baseUrl);
    if (media) {
      const group = normalize(metadata.group);
      const pathname = new URL(media.url).pathname;
      const section = scope === 'broadcast' ? 'live' : metadata.series || /\bseries?\b/.test(group) || metadata.kind === 'series' || /^\/series\//i.test(pathname)
        ? 'series'
        : /\b(filmes?|movies?|vod)\b/.test(group) || /^(movie|vod)$/.test(metadata.kind) || /^\/movie\//i.test(pathname)
          ? 'movies' : scope === 'catalog' ? 'movies' : 'live';
      add(entries, {
        ...metadata, section, id: media.url, sources: [media],
        series: section === 'series' ? metadata.series || metadata.title : undefined,
      });
    }
    metadata = undefined;
  }
  return finish(entries);
}

/**
 * parseChannels — Converte o texto de canais em itens reproduzíveis.
 * Entradas: contents; baseUrl.
 * Operações presentes no corpo: split, contents.replace, exec, normalize, add, filter, map, source, httpUrl, push.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function parseChannels(contents, baseUrl) {
  const entries = new Map();
  let channel;
  let stream;
  for (const raw of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const field = /^\s*([\p{L}]+):\s*(.*?)\s*$/u.exec(raw);
    if (!field) continue;
    const [, key, value] = field;
    switch (normalize(key)) {
      case 'canal':
        if (channel) add(entries, { ...channel, sources: channel.sources.map((item) => source(item, baseUrl)).filter(Boolean) });
        channel = { title: value, id: `channel:${baseUrl ?? ''}:${normalize(value)}`, group: 'Geral', section: 'live', sources: [] };
        stream = null;
        break;
      case 'categoria': if (channel) channel.group = value || 'Geral'; break;
      case 'logo': if (channel) channel.artwork = httpUrl(value, baseUrl); break;
      case 'fonte':
        if (channel) {
          stream = { url: value, headers: {} };
          channel.sources.push(stream);
        }
        break;
      case 'nome':
      case 'qualidade': if (stream) stream.label = [stream.label, value].filter(Boolean).join(' · '); break;
      case 'agente': if (stream) stream.headers['User-Agent'] = value; break;
      case 'referer': if (stream) stream.headers.Referer = value; break;
      case 'chave': if (stream) stream.drm = true; break;
      default: break;
    }
  }
  if (channel) add(entries, { ...channel, sources: channel.sources.map((item) => source(item, baseUrl)).filter(Boolean) });
  return finish(entries);
}

/**
 * parseCatalog — Converte o catálogo recebido em objetos de filmes/séries.
 * Entradas: contents; baseUrl.
 * Operações presentes no corpo: JSON.parse, Array.isArray, filter, map, source, text, add, httpUrl, String, Number.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function parseCatalog(contents, baseUrl) {
  const data = JSON.parse(contents);
  const entries = new Map();
  if (!data || !Array.isArray(data.movies) || !Array.isArray(data.series)) {
    throw new Error('O catálogo JSON precisa ter as listas movies e series.');
  }

  for (const movie of data.movies) {
    if (!movie || typeof movie !== 'object') continue;
    const sources = (Array.isArray(movie.sources) ? movie.sources : [movie.url]).map((value) => source(value, baseUrl)).filter(Boolean);
    const title = text(movie.title);
    add(entries, {
      id: text(movie.id) ? `movie:${baseUrl ?? ''}:${text(movie.id)}` : sources[0]?.url,
      title, section: 'movies', sources, featured: movie.featured === true,
      group: text(movie.category) || 'Filmes', artwork: httpUrl(movie.poster, baseUrl),
      description: text(movie.description), year: text(String(movie.year ?? '')),
    });
  }

  for (const show of data.series) {
    if (!text(show?.title) || !Array.isArray(show.episodes)) continue;
    for (const entry of show.episodes) {
      if (!entry || typeof entry !== 'object') continue;
      const sources = (Array.isArray(entry.sources) ? entry.sources : [entry.url]).map((value) => source(value, baseUrl)).filter(Boolean);
      const season = Number(entry.season ?? 1);
      const episode = Number(entry.episode);
      if (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1) continue;
      add(entries, {
        id: text(show.id) ? `episode:${baseUrl ?? ''}:${text(show.id)}:${season}:${episode}` : sources[0]?.url,
        title: text(entry.title) || `Episódio ${episode}`, series: text(show.title), season, episode,
        section: 'series', sources, featured: show.featured === true,
        group: text(show.category) || 'Séries', artwork: httpUrl(show.poster, baseUrl),
        description: text(show.description), year: text(String(show.year ?? '')),
      });
    }
  }
  return finish(entries);
}

/**
 * parseFeed — Seleciona o leitor adequado ao conteúdo importado.
 * Entradas: contents; baseUrl; scope.
 * Operações presentes no corpo: trimStart, contents.replace, start.startsWith, parsePlaylist, parseChannels, parseCatalog, entries.filter.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function parseFeed(contents, baseUrl, scope) {
  const start = contents.replace(/^\uFEFF/, '').trimStart();
  let entries;
  if (start.startsWith('#EXTM3U')) entries = parsePlaylist(start, baseUrl, scope);
  else if (scope === 'live') entries = parseChannels(start, baseUrl);
  else entries = parseCatalog(start, baseUrl);
  const selected = entries.filter((item) => scope === 'live' ? item.section === 'live' : item.section !== 'live');
  if (!selected.length) throw new Error('A fonte está vazia para esta seção.');
  return selected;
}

/**
 * groupCatalog — Agrupa itens do catálogo para exibição.
 * Entradas: entries.
 * Operações presentes no corpo: groups.set, JSON.stringify, normalize, groups.has, push, groups.get, map, groups.values, sort.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function groupCatalog(entries) {
  const groups = new Map();
  for (const item of entries) {
    if (item.section !== 'series' || item.saimo) {
      groups.set(item.id, item);
      continue;
    }
    const series = item.series || item.title;
    const key = JSON.stringify([normalize(series), normalize(item.group)]);
    if (!groups.has(key)) groups.set(key, { ...item, id: `series:${key}`, title: series, episodes: [] });
    groups.get(key).episodes.push(item);
  }
  return [...groups.values()].map((item) => item.episodes ? {
    ...item, episodes: item.episodes.sort((a, b) => (a.season ?? 1) - (b.season ?? 1) || (a.episode ?? 0) - (b.episode ?? 0)),
  } : item);
}

/**
 * matchesSearch — Verifica se um item corresponde à busca digitada.
 * Entradas: entry; query.
 * Operações presentes no corpo: includes, normalize.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function matchesSearch(entry, query) {
  return normalize(`${entry.title} ${entry.group} ${entry.series ?? ''}`).includes(normalize(query));
}

module.exports = { httpUrl, matchesSearch, parsePlaylist, parseFeed, groupCatalog, source };
