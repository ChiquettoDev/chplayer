/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Correção editorial local do catálogo de PC/LG. Filtra as referências da série antiga Kenan & Kel e invalida somente o cache/histórico afetado.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function (root) {
  'use strict';
  // The provider merged TMDB 116609 with the original Nickelodeon series, 1835.
  /**
 * correctText — Corrige os campos e os episódios dos arquivos conhecidos do catálogo.
 * Entradas: name; text.
 * Operações presentes no corpo: join, map, text.split, line.split, test, line.charAt, Number, filter, split, suffix.test.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function correctText(name, text) {
    var active = false;
    return text.split(/\r?\n/).map(function (line) {
      var p = line.split('\t');
      if (/^series-[^-]+-\d+\.txt$/.test(name)) {
        if (line.charAt(0) === '@') {
          active = p[0] === '@Kenan';
          return active ? '@Kenan & Kel' : line;
        }
        if (active && p.length >= 4) {
          var season = Number(p[0]), episode = Number(p[1]);
          var suffix = new RegExp('(?:^\\d+:|/)1835/' + season + '/' + episode + '(?:\\.[a-z0-9]+)?(?:[?#].*)?$', 'i');
          p[3] = p[3].split(',').filter(function (url) { return suffix.test(url.trim()); }).join(',');
          return p[3] ? p.join('\t') : '';
        }
      } else if (name === 'busca.txt' || /^series-[^-]+\.txt$/.test(name)) {
        if (p[0] === 'Kenan' && (name !== 'busca.txt' || p[1] === 's')) { p[0] = 'Kenan & Kel'; if (name !== 'busca.txt') p[1] = '1996'; }
      } else if ((name === 'fichas.txt' || name === 'destaques.txt') && p[0] === 's' && p[1] === 'Kenan') {
        p[1] = 'Kenan & Kel';
        if (name === 'destaques.txt') { p[3] = '1996'; p[4] = ''; p[5] = ''; }
        else { p[2] = '1835'; p[3] = ''; p[4] = 'Comédia'; }
      }
      return p.join('\t');
    }).join('\n');
  }
  if (typeof module === 'object') { module.exports = { correctText: correctText }; return; }
  var original = root.fetch;
  root.fetch = function (input, options) {
    var url;
    try { url = new URL(typeof input === 'string' ? input : input.url, root.location.href); } catch (e) { return original.call(root, input, options); }
    var name = url.pathname.split('/').pop();
    var match = url.hostname === 'catalog.example.com' && /^(?:busca|fichas|destaques|series-[A-Z#](?:-\d+)?)\.txt$/.test(decodeURIComponent(name));
    return original.call(root, input, options).then(function (response) {
      if (!match || !response.ok) return response;
      return response.text().then(function (text) { return new Response(correctText(decodeURIComponent(name), text), { status: response.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); });
    });
  };
  // Only the merged entry's catalog cache and resume need invalidating.
  try {
    if (localStorage.getItem('chplayer-catalog-correction') !== 'kenan-kel-1') {
      localStorage.removeItem('chplayer_cached_destaques');
      var progress = JSON.parse(localStorage.getItem('chplayer_vod_progress') || '{}'); delete progress.Kenan;
      localStorage.setItem('chplayer_vod_progress', JSON.stringify(progress));
      var favorites = JSON.parse(localStorage.getItem('chplayer_fav_vod') || '[]').map(function (id) { return id === 's_Kenan' ? 's_Kenan & Kel' : id; });
      localStorage.setItem('chplayer_fav_vod', JSON.stringify(favorites));
      localStorage.setItem('chplayer-catalog-correction', 'kenan-kel-1');
    }
  } catch (e) {}
})(typeof window === 'object' ? window : this);
