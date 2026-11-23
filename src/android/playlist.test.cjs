/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Teste automatizado: executa cenários e usa asserções para detectar regressões. Leia as importações para localizar o módulo sob teste.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { httpUrl, parsePlaylist, parseFeed, groupCatalog, matchesSearch } = require('./playlist.cjs');

test('importa metadados, URLs relativas e categorias, com deduplicação', () => {
  const result = parsePlaylist([
    '\uFEFF#EXTM3U x-tvg-url="guide.xml"',
    '#EXTINF:-1 group-title="Canais, notícias",Notícias, "ao vivo',
    'live/index.m3u8',
    '#EXTINF:-1 group-title="Filmes",Viagem',
    'https://example.org/viagem.mp4',
    '#EXTINF:-1,Duplicado',
    'live/index.m3u8',
    '#EXTINF:-1 group-title="Séries",Episódio 1',
    'https://example.org/episodio.mp4',
    '#EXTINF:-1,Arquivo local',
    'file:///tmp/video.mp4',
  ].join('\r\n'), 'https://example.org/listas/lista.m3u');

  assert.deepEqual(result.map(({ title, url, section }) => [title, url, section]), [
    ['Notícias, "ao vivo', 'https://example.org/listas/live/index.m3u8', 'live'],
    ['Viagem', 'https://example.org/viagem.mp4', 'movies'],
    ['Episódio 1', 'https://example.org/episodio.mp4', 'series'],
  ]);
  assert.equal(matchesSearch(result[0], ' noticias '), true);
});

test('rejeita links locais, listas vazias e playlists HLS de segmentos', () => {
  assert.equal(httpUrl('file:///tmp/example'), null);
  assert.throws(() => parsePlaylist('sem cabeçalho'), /cabeçalho/);
  assert.throws(() => parsePlaylist('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6,Segmento\nsegment.ts', 'https://example.org/stream'), /HLS/);
});

test('canais TXT preservam categoria, logo e alternativas HTTP do mesmo canal', () => {
  const [item] = parseFeed([
    'canal: TV Pública',
    'categoria: Notícias',
    'logo: logo.png',
    'fonte: https://example.org/canal/manifest.m3u8',
    'nome: Oficial',
    'qualidade: HD',
    'referer: https://example.org/',
    'fonte: https://example.org/reserva/manifest.mpd',
    'fonte: https://example.org/protegido.mpd',
    'chave: exemplo:exemplo',
    'fonte: curtitv://exemplo',
  ].join('\n'), 'https://example.org/listas/canais.txt', 'live');
  assert.equal(item.group, 'Notícias');
  assert.equal(item.artwork, 'https://example.org/listas/logo.png');
  assert.deepEqual(item.sources.map(({ label, contentType }) => [label, contentType]), [
    ['Oficial · HD', 'hls'], ['', 'dash'],
  ]);
  assert.deepEqual(item.sources[0].headers, { Referer: 'https://example.org/' });
});

test('catálogo separa filmes e reúne episódios por temporada em ordem', () => {
  const data = {
    movies: [{ id: 'filme', title: 'Viagem', poster: 'poster.jpg', url: 'filme.mp4' }],
    series: [{ id: 'serie', title: 'Cidade', category: 'Documentário', episodes: [
      { season: 2, episode: 1, url: 'dois.mp4' },
      { season: 1, episode: 2, title: 'Segunda parte', sources: ['um-b.mp4', 'reserva.mp4'] },
      { season: 1, episode: 1, url: 'um-a.mp4' },
      { season: 1, episode: 3, url: 'file:///etc/passwd' },
    ] }],
  };
  const [movie, show] = groupCatalog(parseFeed(JSON.stringify(data), 'https://example.org/vod/catalogo.json', 'catalog'));
  assert.equal(movie.artwork, 'https://example.org/vod/poster.jpg');
  assert.equal(show.title, 'Cidade');
  assert.deepEqual(show.episodes.map(({ season, episode }) => [season, episode]), [[1, 1], [1, 2], [2, 1]]);
  assert.equal(show.episodes[1].sources.length, 2);
});

test('M3U de VOD identifica séries pelo título e respeita o escopo', () => {
  const contents = '#EXTM3U\n#EXTINF:-1,Um documentário\nhttps://example.org/movie.mp4\n'
    + '#EXTINF:-1 group-title="Séries",Expedição S02E03 - A chegada\nhttps://example.org/ep.mp4';
  const [movie, show] = groupCatalog(parseFeed(contents, undefined, 'catalog'));
  assert.equal(movie.section, 'movies');
  assert.equal(show.title, 'Expedição');
  assert.equal(show.episodes[0].episodeTitle, 'A chegada');
  assert.equal(parseFeed(contents, undefined, 'live').length, 1);
});
