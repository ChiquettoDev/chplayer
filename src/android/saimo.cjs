/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Leitor do formato do catálogo Saimo. saimo-feed.js fornece os arquivos de texto; o retorno vira objetos de filmes, séries e episódios para App.js.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const { httpUrl, parseFeed, parsePlaylist, source } = require('./playlist.cjs');

const CHANNELS = 'https://catalog.example.com/live/';
const CATALOG = 'https://catalog.example.com/vod/';

/**
 * lines — Etapa auxiliar lines: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: contents.
 * Operações presentes no corpo: split, contents.replace.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function lines(contents) {
  return contents.replace(/^\uFEFF/, '').split(/\r?\n/);
}

/**
 * mergeChannels — Combina a lista principal com o suplemento sem repetir fontes.
 * Entradas: primary; extra = ''.
 * Operações presentes no corpo: parseFeed, extra.trim, channels.flatMap, map, filter, parsePlaylist, urls.has.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function mergeChannels(primary, extra = '') {
  const channels = parseFeed(primary, CHANNELS + 'catalogo.txt', 'live');
  if (!extra.trim()) return channels;
  try {
    const urls = new Set(channels.flatMap((item) => item.sources.map((entry) => entry.url)));
    return [...channels, ...parsePlaylist(extra, CHANNELS + 'canais.txt', 'broadcast').filter((item) => !urls.has(item.url))];
  } catch {
    return channels;
  }
}

/**
 * catalogId — Produz um identificador estável a partir do tipo, título e ano.
 * Entradas: section; title; year = ''.
 * Operações presentes no corpo: JSON.stringify.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function catalogId(section, title, year = '') {
  return `saimo:${section}:${JSON.stringify([title, year])}`;
}

const KENAN_LEGACY_ID = catalogId('series', 'Kenan');
const KENAN_KEL_ID = catalogId('series', 'Kenan & Kel', '1996');

/**
 * correctSeriesIdentity — Corrige a entrada misturada Kenan para Kenan & Kel e descarta as fontes antigas dessa entrada.
 * Entradas: item.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function correctSeriesIdentity(item) {
  if (item.section !== 'series' || !item.saimo || item.title !== 'Kenan') return item;
  const { episodes, sources, url, artwork, ...rest } = item;
  return { ...rest, id: KENAN_KEL_ID, title: 'Kenan & Kel', year: '1996', group: 'Comédia',
    saimo: { ...item.saimo, lookupTitle: 'Kenan', lookupYear: '', seriesContentId: '1835' } };
}

/**
 * parseSaimoCatalog — Relaciona índice, destaques e fichas para montar itens e trilhos.
 * Entradas: search; highlights = ''; metadata = ''.
 * Operações presentes no corpo: lines, split, line.trim, includes, test, catalogId, correctSeriesIdentity, items.set, byTitle.has, byTitle.set.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function parseSaimoCatalog(search, highlights = '', metadata = '') {
  const items = new Map();
  const byTitle = new Map();
  for (const line of lines(search)) {
    const [title, kind, letter, year = ''] = line.trim().split('\t');
    if (!title || !['f', 's'].includes(kind) || !/^[A-Z#]$/.test(letter)) continue;
    const section = kind === 'f' ? 'movies' : 'series';
    const id = catalogId(section, title, year);
    const item = correctSeriesIdentity({ id, title, year, section, group: kind === 'f' ? 'Filmes' : 'Séries', saimo: { letter } });
    items.set(item.id, item);
    const key = catalogId(section, title);
    if (!byTitle.has(key)) byTitle.set(key, item);
  }
  if (!items.size) throw new Error('O índice do Saimo não contém títulos disponíveis.');

  /**
 * lookup — Etapa auxiliar lookup: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: kind; title; year.
 * Operações presentes no corpo: items.get, catalogId, byTitle.get.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function lookup(kind, title, year) {
    const section = kind === 'f' ? 'movies' : kind === 's' ? 'series' : null;
    return section && (items.get(catalogId(section, title, year)) ?? byTitle.get(catalogId(section, title)));
  }

  let posterBase = '';
  for (const line of lines(metadata)) {
    if (line.startsWith('capa:')) {
      posterBase = httpUrl(line.slice(5)) ?? '';
      continue;
    }
    const [kind, title, , poster, genres] = line.split('\t');
    const item = lookup(kind, title);
    if (!item) continue;
    if (poster && posterBase) item.artwork = httpUrl(posterBase.replace(/\/$/, '') + '/' + poster.replace(/^\//, ''));
    const genre = genres?.split(',')[0]?.trim();
    if (genre) item.group = genre;
  }

  posterBase = '';
  let rail;
  const rails = new Map();
  for (const line of lines(highlights)) {
    if (line.startsWith('capa:')) {
      posterBase = httpUrl(line.slice(5)) ?? '';
      continue;
    }
    const [kind, title, , year = '', poster] = line.split('\t');
    if (kind === 'fila' && title) {
      rail = title;
      continue;
    }
    const item = lookup(kind, title, year);
    if (!item || !rail) continue;
    if (poster && posterBase) item.artwork = httpUrl(posterBase.replace(/\/$/, '') + '/' + poster.replace(/^\//, ''));
    if (!item.year && year) item.displayYear = year;
    if (!rails.has(rail)) rails.set(rail, []);
    rails.get(rail).push(item.id);
  }
  const featured = new Set([...rails.values()].flat());
  for (const id of featured) items.get(id).featured = true;
  // Discard the provider's artwork/genre for the mixed-up entry rather than showing the other production.
  for (const item of items.values()) if (item.saimo.seriesContentId === '1835') { delete item.artwork; item.group = 'Comédia'; }
  return { items: [...items.values()], rails: [...rails].map(([title, ids]) => ({ title, ids: [...new Set(ids)] })) };
}

/**
 * parseBases — Lê o índice de servidores-base usado pelos links abreviados.
 * Entradas: index.
 * Operações presentes no corpo: lines, exec, httpUrl, endsWith, bases.set.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function parseBases(index) {
  const bases = new Map();
  for (const line of lines(index)) {
    const match = /^base:\s+(\d+)\s+(\S+)/.exec(line);
    if (!match) continue;
    const url = httpUrl(match[2]);
    if (url && !new URL(url).hostname.endsWith('.invalid')) bases.set(match[1], url);
  }
  return bases;
}

/**
 * sources — Resolve links diretos/abreviados, áudio e formato de mídia sem escapar da base.
 * Entradas: values; bases.
 * Operações presentes no corpo: valuesText.split, exec, value.trim, bases.get, test, base.endsWith, startsWith, source, endsWith, result.has.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function sources(values, bases) {
  const result = new Map();
  for (const [language, valuesText] of values) {
    const label = language === 'dub' ? 'Dublado' : language === 'leg' ? 'Legendado' : '';
    for (const value of valuesText.split(',')) {
      const abbreviated = /^(\d+):([^\s]+)$/.exec(value.trim());
      const base = abbreviated && bases.get(abbreviated[1]);
      let url = value.trim();
      if (abbreviated) {
        if (!base) continue;
        const relative = abbreviated[2];
        // Abbreviations may contain an episode path and a query, but cannot escape their base.
        if (/^(?:[\/\\]|[a-z][a-z0-9+.-]*:)/i.test(relative) || /(?:^|\/)(?:\.\.|%2e)/i.test(relative)) continue;
        try {
          const root = new URL(base.endsWith('/') ? base : base + '/');
          const resolved = new URL(relative, root);
          if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname)) continue;
          if (!/\.[a-z0-9]{2,5}$/i.test(resolved.pathname)) resolved.pathname += '.mp4';
          url = resolved.href;
        } catch { continue; }
      }
      if (!/^https?:\/\//i.test(url)) continue;
      // Some Saimo VOD sources publish HLS playlists under a .txt suffix.
      const contentType = /\.txt(?:[?#]|$)/i.test(url) ? 'hls' : undefined;
      const media = source({ url, label, contentType });
      if (media && !new URL(media.url).hostname.endsWith('.invalid') && !result.has(media.url)) result.set(media.url, media);
    }
  }
  return [...result.values()];
}

/**
 * resolveMovie — Encontra as fontes de reprodução do filme solicitado.
 * Entradas: item; contents; bases = new Map().
 * Operações presentes no corpo: lines, line.split, exec, field.trim, values.push, match.slice, sources.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function resolveMovie(item, contents, bases = new Map()) {
  const values = [];
  for (const line of lines(contents)) {
    const [title, ...fields] = line.split('\t');
    if (title !== item.title) continue;
    for (const field of fields) {
      const match = /^(dub|leg)=(.+)$/.exec(field.trim());
      if (match) values.push(match.slice(1));
    }
  }
  const media = sources(values, bases);
  if (!media.length) throw new Error('Nenhuma fonte de reprodução está disponível para este filme.');
  return { ...item, sources: media, url: media[0].url };
}

/**
 * findSeriesChunk — Localiza o arquivo de episódios da série no índice por letra.
 * Entradas: item; contents.
 * Operações presentes no corpo: correctSeriesIdentity, lines, line.split, test.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function findSeriesChunk(item, contents) {
  item = correctSeriesIdentity(item);
  const lookupTitle = item.saimo?.lookupTitle ?? item.title;
  const lookupYear = item.saimo?.lookupYear ?? item.year;
  for (const line of lines(contents)) {
    const [title, year = '', chunk] = line.split('\t');
    if (title === lookupTitle && (!lookupYear || lookupYear === year) && /^\d{1,4}$/.test(chunk)) {
      return { chunk, year };
    }
  }
  throw new Error('A série não foi encontrada no índice de episódios.');
}

/**
 * resolveSeries — Monta temporadas/episódios e aceita somente 1835 para Kenan & Kel.
 * Entradas: item; year; contents; bases = new Map().
 * Operações presentes no corpo: correctSeriesIdentity, lines, line.startsWith, split, line.slice, line.split, test, Number, rows.has, rows.set.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function resolveSeries(item, year, contents, bases = new Map()) {
  item = correctSeriesIdentity(item);
  const lookupTitle = item.saimo?.lookupTitle ?? item.title;
  const lookupYear = item.saimo?.lookupYear ?? year;
  const rows = new Map();
  let active = false;
  for (const line of lines(contents)) {
    if (line.startsWith('@')) {
      if (active) break;
      const [title, release = ''] = line.slice(1).split('\t');
      active = title === lookupTitle && release === lookupYear;
      continue;
    }
    if (!active) continue;
    const [s, e, language, links] = line.split('\t');
    if (!/^\d{1,3}$/.test(s) || !/^\d{1,4}$/.test(e) || !links) continue;
    const season = Number(s);
    const episode = Number(e);
    const key = `${season}:${episode}`;
    if (!rows.has(key)) rows.set(key, { season, episode, links: [] });
    let selectedLinks = links;
    if (item.saimo?.seriesContentId) {
      // The provider merged NBC's Kenan (116609) with Nickelodeon's Kenan & Kel (1835).
      const suffix = new RegExp('(?:^\\d+:|/)' + item.saimo.seriesContentId + '/' + season + '/' + episode + '(?:\\.[a-z0-9]+)?(?:[?#].*)?$', 'i');
      selectedLinks = links.split(',').filter(value => suffix.test(value.trim())).join(',');
    }
    if (selectedLinks) rows.get(key).links.push([language, selectedLinks]);
  }
  const episodes = [...rows.values()].flatMap(({ season, episode, links }) => {
    const media = sources(links, bases);
    return media.length ? [{
      id: `${item.id}:episode:${season}:${episode}`, section: 'series',
      title: `Episódio ${episode}`, series: item.title, group: item.group, season, episode,
      url: media[0].url, sources: media, artwork: item.artwork,
      resume: { item, season, episode },
    }] : [];
  }).sort((a, b) => a.season - b.season || a.episode - b.episode);
  if (!episodes.length) throw new Error('Nenhum episódio com fonte de reprodução foi encontrado.');
  return { ...item, episodes };
}

module.exports = { correctSeriesIdentity, KENAN_LEGACY_ID, KENAN_KEL_ID, CHANNELS, CATALOG, mergeChannels, parseSaimoCatalog, parseBases, resolveMovie, findSeriesChunk, resolveSeries };
