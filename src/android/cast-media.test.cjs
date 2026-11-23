/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Teste automatizado: executa cenários e usa asserções para detectar regressões. Leia as importações para localizar o módulo sob teste.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { castMedia, seekPosition, sameMedia } = require('./cast-media.cjs');
test('Google Cast recebe filmes, canais e posição em segundos, sem credenciais do app', () => {
  const film = castMedia({ id:'m1', title:'Filme', section:'movies' }, { url:'https://example.org/movie.m3u8?token=media' }, 120);
  assert.equal(film.startTime,120); assert.equal(film.mediaInfo.streamType,'buffered'); assert.equal(film.mediaInfo.contentType,'application/x-mpegURL');
  assert.equal(castMedia({title:'Canal',section:'live'},{url:'https://example.org/live.m3u8'},123).startTime,0);
  assert.equal(castMedia({title:'Canal',section:'live'},{url:'https://example.org/live.m3u8'}).mediaInfo.streamType,'live');
  assert.equal(castMedia({title:'Episódio',section:'series'},{url:'https://example.org/movie.mp4'},45,false).autoplay,false);
  assert.throws(()=>castMedia({},{url:'file:///private/video.mp4'}));
  assert.throws(()=>castMedia({},{url:'https://example.org/movie.mp4',headers:{Authorization:'private'}}));
});
test('avanço e retrocesso de 20 segundos respeitam os limites do filme',()=>{
  assert.equal(seekPosition(80,20,300),100); assert.equal(seekPosition(80,-20,300),60); assert.equal(seekPosition(5,-20,300),0); assert.equal(seekPosition(295,20,300),300);
  assert(sameMedia({mediaInfo:{contentId:'https://example.org/a'}},'https://example.org/a')); assert(!sameMedia({mediaInfo:{contentId:'https://example.org/a'}},'https://example.org/b'));
});
