/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Teste automatizado: executa cenários e usa asserções para detectar regressões. Leia as importações para localizar o módulo sob teste.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeChannels, parseSaimoCatalog, parseBases, resolveMovie, findSeriesChunk, resolveSeries } = require('./saimo.cjs');

test('combina os canais TXT com o suplemento M3U sem confundir categoria com tipo', () => {
  const items = mergeChannels('canal: Notícias\nfonte: https://example.org/news.m3u8',
    '#EXTM3U\n#EXTINF:-1 group-title="FILMES E SÉRIES",Canal Cinema\nhttps://example.org/cinema.m3u8');
  assert.deepEqual(items.map(({ title, section }) => [title, section]), [['Notícias', 'live'], ['Canal Cinema', 'live']]);
});

test('liga destaques e fichas aos títulos do índice, sem incluir destaques sem ficha de reprodução', () => {
  const { items, rails } = parseSaimoCatalog(
    'Uma Viagem\tf\tU\nO Vale\ts\tO\t2025',
    'capa: https://example.org/posters/\nfila\tEm alta\nf\tUma Viagem\tU\t2026\t/v.jpg\nf\tEm breve\tE\t2026\t/e.jpg',
    'capa: https://example.org/posters/\ns\tO Vale\t123\t/vale.jpg\tDrama,Aventura',
  );
  assert.equal(items[0].artwork, 'https://example.org/posters/v.jpg');
  assert.equal(items[0].displayYear, '2026');
  assert.equal(items[1].group, 'Drama');
  assert.deepEqual(rails, [{ title: 'Em alta', ids: [items[0].id] }]);
});

test('resolve um filme com links diretos e abreviações do índice, sem usar bases desativadas', () => {
  const item = { title: 'Uma Viagem', section: 'movies', saimo: { letter: 'U' } };
  const bases = parseBases('base: 2 https://example.org/movies/\nbase: 3 http://desativado.invalid/');
  const playable = resolveMovie(item, 'Outra viagem\tdub=https://example.org/other.mp4\nUma Viagem\tdub=2:145,3:22\tleg=https://example.org/sub.mp4', bases);
  assert.deepEqual(playable.sources.map(({ url, label }) => [url, label]), [
    ['https://example.org/movies/145.mp4', 'Dublado'], ['https://example.org/sub.mp4', 'Legendado'],
  ]);
  assert.throws(() => resolveMovie(item, 'Outra viagem\tdub=2:91', bases), /Nenhuma fonte/);
  assert.equal(resolveMovie(item, 'Uma Viagem\tdub=https://example.org/playlist.txt?sig=x').sources[0].contentType, 'hls');
});

test('localiza a versão da série e combina os áudios do mesmo episódio', () => {
  const show = { id: 'vale', title: 'O Vale', year: '2025', saimo: { letter: 'O' } };
  assert.deepEqual(findSeriesChunk(show, 'O Vale\t2010\t0\t1\nO Vale\t2025\t4\t2'), { chunk: '4', year: '2025' });
  const details = resolveSeries(show, '2025', [
    '@O Vale\t2010', '1\t1\tdub\thttps://example.org/old.mp4',
    '@O Vale\t2025', '2\t1\tdub\thttps://example.org/t2.mp4',
    '1\t1\tleg\thttps://example.org/sub.mp4', '1\t1\tdub\thttps://example.org/dub.mp4',
    '@Outra série', '1\t1\tdub\thttps://example.org/other.mp4',
  ].join('\n'));
  assert.deepEqual(details.episodes.map(({ season, episode }) => [season, episode]), [[1, 1], [2, 1]]);
  assert.deepEqual(details.episodes[0].sources.map(({ label }) => label), ['Legendado', 'Dublado']);
  assert.equal(details.episodes[0].resume.item, show);
});

test('lê o formato atual de temporadas/episódios e mantém a legenda na query', () => {
  const show={id:'kenan',title:'Kenan',section:'series'};
  const bases=parseBases('base: 19 https://example.org/series/catalog/');
  const result=resolveSeries(show,'','@Kenan\n1\t1\tdub\t19:1835/1/1\n1\t1\tleg\t19:1835/1/1.mp4?lang=leg\n2\t1\tdub\t19:1835/2/1',bases);
  assert.equal(result.episodes.length,2);
  assert.deepEqual(result.episodes[0].sources.map(s=>s.url),['https://example.org/series/catalog/1835/1/1.mp4','https://example.org/series/catalog/1835/1/1.mp4?lang=leg']);
  assert.throws(()=>resolveMovie({title:'Teste'},'Teste\tdub=19:../private,19://other.org/x,19:%2e%2e/private',bases),/Nenhuma fonte/);
});

test('Kenan & Kel usa a série de 1996 e exclui a produção recente, inclusive em dados antigos', () => {
  const { correctSeriesIdentity, KENAN_LEGACY_ID, KENAN_KEL_ID } = require('./saimo.cjs');
  const data=parseSaimoCatalog('Kenan\ts\tK','fila\tSéries\ns\tKenan\tK\t2021\twrong.jpg','capa: https://example.org/\ns\tKenan\t116609\twrong.jpg\tDrama');
  const show=data.items[0];assert.equal(show.title,'Kenan & Kel');assert.equal(show.year,'1996');assert.equal(show.id,KENAN_KEL_ID);assert.equal(show.artwork,undefined);assert.deepEqual(data.rails[0].ids,[show.id]);
  assert.deepEqual(findSeriesChunk(show,'Kenan\t\t0\t72'),{chunk:'0',year:''});
  const contents='@Kenan\n1\t1\tdub\t19:116609/1/1,19:1835/1/1\n1\t1\tleg\t19:116609/1/1.mp4?lang=leg\n4\t1\tdub\t19:1835/4/1';
  const old={id:KENAN_LEGACY_ID,title:'Kenan',section:'series',saimo:{letter:'K'},episodes:[{url:'https://example.org/wrong.mp4'}],artwork:'wrong.jpg'};
  assert.equal(correctSeriesIdentity(old).episodes,undefined);
  const result=resolveSeries(old,'',contents,parseBases('base: 19 https://example.org/series/'));
  assert.equal(result.episodes.length,2);assert(result.episodes.every(ep=>ep.series==='Kenan & Kel'&&ep.sources.every(source=>source.url.includes('/1835/')&&!source.url.includes('116609'))));
});
