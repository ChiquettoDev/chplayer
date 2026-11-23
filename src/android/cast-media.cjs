/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Conversão de um item do catálogo para o pedido aceito pelo receptor Google Cast. Usado por TVPlayback.js e pelos testes de mídia.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
/**
 * castMedia — Converte mídia, posição e tipo ao vivo/filme para a estrutura do SDK Cast.
 * Entradas: item; source; position = 0; autoplay = true.
 * Operações presentes no corpo: includes, Error, Object.keys, toLowerCase, path.endsWith, Math.max, Number.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function castMedia(item, source, position = 0, autoplay = true) {
  const url = new URL(source.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw Error('Esta fonte só pode ser reproduzida no celular. Escolha uma fonte HTTP ou HTTPS para transmitir.');
  if (Object.keys(source.headers || {}).length) throw Error('Esta fonte exige autenticação própria do celular. Escolha outra fonte para transmitir.');
  const type = source.contentType;
  const path = url.pathname.toLowerCase();
  const contentType = type === 'hls' || path.endsWith('.m3u8') ? 'application/x-mpegURL'
    : type === 'dash' || path.endsWith('.mpd') ? 'application/dash+xml'
    : type?.includes('/') ? type : path.endsWith('.webm') ? 'video/webm' : 'video/mp4';
  return { autoplay, startTime: item.section === 'live' ? 0 : Math.max(0, Number(position) || 0), mediaInfo: {
    contentId: source.url, contentUrl: source.url, contentType,
    streamType: item.section === 'live' ? 'live' : 'buffered',
    metadata: { type: 'generic', title: item.series ? `${item.series} · ${item.title}` : item.title, subtitle: 'CHPlayer' },
  } };
}
/**
 * seekPosition — Limita o avanço/retrocesso ao intervalo válido do vídeo.
 * Entradas: position; delta; duration.
 * Operações presentes no corpo: Math.max, Number, Number.isFinite, Math.min.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function seekPosition(position, delta, duration) {
  const next = Math.max(0, (Number(position) || 0) + delta);
  return Number.isFinite(duration) && duration > 0 ? Math.min(next, duration) : next;
}
/**
 * sameMedia — Confere se um evento da TV pertence à fonte atual.
 * Entradas: status; url.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function sameMedia(status, url) {
  return status?.mediaInfo?.contentId === url || status?.mediaInfo?.contentUrl === url;
}
module.exports = { castMedia, seekPosition, sameMedia };
